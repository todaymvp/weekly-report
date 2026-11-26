'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { db, UPLOAD_DIR } = require('../db');
const { weekStartOf, publicUser, httpError, clamp, nowIso } = require('../helpers');
const settings = require('../settings');
const { requireAuth } = require('../auth');
const { saveAvatar, clearAvatar, uploadAvatar, avatarUploadError } = require('../avatarstore');
const { audit } = require('../audit');
const branding = require('../branding');
const reminders = require('../reminders');
const { isConfigured: smtpConfigured } = require('../mailer');

const router = express.Router();

router.use(requireAuth, (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
});

/* ---------------- 概览 ---------------- */
router.get('/stats', (req, res, next) => {
  try {
    const ws = weekStartOf();
    const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const active = db.prepare("SELECT COUNT(*) AS c FROM users WHERE status='active'").get().c;
    const reports = db.prepare('SELECT COUNT(*) AS c FROM reports').get().c;
    const weekReports = db.prepare('SELECT COUNT(*) AS c FROM reports WHERE week_start=?').get(ws).c;
    const posts = db.prepare('SELECT COUNT(*) AS c FROM posts').get().c;
    const comments = db.prepare('SELECT COUNT(*) AS c FROM comments').get().c;
    const chars = db.prepare('SELECT COALESCE(SUM(LENGTH(content)),0) AS c FROM reports').get().c;

    const weekTrend = db
      .prepare(
        `SELECT week_start AS week, COUNT(*) AS count
         FROM reports GROUP BY week_start ORDER BY week_start DESC LIMIT 8`
      )
      .all();

    res.json({
      currentWeek: ws,
      users,
      activeUsers: active,
      reports,
      weekReports,
      posts,
      comments,
      totalChars: chars,
      weekTrend: weekTrend.reverse()
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 用户管理 ---------------- */
router.get('/users', (req, res, next) => {
  try {
    const q = String(req.query.q || '').slice(0, 40).trim();
    const limit = clamp(parseInt(req.query.limit, 10) || 20, 1, 100);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const where = q
      ? "WHERE username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'"
      : '';
    const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    const params = q ? [like, like, like] : [];

    const total = db.prepare(`SELECT COUNT(*) AS c FROM users ${where}`).get(...params).c;
    const rows = db
      .prepare(`SELECT * FROM users ${where} ORDER BY id ASC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);

    res.json({
      total,
      items: rows.map((u) => {
        const r = db
          .prepare(
            'SELECT COUNT(*) AS c, COALESCE(SUM(LENGTH(content)),0) AS chars FROM reports WHERE user_id=?'
          )
          .get(u.id);
        return {
          ...publicUser(u),
          email: u.email,
          lastLoginAt: u.last_login_at,
          reports: r.c,
          chars: r.chars
        };
      })
    });
  } catch (e) {
    next(e);
  }
});

router.patch('/users/:id', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!target) throw httpError(404, '用户不存在');

    const fields = [];
    const values = [];
    if (req.body.role !== undefined) {
      const role = req.body.role === 'admin' ? 'admin' : 'user';
      if (target.role === 'admin' && role === 'user') {
        const admins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin'").get().c;
        if (admins <= 1) throw httpError(400, '至少保留一名管理员');
      }
      fields.push('role = ?');
      values.push(role);
    }
    if (req.body.status !== undefined) {
      const status = req.body.status === 'disabled' ? 'disabled' : 'active';
      if (target.id === req.user.id && status === 'disabled')
        throw httpError(400, '不能停用自己的账号');
      fields.push('status = ?');
      values.push(status);
      if (status === 'disabled') {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
      }
    }
    // ---- 资料字段（管理员可改任意用户的姓名 / 用户名 / 邮箱 / 学号 / 简介）----
    if (req.body.displayName !== undefined) {
      const dn = String(req.body.displayName).trim();
      if (dn.length < 1 || dn.length > 24) throw httpError(400, '姓名需为 1-24 个字符');
      fields.push('display_name = ?');
      values.push(dn);
    }
    if (req.body.username !== undefined) {
      const un = String(req.body.username).trim();
      if (!/^[A-Za-z0-9_\u4e00-\u9fa5-]{3,20}$/.test(un))
        throw httpError(400, '用户名需为 3-20 位字母、数字、下划线或中文');
      if (db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?').get(un, id))
        throw httpError(409, '用户名已被占用');
      fields.push('username = ?');
      values.push(un);
    }
    if (req.body.email !== undefined) {
      const em = String(req.body.email).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) throw httpError(400, '邮箱格式不正确');
      if (db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id != ?').get(em, id))
        throw httpError(409, '邮箱已被其它账号使用');
      fields.push('email = ?');
      values.push(em);
    }
    if (req.body.studentId !== undefined) {
      const sid = String(req.body.studentId).trim();
      if (sid && !/^[A-Za-z0-9-]{4,20}$/.test(sid))
        throw httpError(400, '学号需为 4-20 位字母、数字或连字符');
      if (sid && db.prepare('SELECT id FROM users WHERE student_id = ? AND id != ?').get(sid, id))
        throw httpError(409, '该学号已被其它账号使用');
      fields.push('student_id = ?');
      values.push(sid || null);
    }
    if (req.body.bio !== undefined) {
      const bio = String(req.body.bio);
      if (bio.length > 200) throw httpError(400, '简介最多 200 字');
      fields.push('bio = ?');
      values.push(bio);
    }

    if (!fields.length) throw httpError(400, '没有需要更新的字段');

    values.push(id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    audit({
      actor: req.user,
      action: 'admin_user_update',
      targetType: 'user',
      targetId: id,
      detail: `@${target.username} 修改：${fields.map((f) => f.split(' = ')[0]).join(', ')}`,
      req
    });
    res.json({ user: { ...publicUser(u), email: u.email } });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 管理员代传 / 移除头像 ---------------- */
router.post('/users/:id/avatar', (req, res, next) => {
  uploadAvatar(req, res, (err) => {
    if (err) return avatarUploadError(res, err);
    try {
      const id = parseInt(req.params.id, 10);
      if (!db.prepare('SELECT id FROM users WHERE id = ?').get(id)) throw httpError(404, '用户不存在');
      if (!req.file) throw httpError(400, '没有选择图片');
      saveAvatar(id, req.file.buffer);
      audit({ actor: req.user, action: 'admin_user_avatar_set', targetType: 'user', targetId: id, detail: '管理员代传头像', req });
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      res.status(201).json({ ok: true, user: { ...publicUser(u), email: u.email } });
    } catch (e) {
      next(e);
    }
  });
});

router.delete('/users/:id/avatar', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(id)) throw httpError(404, '用户不存在');
    clearAvatar(id);
    audit({ actor: req.user, action: 'admin_user_avatar_clear', targetType: 'user', targetId: id, detail: '管理员移除头像', req });
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json({ ok: true, user: { ...publicUser(u), email: u.email } });
  } catch (e) {
    next(e);
  }
});

router.post('/users/:id/reset-password', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!target) throw httpError(404, '用户不存在');
    const pwd = String(req.body.password || '');
    if (pwd.length < 6) throw httpError(400, '密码至少 6 位');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(pwd, 10), id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    audit({ actor: req.user, action: 'admin_password_reset', targetType: 'user', targetId: id, detail: '管理员重置了该用户密码', req });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 周次设置 ---------------- */
router.put('/week-base', (req, res, next) => {
  try {
    const start = String(req.body.start || '').trim();
    const num = parseInt(req.body.num, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw httpError(400, '日期格式应为 YYYY-MM-DD');
    const d = new Date(start + 'T00:00:00');
    if (Number.isNaN(d.getTime())) throw httpError(400, '日期不合法');
    if ((d.getDay() + 6) % 7 !== 0) throw httpError(400, '起始日期必须是周一');
    if (!(num >= 1 && num <= 60)) throw httpError(400, '起始周次需为 1-60');

    const upsert = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    upsert.run('week_base_start', start);
    upsert.run('week_base_number', String(num));
    audit({ actor: req.user, action: 'admin_week_base', detail: `起始周 ${start} = 第 ${num} 周`, req });
    res.json({ ok: true, start, num });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 系统设置 ---------------- */
router.get('/settings', (req, res) => {
  res.json({
    ...settings.siteSettings(),
    commentMail: settings.get('comment_mail') !== 'false',
    registerAutoActivate: settings.get('register_auto_activate') !== 'false',
    registerNeedReview: settings.get('register_need_review') === 'true',
    registerVerifyEmail: settings.get('register_verify_email') !== 'false',
    emailEnabled: settings.get('email_enabled') !== 'false',
    registerDomainMode: settings.get('register_domain_mode') || 'off',
    registerEmailDomains: settings.get('register_email_domains') || '',
    weekBase: {
      start: settings.get('week_base_start'),
      num: parseInt(settings.get('week_base_number'), 10) || 1
    }
  });
});

router.put('/settings', (req, res, next) => {
  try {
    if (req.body.siteName !== undefined) {
      const name = String(req.body.siteName).trim();
      if (name.length < 1 || name.length > 20) throw httpError(400, '站点名称需为 1-20 个字符');
      settings.set('site_name', name);
    }
    if (req.body.siteTagline !== undefined) settings.set('site_tagline', String(req.body.siteTagline).trim().slice(0, 60));
    if (req.body.siteDescription !== undefined) settings.set('site_description', String(req.body.siteDescription).trim().slice(0, 200));
    if (req.body.siteIcp !== undefined) settings.set('site_icp', String(req.body.siteIcp).trim().slice(0, 60));
    if (req.body.siteNotice !== undefined) {
      const notice = String(req.body.siteNotice).trim();
      if (notice.length > 200) throw httpError(400, '公告最多 200 字');
      settings.set('site_notice', notice);
    }
    if (req.body.uiStyle !== undefined) {
      settings.set('ui_style', req.body.uiStyle === 'github' ? 'github' : 'zhihu');
    }
    if (req.body.uiLocked !== undefined) {
      settings.set('ui_locked', req.body.uiLocked ? 'true' : 'false');
    }
    if (req.body.defaultAvatarProvider !== undefined) {
      settings.set('default_avatar_provider', req.body.defaultAvatarProvider === 'github' ? 'github' : 'letter');
    }
    if (req.body.allowRegister !== undefined) {
      settings.set('allow_register', req.body.allowRegister ? 'true' : 'false');
    }
    if (req.body.emailEnabled !== undefined) {
      settings.set('email_enabled', req.body.emailEnabled ? 'true' : 'false');
    }
    if (req.body.registerNeedReview !== undefined) {
      settings.set('register_need_review', req.body.registerNeedReview ? 'true' : 'false');
    }
    if (req.body.registerAutoActivate !== undefined) {
      settings.set('register_auto_activate', req.body.registerAutoActivate ? 'true' : 'false');
    }
    if (req.body.registerVerifyEmail !== undefined) {
      settings.set('register_verify_email', req.body.registerVerifyEmail ? 'true' : 'false');
    }
    if (req.body.registerEmailDomains !== undefined) {
      settings.set('register_email_domains', String(req.body.registerEmailDomains).trim().slice(0, 500));
    }
    if (req.body.registerDomainMode !== undefined) {
      settings.set('register_domain_mode', ['allow', 'deny'].includes(req.body.registerDomainMode) ? req.body.registerDomainMode : 'off');
    }
    if (req.body.modalNotice !== undefined) {
      const m = req.body.modalNotice || {};
      const title = String(m.title || '').slice(0, 60);
      const body = String(m.body || '').slice(0, 800);
      settings.set(
        'notice_modal',
        JSON.stringify({
          enabled: !!m.enabled && !!title,
          title,
          body,
          pinned: !!m.pinned,
          version: String(Date.now())
        })
      );
    }
    if (req.body.commentMail !== undefined) {
      settings.set('comment_mail', req.body.commentMail ? 'true' : 'false');
    }
    audit({
      actor: req.user,
      action: 'admin_settings_update',
      detail: Object.keys(req.body || {}).join(', '),
      req
    });
    res.json({
      ok: true,
      ...settings.siteSettings(),
      commentMail: settings.get('comment_mail') !== 'false'
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 内容管理 ---------------- */
router.get('/posts', (req, res, next) => {
  try {
    const limit = clamp(parseInt(req.query.limit, 10) || 20, 1, 100);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const total = db.prepare('SELECT COUNT(*) AS c FROM posts').get().c;
    const rows = db
      .prepare(
        `SELECT p.*, u.display_name, u.username
         FROM posts p JOIN users u ON u.id = p.user_id
         ORDER BY p.id DESC LIMIT ? OFFSET ?`
      )
      .all(limit, offset);
    res.json({
      total,
      items: rows.map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        views: p.views,
        isPinned: !!p.is_pinned,
        isLocked: !!p.is_locked,
        createdAt: p.created_at,
        author: { id: p.user_id, displayName: p.display_name, username: p.username }
      }))
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 周报管理 ---------------- */
router.get('/reports', (req, res, next) => {
  try {
    const limit = clamp(parseInt(req.query.limit, 10) || 20, 1, 100);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const q = String(req.query.q || '').slice(0, 60).trim();

    const where = q
      ? "WHERE r.title LIKE ? ESCAPE '\\' OR u.display_name LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\'"
      : '';
    const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    const params = q ? [like, like, like] : [];

    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM reports r JOIN users u ON u.id = r.user_id ${where}`)
      .get(...params).c;

    const rows = db
      .prepare(
        `SELECT r.id, r.title, r.summary, r.week_start, LENGTH(r.content) AS chars, r.status, r.created_at,
                r.user_id, u.display_name, u.username, g.name AS group_name
         FROM reports r
         JOIN users u ON u.id = r.user_id
         LEFT JOIN groups g ON g.id = r.group_id
         ${where}
         ORDER BY r.week_start DESC, r.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    res.json({
      total,
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        summary: r.summary,
        weekStart: r.week_start,
        chars: r.chars,
        status: r.status,
        createdAt: r.created_at,
        groupName: r.group_name || '',
        author: { id: r.user_id, displayName: r.display_name, username: r.username }
      }))
    });
  } catch (e) {
    next(e);
  }
});

router.delete('/reports/:id', (req, res, next) => {
  try {
    const r = db.prepare('SELECT id FROM reports WHERE id = ?').get(req.params.id);
    if (!r) throw httpError(404, '周报不存在');
    // 先删磁盘文件，再清数据库
    const files = db.prepare('SELECT stored_name FROM attachments WHERE report_id = ?').all(r.id);
    db.prepare('DELETE FROM attachments WHERE report_id = ?').run(r.id);
    db.prepare("DELETE FROM comments WHERE target_type='report' AND target_id=?").run(r.id);
    db.prepare("DELETE FROM likes WHERE target_type='report' AND target_id=?").run(r.id);
    db.prepare('DELETE FROM reports WHERE id = ?').run(r.id);
    for (const f of files) {
      fs.promises.unlink(path.join(UPLOAD_DIR, f.stored_name)).catch(() => {});
    }
    audit({ actor: req.user, action: 'admin_report_delete', targetType: 'report', targetId: r.id, detail: '管理员删除周报', req });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 批量修复旧内容里的 Markdown 转义 ---------------- */
/* 早期在富文本里粘贴 / 导入 Markdown 时，行首的 # - > 会被转义成 \# \- \>，
   导致正文不渲染标题和列表。这里统一把行首转义去掉（正文其它内容不动）。 */
router.post('/repair-escapes', (_req, res, next) => {
  try {
    const rows = db.prepare("SELECT id, content FROM reports WHERE content LIKE '%\\%'").all();
    const escRe = /^(\s*)\\+(#{1,6}\s|[-*>+]\s|\d+\.\s)/gm;
    const upd = db.prepare('UPDATE reports SET content = ?, updated_at = ? WHERE id = ?');
    const ts = nowIso();
    let fixed = 0;
    for (const r of rows) {
      const before = String(r.content || '');
      const after = before.replace(escRe, '$1$2');
      if (after !== before) {
        upd.run(after, ts, r.id);
        fixed += 1;
      }
    }
    res.json({ ok: true, scanned: rows.length, fixed });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 提交情况：排除名单 ---------------- */
router.get('/status-excluded', (_req, res) => {
  let ids = [];
  try {
    const raw = settings.get('status_excluded');
    ids = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids)) ids = [];
  } catch (e) {
    ids = [];
  }
  res.json({ ids });
});

router.put('/status-excluded', (req, res, next) => {
  try {
    const raw = Array.isArray(req.body.ids) ? req.body.ids : [];
    const ids = [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    const existing = new Set(db.prepare('SELECT id FROM users').all().map((u) => u.id));
    const clean = ids.filter((id) => existing.has(id));
    settings.set('status_excluded', JSON.stringify(clean));
    res.json({ ids: clean });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 审计日志 ---------------- */
router.get('/logs', (req, res, next) => {
  try {
    const limit = clamp(parseInt(req.query.limit, 10) || 50, 1, 200);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const q = String(req.query.q || '').slice(0, 60).trim();
    const action = String(req.query.action || '').slice(0, 40).trim();
    const range = ['today', '7d', '30d'].includes(String(req.query.range)) ? String(req.query.range) : 'all';

    const where = [];
    const params = [];
    if (range !== 'all') {
      const since =
        range === 'today'
          ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
          : new Date(Date.now() - (range === '7d' ? 7 : 30) * 86400000).toISOString();
      where.push('created_at >= ?');
      params.push(since);
    }
    if (q) {
      where.push("(actor_name LIKE ? ESCAPE '\\' OR detail LIKE ? ESCAPE '\\' OR ip LIKE ? ESCAPE '\\')");
      const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
      params.push(like, like, like);
    }
    if (action) {
      where.push('action = ?');
      params.push(action);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_logs ${whereSql}`).get(...params).c;
    const rows = db
      .prepare(`SELECT * FROM audit_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);

    const todayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const stats = {
      today: db.prepare('SELECT COUNT(*) AS c FROM audit_logs WHERE created_at >= ?').get(todayIso).c,
      failed: db
        .prepare(
          `SELECT COUNT(*) AS c FROM audit_logs
           WHERE created_at >= ? AND (action = 'login_failed' OR action = 'mail_failed')`
        )
        .get(todayIso).c,
      mail: db
        .prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE created_at >= ? AND action = 'mail_send'")
        .get(todayIso).c,
      actors: db
        .prepare(
          "SELECT COUNT(DISTINCT actor_name) AS c FROM audit_logs WHERE created_at >= ? AND actor_name != ''"
        )
        .get(todayIso).c
    };

    res.json({
      total,
      range,
      stats,
      actions: db
        .prepare('SELECT action, COUNT(*) AS c FROM audit_logs GROUP BY action ORDER BY c DESC')
        .all()
        .map((a) => ({ action: a.action, count: a.c })),
      items: rows.map((r) => ({
        id: r.id,
        actorId: r.actor_id,
        actor: r.actor_name,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        detail: r.detail,
        ip: r.ip,
        userAgent: r.user_agent,
        createdAt: r.created_at
      }))
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 邮件 SMTP 设置 ---------------- */
router.get('/smtp', (req, res) => {
  const c = require('../mailer').smtpConfig();
  res.json({
    host: c.host,
    port: c.port,
    secure: c.secure,
    user: c.user,
    pass: c.pass ? '••••••••' : '',   // 不回传明文，回显已设置
    from: c.from,
    siteUrl: settings.get('site_url') || 'https://study.hjsec.top',
    customHtml: settings.get('mail_custom_html') || '',
    enabled: c.enabled,
    configured: require('../mailer').isConfigured()
  });
});

router.put('/smtp', (req, res, next) => {
  try {
    const set = settings.set;
    if (req.body.host !== undefined) set('smtp_host', String(req.body.host).trim());
    if (req.body.port !== undefined) set('smtp_port', String(parseInt(req.body.port, 10) || 465));
    if (req.body.secure !== undefined) set('smtp_secure', req.body.secure ? 'true' : 'false');
    if (req.body.user !== undefined) set('smtp_user', String(req.body.user).trim());
    // 密码为空或全是圆点表示不修改
    if (req.body.pass !== undefined && req.body.pass !== '' && !/^•+$/.test(req.body.pass)) {
      set('smtp_pass', String(req.body.pass));
    }
    if (req.body.from !== undefined) set('mail_from', String(req.body.from).trim());
    if (req.body.siteUrl !== undefined) {
      set('site_url', String(req.body.siteUrl).trim().replace(/\/+$/, ''));
    }
    if (req.body.customHtml !== undefined) {
      set('mail_custom_html', String(req.body.customHtml).slice(0, 30000));
    }
    if (req.body.enabled !== undefined) set('smtp_enabled', req.body.enabled ? 'true' : 'false');
    audit({ actor: req.user, action: 'admin_smtp_update', detail: '更新邮件 SMTP 配置', req });
    const c = require('../mailer').smtpConfig();
    res.json({ ok: true, host: c.host, port: c.port, secure: c.secure, user: c.user, from: c.from, siteUrl: settings.get('site_url'), configured: require('../mailer').isConfigured() });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 邮件主题（多主题 + 随机选择） ---------------- */

/**
 * 预览 / 测试发送共用的模拟业务数据。
 * 预览与真实发送走同一条渲染路径，保证「看到的」就是「收到的」。
 */
function mailDemo(req, site) {
  return {
    ownerName: (req.user && (req.user.display_name || req.user.username)) || '林知',
    actorName: '王宇',
    reportTitle: 'Rust 所有权与借用检查器：从抗拒到接受',
    content: '这篇写得很清晰，借用检查那段比文档好懂，谢谢分享。',
    reportUrl: `${site}/#/report/1`,
    weekNumber: 11,
    chars: 1860,
    reviewer: '管理员',
    comment: '建议补一下具体的编译错误示例',
    total: 18,
    submitted: 15,
    pending: 3,
    deadline: '本周日 22:00',
    time: new Date().toLocaleString('zh-CN'),
    code: '824613',
    ttlMinutes: 10,
    subject: 'HJSEC 通知示例',
    heading: '这是一封主题预览邮件',
    intro: '如果你能看到这个样式，说明邮件模板工作正常。',
    html: '<p>这是一封主题预览邮件，用于检查排版、配色与按钮。</p>'
  };
}

function siteBase() {
  return settings.get('site_url') || 'https://study.hjsec.top';
}

/** 主题总览：全部主题 + 启用状态 + 模式 + 最近邮件用过的主题 */
router.get('/mail/themes', (req, res, next) => {
  try {
    const t = require('../mail_templates');
    const snap = t.selector.snapshot();
    res.json({
      mode: snap.mode,
      enabled: snap.enabled,
      defaultTheme: snap.defaultTheme,
      all: snap.all.map((x) => ({ ...x, enabled: snap.enabled.includes(x.key) })),
      kinds: t.kindList(),
      recent: require('../mailer').recentMailLogs(12)
    });
  } catch (e) {
    next(e);
  }
});

/** 保存：模式 / 固定主题 / 参与随机的主题集合 */
router.put('/mail/themes', (req, res, next) => {
  try {
    const t = require('../mail_templates');
    const body = req.body || {};
    const changes = [];

    if (body.mode !== undefined) {
      const m = body.mode === 'fixed' ? 'fixed' : 'random';
      settings.set('mail_theme_mode', m);
      changes.push(m === 'fixed' ? '固定主题' : '随机主题');
    }

    if (body.defaultTheme !== undefined) {
      const key = t.themes.exists(body.defaultTheme) ? body.defaultTheme : '';
      if (!key) throw httpError(400, '主题不存在');
      settings.set('mail_theme_default', key);
      settings.set('mail_theme', key); // 兼容旧字段
      changes.push(`固定/兜底主题=${key}`);
    }

    if (body.enabled !== undefined) {
      if (!Array.isArray(body.enabled)) throw httpError(400, 'enabled 需要是主题数组');
      const keys = [];
      for (const raw of body.enabled) {
        const k = t.selector.normalize(raw);
        if (k && !keys.includes(k)) keys.push(k);
      }
      settings.set('mail_themes_enabled', JSON.stringify(keys));
      changes.push(`启用 ${keys.length} 套`);
    }

    if (changes.length) {
      audit({
        actor: req.user,
        action: 'admin_mail_theme',
        detail: `邮件主题调整：${changes.join('，')}`,
        req
      });
    }

    const snap = t.selector.snapshot();
    res.json({
      ok: true,
      mode: snap.mode,
      enabled: snap.enabled,
      defaultTheme: snap.defaultTheme,
      all: snap.all.map((x) => ({ ...x, enabled: snap.enabled.includes(x.key) }))
    });
  } catch (e) {
    next(e);
  }
});

/** 兼容旧接口：只返回当前主题 */
router.get('/mail/theme', (req, res, next) => {
  try {
    const t = require('../mail_templates');
    const snap = t.selector.snapshot();
    res.json({
      current: snap.defaultTheme,
      themes: snap.all,
      mode: snap.mode,
      enabled: snap.enabled
    });
  } catch (e) {
    next(e);
  }
});

/** 兼容旧接口：切换固定主题 */
router.put('/mail/theme', (req, res, next) => {
  try {
    const t = require('../mail_templates');
    const key = String((req.body || {}).theme || '');
    if (!t.themes.exists(key)) throw httpError(400, '主题不存在');
    settings.set('mail_theme_mode', 'fixed');
    settings.set('mail_theme_default', key);
    settings.set('mail_theme', key);
    audit({ actor: req.user, action: 'admin_mail_theme', detail: `邮件主题切换为 ${key}`, req });
    res.json({ ok: true, current: key, mode: 'fixed' });
  } catch (e) {
    next(e);
  }
});

/**
 * 预览：返回指定主题 + 指定通知类型的真实 HTML（不发送）
 *   GET /api/admin/mail/preview?theme=nature|random&kind=reminderSat
 */
router.get('/mail/preview', (req, res, next) => {
  try {
    const t = require('../mail_templates');
    const themeRaw = String(req.query.theme || '');
    const kind = String(req.query.kind || req.query.type || 'reminderSat');
    const demo = mailDemo(req, siteBase());

    const themeKey = themeRaw === 'random' || !themeRaw ? t.selector.select().key : themeRaw;
    if (!t.themes.exists(themeKey)) throw httpError(400, '主题不存在');

    const html = t.renderAs(themeKey, () => t.renderKind(kind, demo));

    // 预览要在后台 iframe 里展示，放开同源框架限制
    res.removeHeader('X-Frame-Options');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.removeHeader('Content-Security-Policy');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'"
    );
    res.setHeader('X-Mail-Theme', themeKey);
    res.setHeader('Access-Control-Expose-Headers', 'X-Mail-Theme');
    res.type('html').send(html);
  } catch (e) {
    next(e);
  }
});

/** 用选定主题发一封测试邮件（与真实发送同一渲染路径） */
router.post('/mail/preview/send', async (req, res, next) => {
  try {
    const t = require('../mail_templates');
    const { sendMail } = require('../mailer');
    const body = req.body || {};
    const to = String(body.to || req.user.email || '').trim();
    if (!to) throw httpError(400, '请填写收件邮箱');

    const kind = String(body.kind || body.type || 'reminderSat');
    const themeRaw = String(body.theme || '');
    const themeKey = themeRaw === 'random' || !themeRaw ? t.selector.select().key : themeRaw;
    if (!t.themes.exists(themeKey)) throw httpError(400, '主题不存在');

    const demo = mailDemo(req, siteBase());
    const html = t.renderAs(themeKey, () => t.renderKind(kind, demo));
    const meta = t.themes.get(themeKey);

    const r = await sendMail({
      to,
      toName: req.user.display_name || req.user.username,
      subject: `【主题预览】HJSEC 周报通知 · ${meta.name}`,
      text: t.plain('default', demo),
      html,
      type: 'mail_preview',
      theme: themeKey,
      actor: req.user
    });

    audit({
      actor: req.user,
      action: 'admin_mail_preview',
      detail: `发送模板预览到 ${to}（主题 ${themeKey}）`,
      req
    });
    res.json({ ok: true, to, theme: themeKey, themeName: meta.name, mode: r.mode, messageId: r.messageId || '' });
  } catch (e) {
    next(e);
  }
});

router.post('/smtp/test', async (req, res, next) => {
  try {
    const { verifySmtp } = require('../mailer');
    const r = await verifySmtp();
    audit({ actor: req.user, action: 'admin_smtp_test', detail: r.ok ? 'SMTP 连接成功' : 'SMTP 连接失败：' + r.error, req });
    res.json(r);
  } catch (e) {
    next(e);
  }
});

/* ---------------- 站点 Logo ---------------- */
router.post('/logo', (req, res, next) => {
  branding.upload(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Logo 不能超过 2MB' : err.message || '上传失败';
      return res.status(400).json({ error: msg });
    }
    try {
      if (!req.file) throw httpError(400, '没有选择图片');
      branding.save(req.file);
      audit({ actor: req.user, action: 'admin_logo_set', detail: '更新站点 Logo', req });
      res.status(201).json({ ok: true, site: settings.siteSettings() });
    } catch (e) {
      next(e);
    }
  });
});

router.delete('/logo', (req, res, next) => {
  try {
    branding.clear();
    audit({ actor: req.user, action: 'admin_logo_clear', detail: '移除站点 Logo', req });
    res.json({ ok: true, site: settings.siteSettings() });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 周报提醒（周六 / 周日 22:00） ---------------- */
router.get('/reminders', (req, res, next) => {
  try {
    const cfg = reminders.config();
    const weekStart = weekStartOf();
    const pending = reminders.pendingUsers(weekStart);
    const members = db
      .prepare("SELECT id, username, display_name, status FROM users WHERE status='active' ORDER BY id ASC")
      .all();

    res.json({
      ...cfg,
      mailMode: smtpConfigured() ? 'smtp' : 'console',
      smtpConfigured: smtpConfigured(),
      weekStart,
      weekNumber: reminders.weekNumber(weekStart),
      pending: pending.map((u) => ({ id: u.id, username: u.username, displayName: u.display_name })),
      members: members.map((u) => ({ id: u.id, username: u.username, displayName: u.display_name }))
    });
  } catch (e) {
    next(e);
  }
});

router.put('/reminders', (req, res, next) => {
  try {
    const cfg = reminders.saveConfig(req.body || {});
    audit({
      actor: req.user,
      action: 'admin_reminder_config',
      detail: `启用=${cfg.enabled ? '是' : '否'} 周六=${cfg.satTime} 周日=${cfg.sunTime} 对象=${
        cfg.mode === 'all' ? '全部成员' : cfg.ids.length + ' 人'
      }`,
      req
    });
    res.json({ ok: true, ...cfg });
  } catch (e) {
    next(e);
  }
});

router.post('/reminders/send', async (req, res, next) => {
  try {
    const stage = req.body.stage === 'sun' ? 'sun' : 'sat';
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const result = await reminders.sendRound(stage, { actor: req.user, manual: true, onlyIds: ids, req });
    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
