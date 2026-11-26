'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { db, pickColor, AVATAR_COLORS } = require('../db');
const { nowIso, publicUser, httpError } = require('../helpers');
const emailCode = require('../emailcode');
const captcha = require('../captcha');
const settings = require('../settings');
const { isConsoleMode, sendMail } = require('../mailer');
const { audit } = require('../audit');
const log = require('../logger');
const {
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  requireAuth
} = require('../auth');

const router = express.Router();

const USERNAME_RE = /^[A-Za-z0-9_\u4e00-\u9fa5-]{3,20}$/;
const STUDENT_ID_RE = /^[A-Za-z0-9-]{4,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** 开发便利：未接入 SMTP 或显式开启时，把验证码回显给前端/日志，生产环境请勿开启 */
const DEV_CODE_HINT = process.env.DEV_CODE_HINT === 'true';

/* ---------------- 图形验证码 ---------------- */
router.get('/captcha', (req, res) => {
  const { id, svg, code } = captcha.create();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ id, svg, ...(DEV_CODE_HINT ? { devCode: code } : {}) });
});

/* ---------------- 邮箱验证码 ---------------- */
router.post('/email-code', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim();
    const purpose = 'register';
    if (!EMAIL_RE.test(email)) throw httpError(400, '邮箱格式不正确');

    // 邮箱功能关闭 / 自动激活模式：都不需要注册验证码
    if (settings.get('email_enabled') === 'false') throw httpError(400, '邮箱验证未启用，请联系管理员');
    if (settings.get('register_auto_activate') !== 'false') throw httpError(400, '当前为自动激活模式，无需邮箱验证码');

    const exists = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
    if (exists) throw httpError(409, '该邮箱已注册，请直接登录');

    const result = await emailCode.issue({ email, purpose, ip: req.ip });
    // 仅开发便利：非 production 且未接 SMTP 时回显验证码；生产环境（Docker 默认 NODE_ENV=production）不会回显
    const exposeCode =
      process.env.DEV_CODE_HINT === 'true' ||
      (result.consoleMode && process.env.NODE_ENV !== 'production');
    res.json({
      ok: true,
      cooldown: result.cooldown,
      expiresIn: result.expiresIn,
      mailMode: result.consoleMode ? 'console' : 'smtp',
      ...(exposeCode ? { devCode: result.code } : {})
    });
  } catch (e) {
    next(e);
  }
});

router.post('/register', (req, res, next) => {
  try {
    if (settings.get('allow_register') !== 'true') throw httpError(403, '管理员已关闭注册');
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');
    const displayName = String(req.body.displayName || '').trim();
    const studentId = String(req.body.studentId || '').trim();

    if (!USERNAME_RE.test(username))
      throw httpError(400, '用户名需为 3-20 位字母、数字、下划线或中文');
    if (displayName.length < 2 || displayName.length > 24)
      throw httpError(400, '请填写真实姓名（2-24 个字符）');
    if (!STUDENT_ID_RE.test(studentId))
      throw httpError(400, '学号需为 4-20 位字母、数字或连字符');
    if (!EMAIL_RE.test(email)) throw httpError(400, '邮箱格式不正确');
    if (password.length < 6) throw httpError(400, '密码至少 6 位');

    // 邮箱域名白名单 / 黑名单
    const domainMode = settings.get('register_domain_mode') || 'off';
    const domains = String(settings.get('register_email_domains') || '')
      .split(/[,，\s]+/)
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);
    const emailDomain = email.split('@')[1].toLowerCase();
    if (domainMode !== 'off' && domains.length) {
      const hit = domains.includes(emailDomain) || domains.some((d) => d.startsWith('.') && emailDomain.endsWith(d));
      if (domainMode === 'allow' && !hit) throw httpError(403, '该邮箱域名不在允许注册的范围内');
      if (domainMode === 'deny' && hit) throw httpError(403, '该邮箱域名已被禁止注册');
    }

    const dup = db
      .prepare('SELECT username, email FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE')
      .get(username, email);
    if (dup) {
      if (dup.username.toLowerCase() === username.toLowerCase()) throw httpError(409, '用户名已被占用');
      throw httpError(409, '邮箱已被注册');
    }
    const dupSid = db.prepare('SELECT id FROM users WHERE student_id = ?').get(studentId);
    if (dupSid) throw httpError(409, '该学号已注册过账号');

    // 注册激活策略：
    //   邮箱验证码激活（register_auto_activate=false）→ 必须填对验证码
    //   自动激活 → 直接可用，不查验证码
    // 是否要管理员审核（pending）是独立开关 register_need_review，与激活方式无关
    const emailEnabled = settings.get('email_enabled') !== 'false';
    const autoActive = settings.get('register_auto_activate') !== 'false';
    if (!autoActive) {
      if (!emailEnabled) throw httpError(400, '邮箱验证未启用，无法完成注册验证，请联系管理员');
      emailCode.verify({ email, purpose: 'register', code: String(req.body.emailCode || '').trim() });
    }

    const initialStatus = settings.get('register_need_review') === 'true' ? 'pending' : 'active';

    const info = db
      .prepare(
        `INSERT INTO users (username, email, password_hash, display_name, student_id, avatar_color, role, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'user', ?, ?)`
      )
      .run(
        username,
        email,
        bcrypt.hashSync(password, 10),
        displayName,
        studentId,
        pickColor(username),
        initialStatus,
        nowIso()
      );

    // 待审核账号不建会话，也不允许登录
    const needReview = initialStatus === 'pending';
    if (!needReview) {
      const { id, expires } = createSession(info.lastInsertRowid);
      setSessionCookie(res, id, expires);
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    audit({ actor: user, action: 'register', detail: `注册账号 @${username} · ${email}${needReview ? '（待审核）' : ''}`, req });
    res.status(201).json({ user: publicUser(user), pending: needReview });
  } catch (e) {
    // 注册失败（校验不过 / 邮箱验证码错 / 重复）也留痕，方便排查为什么"注册没日志"
    audit({
      action: 'register_failed',
      detail: `${String(req.body && req.body.email ? req.body.email : '').slice(0, 60)}：${String(
        e.message || '注册失败'
      ).slice(0, 100)}`,
      req
    });
    next(e);
  }
});

router.post('/login', (req, res, next) => {
  let logged = false; // 避免同一个失败被记两次
  try {
    const account = String(req.body.account || '').trim();
    const password = String(req.body.password || '');
    if (!account || !password) throw httpError(400, '请输入账号和密码');

    // 人机验证：先校验图形验证码（一次性，5 分钟内有效）
    if (!captcha.verify(req.body.captchaId, req.body.captchaCode)) {
      audit({
        action: 'login_failed',
        detail: `账号 ${account.slice(0, 40)}：图形验证码错误或已过期`,
        req
      });
      logged = true;
      throw httpError(400, '图形验证码错误或已过期，请重新输入');
    }

    const user = db
      .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE')
      .get(account, account);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      audit({ actor: user || null, action: 'login_failed', detail: `账号 ${account.slice(0, 40)} 密码错误`, req });
      logged = true;
      throw httpError(401, '账号或密码错误');
    }
    if (user.status === 'pending') {
      audit({ actor: user, action: 'login_failed', detail: '账号待管理员激活', req });
      logged = true;
      throw httpError(403, '账号尚未激活，请等待管理员审核');
    }
    if (user.status !== 'active') {
      audit({ actor: user, action: 'login_failed', detail: '账号已停用', req });
      logged = true;
      throw httpError(403, '该账号已被停用，请联系管理员');
    }

    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), user.id);
    audit({ actor: user, action: 'login', detail: '登录成功', req });
    const { id, expires } = createSession(user.id);
    setSessionCookie(res, id, expires);
    res.json({ user: publicUser(user) });
  } catch (e) {
    if (!logged) audit({ action: 'login_failed', detail: String(e.message || '登录失败').slice(0, 120), req });
    next(e);
  }
});

router.post('/logout', (req, res) => {
  audit({ actor: req.user, action: 'logout', detail: '退出登录', req });
  destroySession(req.sessionId);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});

router.patch('/profile', requireAuth, (req, res, next) => {
  try {
    const displayName = req.body.displayName;
    const bio = req.body.bio;
    const avatarColor = req.body.avatarColor;

    const fields = [];
    const values = [];
    if (displayName !== undefined) {
      const dn = String(displayName).trim();
      if (dn.length < 1 || dn.length > 24) throw httpError(400, '昵称需为 1-24 个字符');
      fields.push('display_name = ?');
      values.push(dn);
    }
    if (bio !== undefined) {
      if (String(bio).length > 200) throw httpError(400, '简介最多 200 字');
      fields.push('bio = ?');
      values.push(String(bio));
    }
    if (avatarColor !== undefined) {
      if (!AVATAR_COLORS.includes(String(avatarColor))) throw httpError(400, '头像颜色不合法');
      fields.push('avatar_color = ?');
      values.push(String(avatarColor));
    }
    if (!fields.length) throw httpError(400, '没有需要更新的字段');

    values.push(req.user.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    audit({
      actor: req.user,
      action: 'profile_update',
      detail: fields.map((f) => f.split(' = ')[0]).join(', '),
      req
    });
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post('/password', requireAuth, (req, res, next) => {
  try {
    const oldPassword = String(req.body.oldPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 6) throw httpError(400, '新密码至少 6 位');
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(oldPassword, row.password_hash)) throw httpError(400, '原密码不正确');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      bcrypt.hashSync(newPassword, 10),
      req.user.id
    );
    // 踢掉其它会话
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(req.user.id, req.sessionId);
    audit({ actor: req.user, action: 'password_change', detail: '自行修改密码', req });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 忘记密码：发验证码 ---------------- */
router.post('/forgot', async (req, res, next) => {
  try {
    // 邮箱功能关闭：不能发重置邮件，引导联系管理员
    if (settings.get('email_enabled') === 'false') {
      throw httpError(400, '邮箱验证未启用，无法自助重置密码，请联系管理员');
    }
    const email = String(req.body.email || '').trim();
    if (!EMAIL_RE.test(email)) throw httpError(400, '邮箱格式不正确');

    const user = db
      .prepare('SELECT id, status, username, display_name FROM users WHERE email = ? COLLATE NOCASE')
      .get(email);

    // 不暴露邮箱是否已注册：查不到也返回同样的成功结果（防枚举）
    if (!user) {
      return res.json({
        ok: true,
        sent: true,
        cooldown: emailCode.COOLDOWN_SEC,
        expiresIn: emailCode.TTL_MIN * 60,
        mailMode: isConsoleMode() ? 'console' : 'smtp'
      });
    }
    if (user.status !== 'active') throw httpError(403, '该账号已被停用，请联系管理员');

    let result;
    try {
      result = await emailCode.issue({ email, purpose: 'reset', ip: req.ip, name: user.display_name });
    } catch (e) {
      // 发信失败：只记日志，不把 SMTP 细节暴露给前端
      if (e.status) throw e;
      log.warn('[forgot] 发送重置邮件失败：' + e.message);
      return res.json({
        ok: true,
        sent: false,
        cooldown: emailCode.COOLDOWN_SEC,
        expiresIn: emailCode.TTL_MIN * 60,
        mailMode: isConsoleMode() ? 'console' : 'smtp'
      });
    }

    audit({
      actor: { id: user.id, username: user.username },
      action: 'password_forgot',
      detail: `向 ${email} 发送重置验证码`,
      req
    });
    const exposeCode =
      process.env.DEV_CODE_HINT === 'true' ||
      (result.consoleMode && process.env.NODE_ENV !== 'production');
    res.json({
      ok: true,
      sent: true,
      cooldown: result.cooldown,
      expiresIn: result.expiresIn,
      mailMode: result.consoleMode ? 'console' : 'smtp',
      ...(exposeCode ? { devCode: result.code } : {})
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 忘记密码：校验验证码并重置 ---------------- */
router.post('/reset', (req, res, next) => {
  try {
    if (settings.get('email_enabled') === 'false') {
      throw httpError(400, '邮箱验证未启用，无法自助重置密码，请联系管理员');
    }
    const email = String(req.body.email || '').trim();
    const code = String(req.body.code || '').trim();
    const password = String(req.body.password || '');

    if (!EMAIL_RE.test(email)) throw httpError(400, '邮箱格式不正确');
    if (password.length < 6) throw httpError(400, '新密码至少 6 位');

    const user = db
      .prepare('SELECT id, status, display_name, username FROM users WHERE email = ? COLLATE NOCASE')
      .get(email);
    // 无论邮箱是否存在，都走同一条错误提示，避免被用来探测账号
    if (!user) throw httpError(400, '邮箱验证码不正确');
    if (user.status !== 'active') throw httpError(403, '该账号已被停用，请联系管理员');

    emailCode.verify({ email, purpose: 'reset', code });

    db.prepare('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?').run(
      bcrypt.hashSync(password, 10),
      nowIso(),
      user.id
    );
    // 密码已重置：踢掉该用户全部会话，必须重新登录
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    audit({ actor: { id: user.id, username: user.username }, action: 'password_reset', detail: '通过邮箱验证码重置密码', req });

    // 邮件告知（失败不阻断）
    const resetMail = require('../mail_templates').renderMail('securityNotice', {
      ownerName: user.display_name,
      actionText: '密码已重置'
    });
    sendMail({
      to: email,
      toName: user.display_name,
      type: 'reset_notice',
      actor: { id: user.id, username: email },
      subject: '【学习周报】密码已重置',
      text: `你的账号密码已于 ${new Date().toLocaleString('zh-CN')} 重置。若非本人操作，请立即联系管理员。`,
      html: resetMail.html,
      theme: resetMail.theme
    }).catch((e) => console.error('[reset] 通知邮件发送失败：', e.message));

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
