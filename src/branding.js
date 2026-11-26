'use strict';

/**
 * 站点品牌资源（管理员可上传自己的 Logo）
 *   DATA_DIR/branding/logo-<rand>.<ext>
 *   settings.site_logo = 文件名
 * 仅接受 png / jpg / webp（按文件头校验），避免 SVG 带来的脚本风险。
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, DATA_DIR } = require('./db');
const { sniffImage, EXT_BY_MIME } = require('./imageinfo');

const DIR = path.join(DATA_DIR, 'branding');
fs.mkdirSync(DIR, { recursive: true });

const SETTING_KEY = 'site_logo';
const MAX = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return cb(new Error('Logo 仅支持 png / jpg / webp'));
    cb(null, true);
  }
}).single('logo');

function current() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTING_KEY);
  return row ? row.value : '';
}

function save(file) {
  const mime = sniffImage(file.buffer);
  if (!mime) {
    const err = new Error('文件内容不是合法图片');
    err.status = 400;
    throw err;
  }
  const name = `logo-${crypto.randomBytes(6).toString('hex')}${EXT_BY_MIME[mime]}`;
  fs.writeFileSync(path.join(DIR, name), file.buffer);
  const old = current();
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(SETTING_KEY, name);
  if (old && old !== name) fs.promises.unlink(path.join(DIR, path.basename(old))).catch(() => {});
  return name;
}

function clear() {
  const old = current();
  db.prepare("DELETE FROM settings WHERE key = ?").run(SETTING_KEY);
  if (old) fs.promises.unlink(path.join(DIR, path.basename(old))).catch(() => {});
}

module.exports = { DIR, MAX, upload, save, clear, current, SETTING_KEY };
