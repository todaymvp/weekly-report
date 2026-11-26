'use strict';

const express = require('express');
const { db } = require('../db');
const { nowIso, publicUser, str, httpError } = require('../helpers');
const { requireAuth } = require('../auth');

const router = express.Router();

function peerInfo(userId) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return u ? publicUser(u) : null;
}

/* ---------------- 会话列表 ---------------- */
router.get('/conversations', requireAuth, (req, res, next) => {
  try {
    const rows = db
      .prepare(
        `SELECT CASE WHEN from_id = ? THEN to_id ELSE from_id END AS peer_id,
                MAX(id) AS last_id
         FROM messages
         WHERE from_id = ? OR to_id = ?
         GROUP BY peer_id
         ORDER BY last_id DESC
         LIMIT 50`
      )
      .all(req.user.id, req.user.id, req.user.id);

    const unreadStmt = db.prepare(
      'SELECT COUNT(*) AS c FROM messages WHERE to_id = ? AND from_id = ? AND is_read = 0'
    );
    const lastStmt = db.prepare('SELECT * FROM messages WHERE id = ?');

    const items = rows
      .map((r) => {
        const last = lastStmt.get(r.last_id);
        const peer = peerInfo(r.peer_id);
        if (!peer || !last) return null;
        return {
          peer,
          lastMessage: last.content.slice(0, 80),
          lastFromMe: last.from_id === req.user.id,
          lastAt: last.created_at,
          unread: unreadStmt.get(req.user.id, r.peer_id).c
        };
      })
      .filter(Boolean);

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.get('/unread', requireAuth, (req, res, next) => {
  try {
    const c = db
      .prepare('SELECT COUNT(*) AS c FROM messages WHERE to_id = ? AND is_read = 0')
      .get(req.user.id).c;
    res.json({ unread: c });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 与某人的会话 ---------------- */
router.get('/:userId', requireAuth, (req, res, next) => {
  try {
    const peerId = Number(req.params.userId);
    if (peerId === req.user.id) throw httpError(400, '不能和自己私信');
    const peer = db.prepare('SELECT * FROM users WHERE id = ?').get(peerId);
    if (!peer) throw httpError(404, '用户不存在');

    const before = req.query.before ? Number(req.query.before) : null;
    const rows = db
      .prepare(
        `SELECT * FROM messages
         WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))
           ${before ? 'AND id < ?' : ''}
         ORDER BY id DESC LIMIT 60`
      )
      .all(
        ...[
          req.user.id,
          peerId,
          peerId,
          req.user.id,
          ...(before ? [before] : [])
        ]
      )
      .reverse();

    // 把对方发来的消息标记为已读
    db.prepare('UPDATE messages SET is_read = 1 WHERE to_id = ? AND from_id = ? AND is_read = 0').run(
      req.user.id,
      peerId
    );

    res.json({
      peer: publicUser(peer),
      items: rows.map((m) => ({
        id: m.id,
        content: m.content,
        fromMe: m.from_id === req.user.id,
        isRead: !!m.is_read,
        createdAt: m.created_at
      }))
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 发送 ---------------- */
router.post('/:userId', requireAuth, (req, res, next) => {
  try {
    const peerId = Number(req.params.userId);
    if (peerId === req.user.id) throw httpError(400, '不能给自己发私信');
    const peer = db.prepare('SELECT * FROM users WHERE id = ?').get(peerId);
    if (!peer) throw httpError(404, '用户不存在');
    if (peer.status !== 'active') throw httpError(400, '该用户已停用');

    const content = str(req.body.content, 1000).trim();
    if (!content) throw httpError(400, '消息不能为空');

    // 简单防刷：同一对用户 3 秒内最多 5 条
    const recent = db
      .prepare(
        `SELECT COUNT(*) AS c FROM messages
         WHERE from_id = ? AND to_id = ? AND created_at > ?`
      )
      .get(req.user.id, peerId, new Date(Date.now() - 3000).toISOString()).c;
    if (recent >= 5) throw httpError(429, '发送太快了，喘口气再发');

    const ts = nowIso();
    const info = db
      .prepare('INSERT INTO messages (from_id, to_id, content, is_read, created_at) VALUES (?, ?, ?, 0, ?)')
      .run(req.user.id, peerId, content, ts);

    res.status(201).json({
      message: {
        id: info.lastInsertRowid,
        content,
        fromMe: true,
        isRead: false,
        createdAt: ts
      }
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
