'use strict';

/**
 * 用户头像
 *   POST   /api/users/avatar       上传/替换自己的头像（png / jpg / webp / gif）
 *   DELETE /api/users/avatar       移除头像，回退成「颜色 + 首字」
 *   GET    /api/users/:id/avatar   公开读取头像（登录页/评论区共用的图片，不需登录）
 *
 * 存储：DATA_DIR/avatars/u<id>-<random>.<ext>，文件名写进 users.avatar_file。
 * 前端会先用 canvas 裁成正方形并压到 512px，所以这里只做兜底校验（大小 / 文件头）。
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { db, AVATAR_DIR } = require('../db');
const { publicUser, avatarUrlOf, httpError } = require('../helpers');
const { requireAuth } = require('../auth');
const { saveAvatar, clearAvatar, uploadAvatar, avatarUploadError } = require('../avatarstore');
const { audit } = require('../audit');

const router = express.Router();

/* ---------------- 上传头像 ---------------- */
router.post('/avatar', requireAuth, (req, res, next) => {
  uploadAvatar(req, res, (err) => {
    if (err) return avatarUploadError(res, err);
    try {
      if (!req.file) throw httpError(400, '没有选择图片');
      saveAvatar(req.user.id, req.file.buffer);
      audit({ actor: req.user, action: 'avatar_set', targetType: 'user', targetId: req.user.id, detail: '更新头像', req });
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      res.status(201).json({ ok: true, user: publicUser(row), avatarUrl: avatarUrlOf(row) });
    } catch (e) {
      next(e);
    }
  });
});

/* ---------------- 移除头像 ---------------- */
router.delete('/avatar', requireAuth, (req, res, next) => {
  try {
    clearAvatar(req.user.id);
    audit({ actor: req.user, action: 'avatar_clear', targetType: 'user', targetId: req.user.id, detail: '移除头像', req });
    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ ok: true, user: publicUser(fresh) });
  } catch (e) {
    next(e);
  }
});

/* ---------------- 公开读取头像 ---------------- */
router.get('/:id/avatar', (req, res, next) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) throw httpError(404, '头像不存在');
    const u = db.prepare('SELECT id, avatar_file FROM users WHERE id = ?').get(Number(req.params.id));
    if (!u || !u.avatar_file) throw httpError(404, '头像不存在');

    const file = path.basename(u.avatar_file);
    const filePath = path.join(AVATAR_DIR, file);
    if (!filePath.startsWith(path.resolve(AVATAR_DIR) + path.sep)) throw httpError(400, '非法路径');
    if (!fs.existsSync(filePath)) throw httpError(404, '头像已丢失');

    const ext = path.extname(file).toLowerCase();
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }[ext];
    res.setHeader('Content-Type', mime || 'image/jpeg');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // 文件名里带随机串，换图 URL 必变，可以放心 immutable 长缓存
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('Content-Disposition', 'inline');
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
