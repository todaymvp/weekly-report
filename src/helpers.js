'use strict';

const { db } = require('./db');

const nowIso = () => new Date().toISOString();

/** 返回某天所在自然周（周一为起点）的 YYYY-MM-DD */
function weekStartOf(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  if (Number.isNaN(d.getTime())) return null;
  const day = (d.getDay() + 6) % 7; // 周一=0
  d.setDate(d.getDate() - day);
  return fmtDate(d);
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function weekEndOf(weekStart) {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return fmtDate(d);
}

/** 计算连续提交周数（从当前周或上一周往前推） */
function calcStreak(weekStarts) {
  const set = new Set(weekStarts);
  const cur = weekStartOf();
  const prev = (ws) => {
    const d = new Date(ws + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    return fmtDate(d);
  };
  let cursor = set.has(cur) ? cur : prev(cur);
  if (!set.has(cursor)) return 0;
  let n = 0;
  while (set.has(cursor)) {
    n += 1;
    cursor = prev(cursor);
  }
  return n;
}

function notify({ userId, actorId, type, targetType = '', targetId = null, message = '' }) {
  if (!userId) return;
  if (actorId && Number(actorId) === Number(userId)) return; // 不给自己发通知
  db.prepare(
    `INSERT INTO notifications (user_id, actor_id, type, target_type, target_id, message, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(userId, actorId || null, type, targetType, targetId, message, nowIso());
}

/** 解析正文中的 @用户名 并发出提及通知 */
function notifyMentions({ text, actorId, targetType, targetId }) {
  const names = new Set();
  const re = /@([A-Za-z0-9_\u4e00-\u9fa5-]{2,24})/g;
  let m;
  while ((m = re.exec(text || '')) !== null) names.add(m[1]);
  if (!names.size) return;
  const stmt = db.prepare('SELECT id, username FROM users WHERE username = ? COLLATE NOCASE');
  for (const name of names) {
    const u = stmt.get(name);
    if (u) {
      notify({
        userId: u.id,
        actorId,
        type: 'mention',
        targetType,
        targetId,
        message: '在内容中提到了你'
      });
    }
  }
}

const CATEGORIES = {
  ask: { label: '提问求助', color: '#f59e0b' },
  share: { label: '经验分享', color: '#10b981' },
  checkin: { label: '学习打卡', color: '#0ea5e9' },
  chat: { label: '闲聊灌水', color: '#8b5cf6' }
};

/** 头像地址：有上传图片返回带版本号（文件名）的 URL，用于长缓存 + 换图即刷新 */
function avatarUrlOf(row) {
  if (!row) return '';
  const file = row.avatar_file || '';
  if (!file) return '';
  const version = String(file).replace(/\.[a-z0-9]+$/i, '');
  return `/api/users/${row.id}/avatar?v=${encodeURIComponent(version)}`;
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    studentId: row.student_id || '',
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    avatarUrl: avatarUrlOf(row),
    bio: row.bio,
    role: row.role,
    status: row.status,
    createdAt: row.created_at
  };
}

/** 取一批用户 id 的公开信息，返回 Map */
function usersMap(ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = new Map();
  if (!uniq.length) return map;
  const ph = uniq.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT * FROM users WHERE id IN (${ph})`)
    .all(...uniq);
  rows.forEach((r) => map.set(r.id, publicUser(r)));
  return map;
}

/** 批量查询当前用户对一批目标的点赞状态 */
function likedSet(userId, targetType, ids) {
  if (!userId || !ids.length) return new Set();
  const ph = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT target_id FROM likes WHERE user_id = ? AND target_type = ? AND target_id IN (${ph})`
    )
    .all(userId, targetType, ...ids);
  return new Set(rows.map((r) => r.target_id));
}

function likeCount(targetType, targetId) {
  const r = db
    .prepare('SELECT COUNT(*) AS c FROM likes WHERE target_type = ? AND target_id = ?')
    .get(targetType, targetId);
  return r ? r.c : 0;
}

function commentCount(targetType, targetId) {
  const r = db
    .prepare('SELECT COUNT(*) AS c FROM comments WHERE target_type = ? AND target_id = ?')
    .get(targetType, targetId);
  return r ? r.c : 0;
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function str(v, maxLen = 5000) {
  if (v === undefined || v === null) return '';
  return String(v).slice(0, maxLen);
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/* ---------------- 项目组权限 ---------------- */
function groupRole(groupId, userId) {
  if (!groupId || !userId) return null;
  const row = db
    .prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(groupId, userId);
  return row ? row.role : null;
}

/** admin 或组长可管理该组 */
function canManageGroup(groupId, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return groupRole(groupId, user.id) === 'leader';
}

function isGroupMember(groupId, userId) {
  return !!groupRole(groupId, userId);
}

function myGroupIds(userId) {
  return db
    .prepare('SELECT group_id FROM group_members WHERE user_id = ?')
    .all(userId)
    .map((r) => r.group_id);
}

module.exports = {
  nowIso,
  weekStartOf,
  weekEndOf,
  calcStreak,
  notify,
  notifyMentions,
  CATEGORIES,
  publicUser,
  avatarUrlOf,
  usersMap,
  likedSet,
  likeCount,
  commentCount,
  clamp,
  str,
  httpError,
  groupRole,
  canManageGroup,
  isGroupMember,
  myGroupIds
};

/** 站点对外地址（后台设置优先，其次环境变量，最后默认值） */
function siteUrl() {
  let v = '';
  try {
    v = require('./settings').get('site_url');
  } catch (e) {
    v = '';
  }
  if (!v) v = process.env.SITE_URL || 'https://example.com';
  return String(v).replace(/\/+$/, '');
}

module.exports.siteUrl = siteUrl;
