'use strict';

const crypto = require('crypto');
const { db } = require('./db');
const { nowIso, publicUser } = require('./helpers');

const COOKIE_NAME = 'wrs_sid';
const SESSION_DAYS = 14;

function createSession(userId) {
  const id = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    id,
    userId,
    nowIso(),
    expires.toISOString()
  );
  return { id, expires };
}

function destroySession(id) {
  if (id) db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

function purgeExpired() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso());
}

/** 挂载 req.user / req.sessionId（不强制登录） */
function attachUser(req, _res, next) {
  req.user = null;
  req.sessionId = null;
  const sid = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (!sid) return next();
  const row = db
    .prepare(
      `SELECT s.id AS sid, s.expires_at, u.*
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(sid);
  if (!row) return next();
  if (row.expires_at < nowIso() || row.status !== 'active') {
    destroySession(sid);
    return next();
  }
  req.sessionId = sid;
  req.user = publicUser(row);
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}

function setSessionCookie(res, sessionId, expires) {
  res.cookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    expires,
    path: '/'
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

module.exports = {
  COOKIE_NAME,
  createSession,
  destroySession,
  purgeExpired,
  attachUser,
  requireAuth,
  requireAdmin,
  setSessionCookie,
  clearSessionCookie
};
