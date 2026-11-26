'use strict';

const express = require('express');
const { db } = require('../db');
const {
  nowIso,
  notify,
  notifyMentions,
  CATEGORIES,
  usersMap,
  likedSet,
  likeCount,
  commentCount,
  clamp,
  str,
  httpError
} = require('../helpers');
const { requireAuth } = require('../auth');

const router = express.Router();

function shapePost(p, meId, userMap, withContent = true) {
  const out = {
    id: p.id,
    title: p.title,
    category: p.category,
    categoryLabel: (CATEGORIES[p.category] || {}).label || p.category,
    views: p.views,
    isPinned: !!p.is_pinned,
    isLocked: !!p.is_locked,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    author: (userMap || usersMap([p.user_id])).get(p.user_id) || null,
    likes: likeCount('post', p.id),
    liked: meId ? likedSet(meId, 'post', [p.id]).has(p.id) : false,
    comments: commentCount('post', p.id)
  };
  if (withContent) out.content = p.content;
  return out;
}

/* ---------------- 列表 ---------------- */
router.get('/', requireAuth, (req, res, next) => {
  try {
    const limit = clamp(parseInt(req.query.limit, 10) || 12, 1, 50);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const category = req.query.category && CATEGORIES[req.query.category] ? req.query.category : null;
    const q = str(req.query.q, 80).trim();
    const sort = req.query.sort === 'hot' ? 'hot' : req.query.sort === 'unanswered' ? 'unanswered' : 'new';

    const where = [];
    const params = [];
    if (category) {
      where.push('p.category = ?');
      params.push(category);
    }
    if (q) {
      where.push("(p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\')");
      const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
      params.push(like, like);
    }
    if (sort === 'unanswered') {
      where.push("NOT EXISTS (SELECT 1 FROM comments c WHERE c.target_type='post' AND c.target_id=p.id)");
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderSql =
      sort === 'hot'
        ? `ORDER BY p.is_pinned DESC, (p.views * 1.0 + p.views) DESC, p.created_at DESC`
        : 'ORDER BY p.is_pinned DESC, p.created_at DESC';

    const total = db.prepare(`SELECT COUNT(*) AS c FROM posts p ${whereSql}`).get(...params).c;
    const rows = db
      .prepare(`SELECT p.* FROM posts p ${whereSql} ${orderSql} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);
    const userMap = usersMap(rows.map((p) => p.user_id));

    const counts = {};
    for (const key of Object.keys(CATEGORIES)) {
      counts[key] = db.prepare('SELECT COUNT(*) AS c FROM posts WHERE category = ?').get(key).c;
    }

    res.json({
      total,
      counts,
      items: rows.map((p) => shapePost(p, req.user.id, userMap, false))
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 详情（含浏览数 +1） ---------------- */
router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!p) throw httpError(404, '帖子不存在');
    db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(p.id);
    p.views += 1;
    const post = shapePost(p, req.user.id, usersMap([p.user_id]));
    post.canEdit = p.user_id === req.user.id || req.user.role === 'admin';
    res.json({ post });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 发帖 ---------------- */
router.post('/', requireAuth, (req, res, next) => {
  try {
    const title = str(req.body.title, 80).trim();
    const content = str(req.body.content, 20000).trim();
    const category = CATEGORIES[req.body.category] ? req.body.category : 'chat';
    if (title.length < 4) throw httpError(400, '标题至少 4 个字');
    if (content.length < 5) throw httpError(400, '正文至少 5 个字');

    const ts = nowIso();
    const info = db
      .prepare(
        `INSERT INTO posts (user_id, title, content, category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, title, content, category, ts, ts);

    notifyMentions({ text: content, actorId: req.user.id, targetType: 'post', targetId: info.lastInsertRowid });

    const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ post: shapePost(p, req.user.id, usersMap([req.user.id])) });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 编辑 ---------------- */
router.put('/:id', requireAuth, (req, res, next) => {
  try {
    const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!p) throw httpError(404, '帖子不存在');
    if (p.user_id !== req.user.id && req.user.role !== 'admin') throw httpError(403, '无权编辑');

    const title = req.body.title !== undefined ? str(req.body.title, 80).trim() : p.title;
    const content = req.body.content !== undefined ? str(req.body.content, 20000).trim() : p.content;
    const category = CATEGORIES[req.body.category] ? req.body.category : p.category;
    if (title.length < 4) throw httpError(400, '标题至少 4 个字');
    if (content.length < 5) throw httpError(400, '正文至少 5 个字');

    db.prepare('UPDATE posts SET title = ?, content = ?, category = ?, updated_at = ? WHERE id = ?').run(
      title,
      content,
      category,
      nowIso(),
      p.id
    );
    const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(p.id);
    res.json({ post: shapePost(updated, req.user.id, usersMap([updated.user_id])) });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 删除 ---------------- */
router.delete('/:id', requireAuth, (req, res, next) => {
  try {
    const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!p) throw httpError(404, '帖子不存在');
    if (p.user_id !== req.user.id && req.user.role !== 'admin') throw httpError(403, '无权删除');
    db.prepare("DELETE FROM comments WHERE target_type='post' AND target_id=?").run(p.id);
    db.prepare("DELETE FROM likes WHERE target_type='post' AND target_id=?").run(p.id);
    db.prepare('DELETE FROM posts WHERE id = ?').run(p.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 点赞 ---------------- */
router.post('/:id/like', requireAuth, (req, res, next) => {
  try {
    const p = db.prepare('SELECT id, user_id, title FROM posts WHERE id = ?').get(req.params.id);
    if (!p) throw httpError(404, '帖子不存在');
    const exists = db
      .prepare("SELECT id FROM likes WHERE user_id=? AND target_type='post' AND target_id=?")
      .get(req.user.id, p.id);
    if (exists) {
      db.prepare('DELETE FROM likes WHERE id = ?').run(exists.id);
    } else {
      db.prepare("INSERT INTO likes (user_id, target_type, target_id, created_at) VALUES (?, 'post', ?, ?)").run(
        req.user.id,
        p.id,
        nowIso()
      );
      notify({
        userId: p.user_id,
        actorId: req.user.id,
        type: 'like',
        targetType: 'post',
        targetId: p.id,
        message: `赞了你的帖子《${p.title.slice(0, 30)}》`
      });
    }
    res.json({ liked: !exists, likes: likeCount('post', p.id) });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 评论 ---------------- */
router.get('/:id/comments', requireAuth, (req, res, next) => {
  try {
    const p = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
    if (!p) throw httpError(404, '帖子不存在');
    const rows = db
      .prepare("SELECT * FROM comments WHERE target_type='post' AND target_id=? ORDER BY id ASC")
      .all(p.id);
    res.json({ items: shapeComments(rows, req.user.id) });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/comments', requireAuth, (req, res, next) => {
  try {
    const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!p) throw httpError(404, '帖子不存在');
    if (p.is_locked) throw httpError(403, '该帖已被锁定，无法评论');

    const content = str(req.body.content, 2000).trim();
    if (!content) throw httpError(400, '评论不能为空');

    let parentId = null;
    if (req.body.parentId) {
      const pid = parseInt(req.body.parentId, 10);
      const parent = db
        .prepare("SELECT id FROM comments WHERE id=? AND target_type='post' AND target_id=?")
        .get(pid, p.id);
      if (!parent) throw httpError(400, '回复的评论不存在');
      parentId = parent.id;
    }

    const info = db
      .prepare(
        "INSERT INTO comments (target_type, target_id, user_id, parent_id, content, created_at) VALUES ('post', ?, ?, ?, ?, ?)"
      )
      .run(p.id, req.user.id, parentId, content, nowIso());

    notify({
      userId: p.user_id,
      actorId: req.user.id,
      type: 'comment',
      targetType: 'post',
      targetId: p.id,
      message: `评论了你的帖子《${p.title.slice(0, 30)}》`
    });
    if (parentId) {
      const parent = db.prepare('SELECT user_id FROM comments WHERE id = ?').get(parentId);
      if (parent) {
        notify({
          userId: parent.user_id,
          actorId: req.user.id,
          type: 'reply',
          targetType: 'post',
          targetId: p.id,
          message: '回复了你的评论'
        });
      }
    }
    notifyMentions({ text: content, actorId: req.user.id, targetType: 'post', targetId: p.id });

    const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ comment: shapeComments([row], req.user.id)[0] });
  } catch (e) {
    next(e);
  }
});

router.delete('/comments/:cid', requireAuth, (req, res, next) => {
  try {
    const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.cid);
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

/* ---------------- 管理员置顶 / 锁定 ---------------- */
router.post('/:id/moderate', requireAuth, (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw httpError(403, '需要管理员权限');
    const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!p) throw httpError(404, '帖子不存在');
    const pin = req.body.isPinned === undefined ? p.is_pinned : req.body.isPinned ? 1 : 0;
    const lock = req.body.isLocked === undefined ? p.is_locked : req.body.isLocked ? 1 : 0;
    db.prepare('UPDATE posts SET is_pinned = ?, is_locked = ? WHERE id = ?').run(pin, lock, p.id);
    res.json({ ok: true, isPinned: !!pin, isLocked: !!lock });
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

module.exports = router;
