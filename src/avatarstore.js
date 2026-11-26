'use strict';

/**
 * 头像存储（用户自助上传 / 管理员代传 共用）
 *   saveAvatar(userId, buffer)  校验文件头 → 落盘 → 写 users.avatar_file → 删旧图
 *   clearAvatar(userId)         清空头像并删文件
 *   uploadAvatar                multer 中间件（字段名 avatar，4MB，扩展名白名单）
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, AVATAR_DIR } = require('./db');
const { sniffImage, EXT_BY_MIME } = require('./imageinfo');

const MAX_AVATAR = 4 * 1024 * 1024; // 4MB
const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

function removeAvatarFile(file) {
  if (!file) return;
  const p = path.join(AVATAR_DIR, path.basename(String(file)));
  if (!p.startsWith(path.resolve(AVATAR_DIR) + path.sep)) return;
  fs.promises.unlink(p).catch(() => {});
}

function saveAvatar(userId, buffer) {
  const mime = sniffImage(buffer);
  if (!mime) {
    const err = new Error('文件内容不是合法图片');
    err.status = 400;
    throw err;
  }
  const ext = EXT_BY_MIME[mime];
  const stored = `u${userId}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(AVATAR_DIR, stored), buffer);

  const old = db.prepare('SELECT avatar_file FROM users WHERE id = ?').get(userId);
  db.prepare('UPDATE users SET avatar_file = ? WHERE id = ?').run(stored, userId);
  if (old && old.avatar_file && old.avatar_file !== stored) removeAvatarFile(old.avatar_file);
  return stored;
}

function clearAvatar(userId) {
  const old = db.prepare('SELECT avatar_file FROM users WHERE id = ?').get(userId);
  db.prepare("UPDATE users SET avatar_file = '' WHERE id = ?").run(userId);
  if (old && old.avatar_file) removeAvatarFile(old.avatar_file);
}

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return cb(new Error('头像仅支持 png / jpg / webp / gif'));
    cb(null, true);
  }
}).single('avatar');

function avatarUploadError(res, err) {
  const msg = err && err.code === 'LIMIT_FILE_SIZE' ? '头像不能超过 4MB' : (err && err.message) || '上传失败';
  return res.status(400).json({ error: msg });
}

module.exports = { saveAvatar, clearAvatar, uploadAvatar, avatarUploadError, MAX_AVATAR };
