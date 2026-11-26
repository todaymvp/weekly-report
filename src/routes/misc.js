'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const { db, UPLOAD_DIR } = require('../db');
const { usersMap, httpError, nowIso, notify, avatarUrlOf } = require('../helpers');
const { requireAuth } = require('../auth');
const settings = require('../settings');

const router = express.Router();

/* ---------------- 通知 ---------------- */
router.get('/notifications', requireAuth, (req, res, next) => {
  try {
    const rows = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50')
      .all(req.user.id);
    const actors = usersMap(rows.map((n) => n.actor_id));
    res.json({
      unread: db
        .prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0')
        .get(req.user.id).c,
      items: rows.map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        targetType: n.target_type,
        targetId: n.target_id,
        isRead: !!n.is_read,
        createdAt: n.created_at,
        actor: actors.get(n.actor_id) || null
      }))
    });
  } catch (e) {
    next(e);
  }
});

router.post('/notifications/read-all', requireAuth, (req, res, next) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 评论点赞 / 删除（帖子与周报通用） ---------------- */
router.post('/comments/:id/like', requireAuth, (req, res, next) => {
  try {
    const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
    if (!c) throw httpError(404, '评论不存在');
    const exists = db
      .prepare("SELECT id FROM likes WHERE user_id=? AND target_type='comment' AND target_id=?")
      .get(req.user.id, c.id);
    if (exists) {
      db.prepare('DELETE FROM likes WHERE id = ?').run(exists.id);
    } else {
      db.prepare(
        "INSERT INTO likes (user_id, target_type, target_id, created_at) VALUES (?, 'comment', ?, ?)"
      ).run(req.user.id, c.id, nowIso());
      notify({
        userId: c.user_id,
        actorId: req.user.id,
        type: 'like',
        targetType: c.target_type,
        targetId: c.target_id,
        message: '赞了你的评论'
      });
    }
    const count = db
      .prepare("SELECT COUNT(*) AS c FROM likes WHERE target_type='comment' AND target_id=?")
      .get(c.id).c;
    res.json({ liked: !exists, likes: count });
  } catch (e) {
    next(e);
  }
});

router.delete('/comments/:id', requireAuth, (req, res, next) => {
  try {
    const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
    if (!c) throw httpError(404, '评论不存在');
    if (c.user_id !== req.user.id && req.user.role !== 'admin') throw httpError(403, '无权删除');
    db.prepare('DELETE FROM comments WHERE parent_id = ?').run(c.id);
    db.prepare('DELETE FROM comments WHERE id = ?').run(c.id);
    db.prepare("DELETE FROM likes WHERE target_type='comment' AND target_id=?").run(c.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 周次基准（学期起始周设置；默认值来自 appsettings.json） ---------------- */
function getWeekBase() {
  const start = settings.get('week_base_start');
  const num = parseInt(settings.get('week_base_number'), 10) || 1;
  return { start: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : '2026-09-14', num };
}

router.get('/week-base', requireAuth, (req, res) => {
  res.json(getWeekBase());
});

/* ---------------- 附件下载 ---------------- */
function safeFilename(name) {
  // 仅保留安全字符，阻止响应头注入 / 路径穿越
  return String(name)
    .replace(/[\r\n"\\/]/g, '_')
    .replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
    .slice(0, 100) || 'download';
}

router.get('/attachments/:id', requireAuth, (req, res, next) => {
  try {
    const a = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
    if (!a) throw httpError(404, '附件不存在');
    // stored_name 由服务端生成（随机 hex + 白名单后缀），此处再做一次路径校验
    const base = path.basename(a.stored_name);
    const filePath = path.join(UPLOAD_DIR, base);
    if (!filePath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) throw httpError(400, '非法路径');
    if (!fs.existsSync(filePath)) throw httpError(404, '文件已丢失');

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename(a.filename)}"; filename*=UTF-8''${encodeURIComponent(a.filename)}`
    );
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    next(e);
  }
});

/* ---------------- 成员列表（带周报统计，点进去看某人的全部周报） ---------------- */
router.get('/members', requireAuth, (req, res, next) => {
  try {
    const rows = db
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.avatar_color, u.avatar_file, u.bio,
                u.student_id, u.role, u.status, u.created_at,
                COUNT(r.id) AS reports,
                COALESCE(SUM(LENGTH(r.content)), 0) AS chars,
                MAX(r.week_start) AS last_week
         FROM users u
         LEFT JOIN reports r ON r.user_id = u.id AND r.status = 'submitted'
         WHERE u.status = 'active'
         GROUP BY u.id
         ORDER BY reports DESC, u.id ASC`
      )
      .all();

    res.json({
      total: rows.length,
      items: rows.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatarColor: u.avatar_color,
        avatarUrl: avatarUrlOf(u),
        bio: u.bio || '',
        studentId: u.student_id || '',
        role: u.role,
        createdAt: u.created_at,
        reports: u.reports,
        chars: u.chars,
        lastWeek: u.last_week || ''
      }))
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 最近评论（首页 Feed 用） ---------------- */
router.get('/comments/recent', requireAuth, (req, res, next) => {
  try {
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const rows = db
      .prepare(
        `SELECT c.id, c.content, c.created_at, c.target_id, c.parent_id,
                u.id AS uid, u.display_name, u.username, u.avatar_color, u.avatar_file,
                r.title AS report_title, r.week_start AS report_week,
                ru.id AS rid, ru.display_name AS report_author_name, ru.username AS report_author_username,
                ru.avatar_color AS report_author_color, ru.avatar_file AS report_author_file,
                pu.id AS puid, pu.display_name AS parent_author_name, pu.username AS parent_author_username
         FROM comments c
         JOIN users u ON u.id = c.user_id
         LEFT JOIN reports r ON r.id = c.target_id AND c.target_type = 'report'
         LEFT JOIN users ru ON ru.id = r.user_id
         LEFT JOIN comments pc ON pc.id = c.parent_id
         LEFT JOIN users pu ON pu.id = pc.user_id
         WHERE c.target_type = 'report'
         ORDER BY c.id DESC
         LIMIT ?`
      )
      .all(limit);

    res.json({
      items: rows.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.created_at,
        reportId: c.target_id,
        parentId: c.parent_id || null,
        isReply: !!c.parent_id,
        parentAuthor: c.puid
          ? { id: c.puid, displayName: c.parent_author_name, username: c.parent_author_username }
          : null,
        reportTitle: c.report_title || '',
        reportWeek: c.report_week || '',
        reportAuthor: c.rid
          ? {
              id: c.rid,
              displayName: c.report_author_name,
              username: c.report_author_username,
              avatarColor: c.report_author_color,
              avatarUrl: avatarUrlOf({ id: c.rid, avatar_file: c.report_author_file })
            }
          : null,
        author: {
          id: c.uid,
          displayName: c.display_name,
          username: c.username,
          avatarColor: c.avatar_color,
          avatarUrl: avatarUrlOf({ id: c.uid, avatar_file: c.avatar_file })
        }
      }))
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 用户搜索（用于 @ 提示 / 团队页） ---------------- */
router.get('/users', requireAuth, (req, res, next) => {
  try {
    const q = String(req.query.q || '').slice(0, 40).trim();
    const rows = q
      ? db
          .prepare(
            `SELECT * FROM users WHERE status='active'
             AND (username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\')
             ORDER BY username LIMIT 8`
          )
          .all(`%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`, `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`)
      : db.prepare("SELECT * FROM users WHERE status='active' ORDER BY created_at ASC LIMIT 8").all();
    res.json({
      items: rows.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatarColor: u.avatar_color,
        avatarUrl: avatarUrlOf(u),
        studentId: u.student_id || '',
        bio: u.bio
      }))
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
