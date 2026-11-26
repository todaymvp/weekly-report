'use strict';

/** 方向分组：内置默认值之外，用户可以在写周报时自行新增 */

const express = require('express');
const { db } = require('../db');
const { nowIso, str, httpError } = require('../helpers');
const { requireAuth } = require('../auth');

const router = express.Router();

const NAME_MAX = 12;

function withCounts() {
  return db
    .prepare(
      `SELECT g.id, g.name, g.created_by, g.created_at,
              (SELECT COUNT(*) FROM reports r WHERE r.category = g.name) AS count
       FROM report_groups g ORDER BY g.id ASC`
    )
    .all()
    .map((g) => ({ id: g.id, name: g.name, createdAt: g.created_at, count: g.count }));
}

router.get('/', requireAuth, (_req, res, next) => {
  try {
    res.json({ items: withCounts() });
  } catch (e) {
    next(e);
  }
});

router.post('/', requireAuth, (req, res, next) => {
  try {
    const name = str(req.body.name, 40).replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > NAME_MAX) throw httpError(400, `分组名称需 2-${NAME_MAX} 个字`);
    if (/[<>&"'`]/.test(name)) throw httpError(400, '分组名称不能包含 < > & " \' ` 等字符');
    if (db.prepare('SELECT id FROM report_groups WHERE name = ? COLLATE NOCASE').get(name))
      throw httpError(409, '同名分组已存在');

    const info = db
      .prepare('INSERT INTO report_groups (name, created_by, created_at) VALUES (?, ?, ?)')
      .run(name, req.user.id, nowIso());
    const row = db.prepare('SELECT id, name FROM report_groups WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ group: { id: row.id, name: row.name, count: 0 } });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireAuth, (req, res, next) => {
  try {
    const g = db.prepare('SELECT * FROM report_groups WHERE id = ?').get(req.params.id);
    if (!g) throw httpError(404, '分组不存在');
    if (req.user.role !== 'admin' && g.created_by !== req.user.id) throw httpError(403, '无权删除该分组');
    const used = db.prepare('SELECT COUNT(*) AS c FROM reports WHERE category = ?').get(g.name).c;
    if (used > 0) throw httpError(409, `该分组下还有 ${used} 篇周报，先把它们改到别的分组再删除`);
    db.prepare('DELETE FROM report_groups WHERE id = ?').run(g.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
