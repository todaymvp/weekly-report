'use strict';

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, UPLOAD_DIR } = require('../db');
const {
  nowIso,
  weekStartOf,
  weekEndOf,
  calcStreak,
  notify,
  notifyMentions,
  CATEGORIES,
  usersMap,
  avatarUrlOf,
  likedSet,
  likeCount,
  commentCount,
  clamp,
  str,
  httpError,
  isGroupMember, siteUrl } = require('../helpers');
const { requireAuth } = require('../auth');
const settings = require('../settings');
const { weekNumber: weekNumberOf } = require('../reminders');
const { sendMail } = require('../mailer');
const { audit } = require('../audit');
const { renderMarkdown } = require('../md-render');

const router = express.Router();

/* ---------------- 附件上传（白名单 + 随机文件名） ---------------- */
const ALLOWED_EXT = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.md', '.txt', '.csv',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip'
]);
const MAX_UPLOAD = 10 * 1024 * 1024; // 10MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD, files: 5 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return cb(new Error('不支持的文件类型'));
    cb(null, true);
  }
}).array('files', 5);

/* ---------------- 工具 ---------------- */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeWeek(input) {
  let ws = weekStartOf();
  if (input) {
    if (!DATE_RE.test(String(input))) throw httpError(400, '周起始日期格式应为 YYYY-MM-DD');
    ws = weekStartOf(String(input));
    if (!ws) throw httpError(400, '周起始日期不合法');
  }
  return ws;
}

/** 周报可挂到某个项目组，但必须是该组成员 */
function resolveGroupId(raw, userId) {
  if (raw === undefined || raw === null || raw === '' || raw === 0 || raw === '0') return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!isGroupMember(id, userId)) throw httpError(403, '你不属于该项目组，无法关联');
  return id;
}

function parseTags(raw) {  if (Array.isArray(raw)) raw = raw.join(',');
  return String(raw || '')
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((t) => t.slice(0, 16))
    .join(',');
}

/** 方向分组：返回库里登记过的标准名称，未登记的返回空串（当作未分组） */
function normalizeCategory(raw) {
  const v = str(raw, 24).trim();
  if (!v) return '';
  const row = db.prepare('SELECT name FROM report_groups WHERE name = ? COLLATE NOCASE').get(v);
  return row ? row.name : '';
}

/* ---------------- 评论邮件通知 ---------------- */
function escMail(s) {
  return String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

// 同一人 + 同一篇周报，1 分钟内最多发 3 封评论邮件（内存计数，重启即清零）
const COMMENT_MAIL_WINDOW_MS = 60 * 1000;
const COMMENT_MAIL_MAX = 3;
const commentMailHits = new Map();

function allowCommentMail(actorId, reportId) {
  const key = `${actorId}:${reportId}`;
  const now = Date.now();
  const hits = (commentMailHits.get(key) || []).filter((t) => now - t < COMMENT_MAIL_WINDOW_MS);
  if (hits.length >= COMMENT_MAIL_MAX) {
    commentMailHits.set(key, hits);
    return false;
  }
  hits.push(now);
  commentMailHits.set(key, hits);
  // 兜底：不让 Map 无限长大
  if (commentMailHits.size > 5000) {
    for (const [k, v] of commentMailHits) if (!v.length || now - v[v.length - 1] > COMMENT_MAIL_WINDOW_MS) commentMailHits.delete(k);
  }
  return true;
}

/**
 * 有人评论周报时给作者发一封邮件
 * - 作者本人评论、作者停用、未配置邮箱、管理员关掉开关 → 不发
 * - 同一个人 10 分钟内在这篇下连发多条 → 只发第一条
 * - 任何失败只记日志，绝不影响评论本身
 */
function mailCommentToOwner({ report, owner, actor, content, isReply, parentContent }) {
  try {
    if (!owner || !owner.email) return;
    if (owner.status && owner.status !== 'active') return;
    if (Number(owner.id) === Number(actor.id)) return;
    if (settings.get('comment_mail') === 'false') return;

    // 1 分钟内同一个人在这篇下最多 3 封，超出的只留站内通知
    if (!allowCommentMail(actor.id, report.id)) return;

    const link = `${siteUrl()}/#/report/${report.id}`;
    const title = String(report.title || '').slice(0, 40);
    // 回复内容直接完整输出（最多 2000，与评论长度上限一致），不再截断成摘要
    const excerpt = String(content).replace(/\r/g, '').trim().slice(0, 2000);
    const who = actor.display_name || actor.username || '有人';
    // 文案由模板统一处理（isReply 区分回复/评论）

    const templates = require('../mail_templates');
    const mail = templates.renderMail('comment', {
      actorName: who,
      ownerName: owner.display_name || owner.username,
      reportTitle: title,
      content: excerpt,
      reportUrl: link,
      weekNumber: weekNumberOf(report.week_start),
      isReply,
      parentContent: parentContent || ''
    });
    // 回复时：主题、纯文本都要正确反映「回复了你的评论」，并把回复内容直接输出
    const subjectPrefix = isReply ? '回复了你' : '评论了';
    const plainText = isReply
      ? [
          `你好，${owner.display_name || owner.username}。`,
          '',
          `${who} 回复了你的评论：`,
          parentContent ? `你之前写道：${String(parentContent).replace(/\s+/g, ' ').trim().slice(0, 200)}` : '',
          '',
          excerpt,
          '',
          `查看对话：${link}`,
          '',
          '———',
          '此邮件由 HJSEC 周报系统自动发送，请勿直接回复。'
        ].filter((line, i) => line !== '' || (i > 0 && i < 11)).join('\n')
      : `${who}（@${actor.username}）评论了《${title}》：\n\n${excerpt}\n\n${link}`;
    sendMail({
      to: owner.email,
      toName: owner.display_name,
      type: 'comment',
      actor,
      subject: `【学习周报】${who} ${subjectPrefix}的${isReply ? '评论' : `《${title}》`}`,
      text: plainText,
      html: mail.html,
      theme: mail.theme
    }).catch((e) => console.error('[mail:comment] 发送失败：', e.message));
  } catch (e) {
    console.error('[mail:comment] 组装失败：', e.message);
  }
}


/** 从正文提取纯文本摘要（去掉 Markdown 标记），列表页「露出」更多内容用 */
function plainExcerpt(content, limit = 420) {
  let t = String(content || '');
  // 去掉代码块、图片、链接语法，保留可读文字
  t = t
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[>|]\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\r/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (t.length <= limit) return t;
  return t.slice(0, limit).replace(/\s+\S*$/, '') + '…';
}

function reportRow(r, meId, userMap) {
  const author = userMap ? userMap.get(r.user_id) : null;
  const group = r.group_id
    ? db.prepare('SELECT id, name, color FROM groups WHERE id = ?').get(r.group_id)
    : null;
  return {
    id: r.id,
    weekStart: r.week_start,
    weekEnd: weekEndOf(r.week_start),
    title: r.title,
    summary: r.summary,
    excerpt: plainExcerpt(r.content, 560),
    content: r.content,
    chars: String(r.content || '').length,
    category: r.category || '',
    tags: r.tags ? r.tags.split(',') : [],
    status: r.status,
    group: group ? { id: group.id, name: group.name, color: group.color } : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    author: author || null,
    likes: likeCount('report', r.id),
    liked: meId ? likedSet(meId, 'report', [r.id]).has(r.id) : false,
    comments: commentCount('report', r.id),
    recentComments: recentCommentsOf(r.id, 2),
    attachmentCount: db
      .prepare('SELECT COUNT(*) AS c FROM attachments WHERE report_id = ?')
      .get(r.id).c
  };
}

const RECENT_COMMENT_STMT = `SELECT c.id, c.content, c.created_at, u.display_name, u.username
  FROM comments c LEFT JOIN users u ON u.id = c.user_id
  WHERE c.target_type = 'report' AND c.target_id = ?
  ORDER BY c.id DESC LIMIT ?`;

/** 周报下面直接展示的最近评论（微信朋友圈式 2 条） */
function recentCommentsOf(reportId, limit) {
  try {
    return db
      .prepare(RECENT_COMMENT_STMT)
      .all(reportId, limit || 2)
      .reverse()
      .map((c) => ({
        id: c.id,
        content: String(c.content || '').slice(0, 120),
        createdAt: c.created_at,
        author: c.display_name || c.username || '成员'
      }));
  } catch (e) {
    return [];
  }
}

function canEdit(report, user) {
  if (!user) return false;
  return report.user_id === user.id || user.role === 'admin';
}

/* ---------------- 标签汇总（周报总览的标签筛选） ---------------- */
router.get('/tags', requireAuth, (req, res, next) => {
  try {
    const week = req.query.week && DATE_RE.test(String(req.query.week)) ? weekStartOf(String(req.query.week)) : null;
    const rows = week
      ? db.prepare("SELECT tags FROM reports WHERE tags != '' AND week_start = ?").all(week)
      : db.prepare("SELECT tags FROM reports WHERE tags != ''").all();
    const counts = new Map();
    for (const r of rows) {
      for (const raw of String(r.tags).split(',')) {
        const t = raw.trim();
        if (t) counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    const items = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
      .slice(0, 200)
      .map(([tag, count]) => ({ tag, count }));
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 提交情况：谁在哪一周交了 / 没交 ---------------- */
router.get('/status', requireAuth, (req, res, next) => {
  try {
    const n = Math.min(26, Math.max(1, parseInt(req.query.weeks, 10) || 10));
    const prevWeek = (w) => {
      const d = new Date(w + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const weeks = [];
    let cursor = weekStartOf();
    for (let i = 0; i < n; i += 1) {
      weeks.push(cursor);
      cursor = prevWeek(cursor);
    }
    const oldest = weeks[weeks.length - 1];

    // 管理员可把某些人排除在「提交情况」统计之外（例如管理员自己、不要求写周报的成员）
    let excluded = [];
    try {
      const raw = settings.get('status_excluded');
      excluded = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(excluded)) excluded = [];
    } catch (e) {
      excluded = [];
    }
    const excludedSet = new Set(excluded.map(Number));

    const users = db
      .prepare(
        "SELECT id, display_name, username, avatar_color, avatar_file, role FROM users WHERE status='active' ORDER BY id ASC"
      )
      .all()
      .filter((u) => !excludedSet.has(u.id));
    const rows = db
      .prepare('SELECT user_id, week_start, status FROM reports WHERE week_start >= ?')
      .all(oldest);

    // 同一周可能有多篇：只要有一篇已提交就算已交，草稿单独标记
    const map = new Map();
    for (const r of rows) {
      const key = `${r.user_id}|${r.week_start}`;
      const cur = map.get(key);
      if (r.status === 'submitted') map.set(key, 'submitted');
      else if (cur !== 'submitted') map.set(key, 'draft');
    }

    const items = users.map((u) => {
      const byWeek = {};
      let submittedCount = 0;
      let draftCount = 0;
      for (const w of weeks) {
        const v = map.get(`${u.id}|${w}`) || '';
        byWeek[w] = v;
        if (v === 'submitted') submittedCount += 1;
        else if (v === 'draft') draftCount += 1;
      }
      return {
        id: u.id,
        displayName: u.display_name,
        username: u.username,
        avatarColor: u.avatar_color,
        avatarUrl: avatarUrlOf(u),
        role: u.role,
        byWeek,
        submittedCount,
        draftCount
      };
    });

    res.json({
      currentWeek: weekStartOf(),
      weeks,
      items,
      users: items.length,
      excluded: excluded,
      submittedThisWeek: items.filter((u) => u.byWeek[weekStartOf()] === 'submitted').length
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 成员周报字数排行榜 ---------------- */

/**
 * GET /api/reports/leaderboard?range=week|month|all&limit=50
 * 只统计已提交的周报；字数用 SQLite LENGTH(content)，与前端「字数」口径一致。
 */
router.get('/leaderboard', requireAuth, (req, res, next) => {
  try {
    const rangeRaw = String(req.query.range || 'all');
    const range = ['week', 'month', 'all'].includes(rangeRaw) ? rangeRaw : 'all';
    const limit = clamp(parseInt(req.query.limit, 10) || 50, 1, 200);
    const ws = weekStartOf();

    const dateStr = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    let from = null;
    if (range === 'week') from = ws;
    else if (range === 'month') {
      const d = new Date(`${ws}T00:00:00`);
      d.setDate(d.getDate() - 21); // 近四周
      from = dateStr(d);
    }

    // 与「提交情况」共用排除名单（管理员、不要求写周报的成员）
    let excluded = [];
    try {
      const raw = settings.get('status_excluded');
      const parsed = raw ? JSON.parse(raw) : [];
      excluded = Array.isArray(parsed) ? parsed.map(Number) : [];
    } catch (e) {
      excluded = [];
    }
    const exSet = new Set(excluded);

    const where = ["u.status = 'active'", "r.status = 'submitted'"];
    const params = [];
    if (from) {
      where.push('r.week_start >= ?');
      params.push(from);
    }

    const rows = db
      .prepare(
        `SELECT u.id, u.display_name, u.username, u.avatar_color, u.avatar_file,
                COUNT(r.id) AS reports,
                COALESCE(SUM(LENGTH(r.content)), 0) AS chars,
                COUNT(DISTINCT r.week_start) AS weeks,
                MAX(r.week_start) AS last_week,
                COALESCE(SUM(CASE WHEN r.week_start = ? THEN LENGTH(r.content) ELSE 0 END), 0) AS week_chars
         FROM users u
         JOIN reports r ON r.user_id = u.id
         WHERE ${where.join(' AND ')}
         GROUP BY u.id
         ORDER BY chars DESC, reports DESC, u.id ASC`
      )
      .all(ws, ...params)
      .filter((r) => !exSet.has(r.id));

    const totalChars = rows.reduce((s, r) => s + r.chars, 0);
    const topChars = rows.length ? rows[0].chars : 0;

    const items = rows.slice(0, limit).map((r, i) => ({
      rank: i + 1,
      id: r.id,
      displayName: r.display_name,
      username: r.username,
      avatarUrl: avatarUrlOf(r),
      reports: r.reports,
      chars: r.chars,
      weeks: r.weeks,
      avgChars: r.reports ? Math.round(r.chars / r.reports) : 0,
      weekChars: r.week_chars,
      lastWeek: r.last_week,
      share: totalChars ? Math.round((r.chars / totalChars) * 1000) / 10 : 0,
      relative: topChars ? Math.round((r.chars / topChars) * 100) : 0
    }));

    const mine = items.find((x) => x.id === req.user.id) || null;
    const myAll = rows.findIndex((r) => r.id === req.user.id);

    res.json({
      range,
      from,
      currentWeek: ws,
      totalMembers: rows.length,
      totalChars,
      totalReports: rows.reduce((s, r) => s + r.reports, 0),
      items,
      me: mine
        ? { rank: mine.rank, chars: mine.chars, reports: mine.reports, weekChars: mine.weekChars }
        : { rank: myAll >= 0 ? myAll + 1 : items.length + 1, chars: 0, reports: 0, weekChars: 0 }
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 列表 ---------------- */
router.get('/', requireAuth, (req, res, next) => {
  try {
    const scope = req.query.scope === 'mine' ? 'mine' : 'all';
    const limit = clamp(parseInt(req.query.limit, 10) || 10, 1, 50);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const week = req.query.week && DATE_RE.test(String(req.query.week)) ? String(req.query.week) : null;
    const q = str(req.query.q, 80).trim();
    const groupId = /^\d+$/.test(String(req.query.group || '')) ? Number(req.query.group) : null;
    const tag = str(req.query.tag, 24).trim();
    const category = normalizeCategory(req.query.category);

    const where = [];
    const params = [];
    if (scope === 'mine') {
      where.push('r.user_id = ?');
      params.push(req.user.id);
    } else if (req.user.role !== 'admin') {
      // 总览里不展示别人的草稿，只保留自己的
      where.push("(r.status != 'draft' OR r.user_id = ?)");
      params.push(req.user.id);
    }
    if (groupId) {
      where.push('r.group_id = ?');
      params.push(groupId);
    }
    if (week) {
      where.push('r.week_start = ?');
      params.push(weekStartOf(week));
    }
    if (tag) {
      // tags 存成 "a,b,c"，两边补逗号做精确匹配，避免 "vi" 命中 "vit"
      where.push("(',' || r.tags || ',') LIKE ? ESCAPE '\\'");
      params.push(`%,${tag.replace(/[\\%_]/g, (m) => '\\' + m)},%`);
    }
    if (category) {
      where.push('r.category = ?');
      params.push(category);
    }
    if (q) {
      where.push('(r.title LIKE ? ESCAPE \'\\\' OR r.content LIKE ? ESCAPE \'\\\')');
      const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
      params.push(like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM reports r ${whereSql}`)
      .get(...params).c;
    const rows = db
      .prepare(
        `SELECT r.* FROM reports r ${whereSql}
         ORDER BY r.week_start DESC, r.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    const userMap = usersMap(rows.map((r) => r.user_id));
    res.json({
      total,
      items: rows.map((r) => {
        const item = reportRow(r, req.user.id, userMap);
        delete item.content;
        return item;
      })
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 个人统计 ---------------- */
router.get('/stats/me', requireAuth, (req, res, next) => {
  try {
    const uid = req.user.id;
    const weeks = db
      .prepare('SELECT week_start FROM reports WHERE user_id = ? ORDER BY week_start DESC')
      .all(uid)
      .map((r) => r.week_start);
    const agg = db.prepare('SELECT COUNT(*) AS c FROM reports WHERE user_id = ?').get(uid);
    const thisWeek = db
      .prepare(
        `SELECT COUNT(*) AS c, MAX(id) AS id,
                COALESCE(SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END), 0) AS submitted
         FROM reports WHERE user_id = ? AND week_start = ?`
      )
      .get(uid, weekStartOf());
    const chars = db
      .prepare('SELECT COALESCE(SUM(LENGTH(content)),0) AS c FROM reports WHERE user_id = ?')
      .get(uid).c;

    res.json({
      currentWeek: weekStartOf(),
      thisWeekSubmitted: thisWeek.submitted > 0,
      thisWeekId: thisWeek.id || null,
      thisWeekCount: thisWeek.c || 0,
      thisWeekSubmittedCount: thisWeek.submitted || 0,
      thisWeekDrafts: (thisWeek.c || 0) - (thisWeek.submitted || 0),
      totalReports: agg.c,
      totalChars: chars,
      avgChars: agg.c ? Math.round(chars / agg.c) : 0,
      streak: calcStreak(weeks),
      badges: buildBadges({ total: agg.c, streak: calcStreak(weeks), chars })
    });
  } catch (e) {
    next(e);
  }
});

function buildBadges({ total, streak, chars }) {
  const list = [];
  if (total >= 1) list.push({ icon: '🌱', name: '启程者', desc: '提交了第一篇周报' });
  if (total >= 5) list.push({ icon: '📚', name: '稳定输出', desc: '累计提交 5 篇周报' });
  if (total >= 20) list.push({ icon: '🏛️', name: '长期主义', desc: '累计提交 20 篇周报' });
  if (streak >= 4) list.push({ icon: '🔥', name: '四周连击', desc: '连续 4 周提交' });
  if (streak >= 12) list.push({ icon: '⚡', name: '季度全勤', desc: '连续 12 周提交' });
  if (chars >= 20000) list.push({ icon: '✍️', name: '笔耕不辍', desc: '累计书写 2 万字' });
  if (chars >= 50000) list.push({ icon: '📖', name: '五万字', desc: '累计书写 5 万字' });
  return list;
}

/* ---------------- 全局看板 ---------------- */
router.get('/stats/overview', requireAuth, (req, res, next) => {
  try {
    const ws = weekStartOf();
    const totalUsers = db.prepare("SELECT COUNT(*) AS c FROM users WHERE status='active'").get().c;
    const weekReports = db.prepare('SELECT COUNT(*) AS c FROM reports WHERE week_start = ?').get(ws).c;
    const weekUsers = db
      .prepare('SELECT COUNT(DISTINCT user_id) AS c FROM reports WHERE week_start = ?')
      .get(ws).c;
    const totalReports = db.prepare('SELECT COUNT(*) AS c FROM reports').get().c;
    const totalChars = db
      .prepare('SELECT COALESCE(SUM(LENGTH(content)),0) AS c FROM reports')
      .get().c;
    const totalPosts = db.prepare('SELECT COUNT(*) AS c FROM posts').get().c;

    // 排行榜按周报字数排（不再看学习时长）
    const top = db
      .prepare(
        `SELECT u.id, u.display_name, u.username, u.avatar_color, u.avatar_file,
                COUNT(r.id) AS reports, COALESCE(SUM(LENGTH(r.content)),0) AS chars
         FROM users u JOIN reports r ON r.user_id = u.id
         WHERE u.status='active'
         GROUP BY u.id ORDER BY chars DESC, reports DESC LIMIT 5`
      )
      .all();

    // 方向分组计数（仪表盘「分组」卡片）：以分组表为准，没有周报的也显示 0
    const groupCounts = db
      .prepare(
        `SELECT g.name AS name, COUNT(r.id) AS count
         FROM report_groups g
         LEFT JOIN reports r ON r.category = g.name
         GROUP BY g.id ORDER BY g.id ASC`
      )
      .all()
      .map((g) => ({ name: g.name, count: g.count }));

    res.json({
      currentWeek: ws,
      totalUsers,
      weekReports,
      totalReports,
      totalChars,
      totalPosts,
      groupCounts,
      participateRate: totalUsers ? Math.round((weekUsers / totalUsers) * 100) : 0,
      leaderboard: top.map((t) => ({
        id: t.id,
        displayName: t.display_name,
        username: t.username,
        avatarColor: t.avatar_color,
        avatarUrl: avatarUrlOf(t),
        reports: t.reports,
        chars: t.chars
      }))
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 详情 ---------------- */
/* ---------------- 用户主页：某个人的全部周报（点任意头像进入） ---------------- */
router.get('/by-user/:uid', requireAuth, (req, res, next) => {
  try {
    const uid = Number(req.params.uid);
    if (!Number.isInteger(uid) || uid <= 0) throw httpError(404, '用户不存在');

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
    if (!row) throw httpError(404, '用户不存在');

    const isSelf = req.user.id === uid;
    const isAdmin = req.user.role === 'admin';
    const limit = clamp(parseInt(req.query.limit, 10) || 20, 1, 50);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    // 别人只能看到已提交的周报；本人和管理员连草稿一起看
    const visible = isSelf || isAdmin ? '1=1' : "r.status = 'submitted'";

    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM reports r WHERE r.user_id = ? AND ${visible}`)
      .get(uid).c;
    const rows = db
      .prepare(
        `SELECT r.* FROM reports r WHERE r.user_id = ? AND ${visible}
         ORDER BY r.week_start DESC, r.created_at DESC LIMIT ? OFFSET ?`
      )
      .all(uid, limit, offset);

    const userMap = usersMap([uid]);
    const items = rows.map((r) => {
      const it = reportRow(r, req.user.id, userMap);
      delete it.content;
      return it;
    });

    const sum = db
      .prepare(
        `SELECT COUNT(*) AS reports, COALESCE(SUM(LENGTH(content)),0) AS chars,
                COUNT(DISTINCT week_start) AS weeks
         FROM reports WHERE user_id = ? AND status = 'submitted'`
      )
      .get(uid);
    const weekStarts = db
      .prepare("SELECT DISTINCT week_start FROM reports WHERE user_id = ? AND status = 'submitted'")
      .all(uid)
      .map((r2) => r2.week_start);

    res.json({
      user: userMap.get(uid) || null,
      isSelf,
      total,
      stats: {
        reports: sum.reports,
        chars: sum.chars,
        weeks: sum.weeks,
        streak: calcStreak(weekStarts)
      },
      items
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    if (!r) throw httpError(404, '周报不存在');
    const atts = db
      .prepare('SELECT id, filename, mime, size, created_at FROM attachments WHERE report_id = ? ORDER BY id')
      .all(r.id);
    const item = reportRow(r, req.user.id, usersMap([r.user_id]));
    item.attachments = atts.map((a) => ({
      id: a.id,
      filename: a.filename,
      mime: a.mime,
      size: a.size,
      createdAt: a.created_at
    }));
    item.canEdit = canEdit(r, req.user);
    // 服务端预渲染正文（与前端同一渲染器，带缓存）
    item.html = renderMarkdown(r.content);
    res.json({ report: item });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 新建 ---------------- */
router.post('/', requireAuth, (req, res, next) => {
  try {
    const weekStart = normalizeWeek(req.body.weekStart);
    const title = str(req.body.title, 80).trim();
    const content = str(req.body.content, 50000);
    const summary = str(req.body.summary, 120).trim();
    const status = req.body.status === 'draft' ? 'draft' : 'submitted';
    const tags = parseTags(req.body.tags);
    const category = normalizeCategory(req.body.category);

    if (title.length < 2) throw httpError(400, '标题至少 2 个字');
    if (status === 'submitted' && content.trim().length < 10)
      throw httpError(400, '正文至少 10 个字才能提交');

    const ts = nowIso();
    const groupId = resolveGroupId(req.body.groupId, req.user.id);
    const info = db
      .prepare(
        `INSERT INTO reports (user_id, week_start, title, content, category, tags, summary, status, group_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, weekStart, title, content, category, tags, summary, status, groupId, ts, ts);

    const id = info.lastInsertRowid;
    if (status === 'submitted') {
      notifyMentions({ text: content, actorId: req.user.id, targetType: 'report', targetId: id });
    }
    const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    audit({
      actor: req.user,
      action: 'report_create',
      targetType: 'report',
      targetId: id,
      detail: `${status === 'draft' ? '新建草稿' : '提交周报'}《${title}》`,
      req
    });
    res.status(201).json({ report: reportRow(r, req.user.id, usersMap([req.user.id])) });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 更新 ---------------- */
router.put('/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    if (!r) throw httpError(404, '周报不存在');
    if (!canEdit(r, req.user)) throw httpError(403, '无权修改他人的周报');

    const title = req.body.title !== undefined ? str(req.body.title, 80).trim() : r.title;
    const content = req.body.content !== undefined ? str(req.body.content, 50000) : r.content;
    const summary = req.body.summary !== undefined ? str(req.body.summary, 120).trim() : r.summary;
    const category =
      req.body.category !== undefined ? normalizeCategory(req.body.category) : r.category || '';
    const tags = req.body.tags !== undefined ? parseTags(req.body.tags) : r.tags;
    const status = req.body.status === 'draft' ? 'draft' : req.body.status === 'submitted' ? 'submitted' : r.status;

    if (title.length < 2) throw httpError(400, '标题至少 2 个字');
    if (status === 'submitted' && content.trim().length < 10)
      throw httpError(400, '正文至少 10 个字才能提交');

    const groupId =
      req.body.groupId !== undefined ? resolveGroupId(req.body.groupId, req.user.id) : r.group_id;
    // 允许改周次：周一的周报如果记的是上一周内容，可以直接归到上一周
    const weekStart =
      req.body.weekStart !== undefined && req.body.weekStart !== null && req.body.weekStart !== ''
        ? normalizeWeek(req.body.weekStart)
        : r.week_start;

    db.prepare(
      `UPDATE reports SET title = ?, content = ?, category = ?, tags = ?, summary = ?, status = ?, group_id = ?, week_start = ?, updated_at = ?
       WHERE id = ?`
    ).run(title, content, category, tags, summary, status, groupId, weekStart, nowIso(), r.id);
    audit({
      actor: req.user,
      action: 'report_update',
      targetType: 'report',
      targetId: r.id,
      detail: `修改《${title}》${r.status !== status ? `（${r.status} → ${status}）` : ''}`,
      req
    });

    const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(r.id);
    res.json({ report: reportRow(updated, req.user.id, usersMap([updated.user_id])) });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 删除 ---------------- */
router.delete('/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    if (!r) throw httpError(404, '周报不存在');
    if (!canEdit(r, req.user)) throw httpError(403, '无权删除他人的周报');

    const files = db.prepare('SELECT stored_name FROM attachments WHERE report_id = ?').all(r.id);
    db.prepare('DELETE FROM attachments WHERE report_id = ?').run(r.id);
    db.prepare("DELETE FROM comments WHERE target_type = 'report' AND target_id = ?").run(r.id);
    db.prepare("DELETE FROM likes WHERE target_type = 'report' AND target_id = ?").run(r.id);
    db.prepare('DELETE FROM reports WHERE id = ?').run(r.id);
    for (const f of files) {
      fs.promises.unlink(path.join(UPLOAD_DIR, f.stored_name)).catch(() => {});
    }
    audit({
      actor: req.user,
      action: 'report_delete',
      targetType: 'report',
      targetId: r.id,
      detail: `删除《${String(r.title || '').slice(0, 40)}》`,
      req
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 点赞 ---------------- */
router.post('/:id/like', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare('SELECT id, user_id, title FROM reports WHERE id = ?').get(req.params.id);
    if (!r) throw httpError(404, '周报不存在');
    const exists = db
      .prepare("SELECT id FROM likes WHERE user_id = ? AND target_type = 'report' AND target_id = ?")
      .get(req.user.id, r.id);
    if (exists) {
      db.prepare('DELETE FROM likes WHERE id = ?').run(exists.id);
    } else {
      db.prepare(
        "INSERT INTO likes (user_id, target_type, target_id, created_at) VALUES (?, 'report', ?, ?)"
      ).run(req.user.id, r.id, nowIso());
      notify({
        userId: r.user_id,
        actorId: req.user.id,
        type: 'like',
        targetType: 'report',
        targetId: r.id,
        message: `赞了你的周报《${r.title.slice(0, 30)}》`
      });
    }
    res.json({ liked: !exists, likes: likeCount('report', r.id) });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 评论（周报） ---------------- */
router.get('/:id/comments', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare('SELECT id FROM reports WHERE id = ?').get(req.params.id);
    if (!r) throw httpError(404, '周报不存在');
    const rows = db
      .prepare("SELECT * FROM comments WHERE target_type='report' AND target_id=? ORDER BY id ASC")
      .all(r.id);
    res.json({ items: shapeComments(rows, req.user.id) });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/comments', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare('SELECT id, user_id, title FROM reports WHERE id = ?').get(req.params.id);
    if (!r) throw httpError(404, '周报不存在');
    const content = str(req.body.content, 2000).trim();
    if (!content) throw httpError(400, '评论不能为空');

    // 回复：校验被回复的评论确实属于这篇周报
    let parentId = req.body.parentId ? Number(req.body.parentId) : null;
    let parent = null;
    if (parentId) {
      parent = db
        .prepare("SELECT id, user_id, content FROM comments WHERE id = ? AND target_type='report' AND target_id = ?")
        .get(parentId, r.id);
      if (!parent) parentId = null; // 父评论不存在就当普通评论
    }

    const ts = nowIso();
    const info = db
      .prepare(
        "INSERT INTO comments (target_type, target_id, user_id, parent_id, content, created_at) VALUES ('report', ?, ?, ?, ?, ?)"
      )
      .run(r.id, req.user.id, parentId, content, ts);

    const isReply = !!parentId;
    // 回复时通知被回复的人，否则通知周报作者
    const notifyUserId = isReply ? parent.user_id : r.user_id;
    if (Number(notifyUserId) !== Number(req.user.id)) {
      notify({
        userId: notifyUserId,
        actorId: req.user.id,
        type: isReply ? 'reply' : 'comment',
        targetType: 'report',
        targetId: r.id,
        message: isReply
          ? `回复了你在《${r.title.slice(0, 30)}》下的评论`
          : `评论了你的周报《${r.title.slice(0, 30)}》`
      });
    }
    notifyMentions({ text: content, actorId: req.user.id, targetType: 'report', targetId: r.id });

    // 邮件通知（异步，失败不影响评论）：回复发给被回复者，评论发给作者
    const mailTargetId = isReply ? parent.user_id : r.user_id;
    const owner = db
      .prepare('SELECT id, email, status, display_name FROM users WHERE id = ?')
      .get(mailTargetId);
    mailCommentToOwner({
      report: r,
      owner,
      actor: req.user,
      content,
      isReply,
      parentContent: parent ? parent.content : ''
    });

    audit({
      actor: req.user,
      action: 'comment_create',
      targetType: 'report',
      targetId: r.id,
      detail: `评论《${String(r.title || '').slice(0, 30)}》：${content.replace(/\s+/g, ' ').slice(0, 80)}`,
      req
    });

    const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ comment: shapeComments([row], req.user.id)[0] });
  } catch (e) {
    next(e);
  }
});

function shapeComments(rows, meId) {
  const map = usersMap(rows.map((c) => c.user_id));
  const ids = rows.map((c) => c.id);
  const liked = likedSet(meId, 'comment', ids);
  const all = rows.map((c) => ({
    id: c.id,
    content: c.content,
    parentId: c.parent_id,
    createdAt: c.created_at,
    author: map.get(c.user_id) || null,
    likes: likeCount('comment', c.id),
    liked: liked.has(c.id),
    children: []
  }));
  const byId = new Map(all.map((c) => [c.id, c]));
  const roots = [];
  for (const c of all) {
    if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId).children.push(c);
    else roots.push(c);
  }
  return roots;
}

/* ---------------- 附件 ---------------- */
router.post('/:id/attachments', requireAuth, (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? '单个文件不能超过 10MB' : err.message || '上传失败';
      return res.status(400).json({ error: msg });
    }
    try {
      const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
      if (!r) throw httpError(404, '周报不存在');
      if (!canEdit(r, req.user)) {
        for (const f of req.files || []) fs.promises.unlink(f.path).catch(() => {});
        throw httpError(403, '无权为该周报添加附件');
      }
      if (!req.files || !req.files.length) throw httpError(400, '没有选择文件');

      const ts = nowIso();
      const stmt = db.prepare(
        `INSERT INTO attachments (report_id, user_id, filename, stored_name, mime, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      const added = [];
      for (const f of req.files) {
        const original = Buffer.from(f.originalname, 'latin1').toString('utf8').slice(0, 120);
        const info = stmt.run(r.id, req.user.id, original, f.filename, f.mimetype || '', f.size, ts);
        added.push({ id: info.lastInsertRowid, filename: original, mime: f.mimetype, size: f.size });
      }
      res.status(201).json({ items: added });
    } catch (e) {
      next(e);
    }
  });
});

router.delete('/:id/attachments/:aid', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    if (!r) throw httpError(404, '周报不存在');
    if (!canEdit(r, req.user)) throw httpError(403, '无权操作');
    const a = db
      .prepare('SELECT * FROM attachments WHERE id = ? AND report_id = ?')
      .get(req.params.aid, r.id);
    if (!a) throw httpError(404, '附件不存在');
    db.prepare('DELETE FROM attachments WHERE id = ?').run(a.id);
    fs.promises.unlink(path.join(UPLOAD_DIR, a.stored_name)).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
module.exports.CATEGORIES = CATEGORIES;
