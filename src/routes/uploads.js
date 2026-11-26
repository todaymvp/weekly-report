'use strict';

/**
 * 编辑器素材接口
 *   POST /api/uploads/image     上传 Markdown 正文里要引用的图片
 *   POST /api/uploads/markdown  导入 .md 文件（读取纯文本，交给前端渲染/二次编辑）
 *   GET  /api/uploads/:id       回显图片（编辑器预览与正文渲染共用）
 *   DELETE /api/uploads/:id     删除自己上传的图片
 *
 * 与 attachments 的区别：uploads 不挂在某篇周报/帖子下，
 * 所以新建内容时就能先传图，二次编辑也不会丢图。
 */

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, UPLOAD_DIR } = require('../db');
const { nowIso, httpError } = require('../helpers');
const { requireAuth } = require('../auth');
const { sniffImage, EXT_BY_MIME } = require('../imageinfo');

const router = express.Router();

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const MAX_IMAGE = 8 * 1024 * 1024; // 8MB
const MAX_MARKDOWN = 512 * 1024; // 512KB
const MARKDOWN_EXT = new Set(['.md', '.markdown', '.mdown', '.txt']);

/* ---------------- 工具 ---------------- */
function decodeOriginalName(name) {
  // multer 按 latin1 解析文件名，这里还原成中文
  const raw = Buffer.from(String(name || ''), 'latin1').toString('utf8');
  return (
    raw
      .replace(/[\r\n"\\/]/g, '_')
      .replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
      .slice(0, 120) || 'file'
  );
}

function uploadError(res, err) {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: '文件超过大小限制' });
  }
  return res.status(400).json({ error: (err && err.message) || '上传失败' });
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!IMAGE_EXT.has(ext)) return cb(new Error('只支持 png / jpg / gif / webp 图片'));
    cb(null, true);
  }
}).single('image');

const markdownUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MARKDOWN, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!MARKDOWN_EXT.has(ext)) return cb(new Error('只支持 .md / .markdown / .txt 文件'));
    cb(null, true);
  }
}).single('file');

/* ---------------- 上传图片 ---------------- */
router.post('/image', requireAuth, (req, res, next) => {
  imageUpload(req, res, (err) => {
    if (err) return uploadError(res, err);
    try {
      const file = req.file;
      if (!file) throw httpError(400, '没有选择图片');

      const mime = sniffImage(file.buffer);
      if (!mime) throw httpError(400, '文件内容不是合法图片');

      const ext = EXT_BY_MIME[mime];
      const storedName = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
      const filename = decodeOriginalName(file.originalname);

      fs.writeFileSync(path.join(UPLOAD_DIR, storedName), file.buffer);
      const info = db
        .prepare(
          `INSERT INTO uploads (user_id, filename, stored_name, mime, size, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(req.user.id, filename, storedName, mime, file.size, nowIso());

      res.status(201).json({
        item: {
          id: info.lastInsertRowid,
          filename,
          mime,
          size: file.size,
          url: `/api/uploads/${info.lastInsertRowid}`
        }
      });
    } catch (e) {
      next(e);
    }
  });
});

/* ---------------- 导入 Markdown 文件 ---------------- */
/** 自动识别编码：UTF-8(含 BOM) / UTF-16 / GBK(GB18030)，统一转成 UTF-8 文本 */
function decodeTextBuffer(buf) {
  const tryDecode = (enc, data) => {
    try {
      return { text: new TextDecoder(enc, { fatal: true }).decode(data), encoding: enc };
    } catch (e) {
      return null;
    }
  };

  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return tryDecode('utf-8', buf.subarray(3));
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return tryDecode('utf-16le', buf.subarray(2));
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return tryDecode('utf-16be', buf.subarray(2));
  }
  const utf8 = tryDecode('utf-8', buf);
  if (utf8) return utf8;

  // 没有 BOM 的 UTF-16：大量 0x00 字节
  const nulCount = buf.reduce((n, b) => n + (b === 0 ? 1 : 0), 0);
  if (nulCount > buf.length / 4) {
    const u16 = tryDecode('utf-16le', buf);
    if (u16) return u16;
  }

  // Windows 记事本/部分编辑器默认的 GBK（GB18030 兼容 GBK/GB2312）
  const gbk = tryDecode('gb18030', buf);
  if (gbk) return gbk;
  return null;
}

router.post('/markdown', requireAuth, (req, res, next) => {
  markdownUpload(req, res, (err) => {
    if (err) return uploadError(res, err);
    try {
      const file = req.file;
      if (!file) throw httpError(400, '没有选择文件');

      const decoded = decodeTextBuffer(file.buffer);
      if (!decoded) {
        throw httpError(400, '无法识别文件编码（支持 UTF-8 / UTF-16 / GBK），请另存为 UTF-8 后再导入');
      }
      let text = decoded.text;
      if (text.includes('\uFFFD')) throw httpError(400, '文件里含有乱码，可能不是纯文本，请检查后再导入');
      const ctrl = (text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length;
      if (ctrl > Math.max(2, text.length * 0.02)) {
        throw httpError(400, '文件内容像二进制而不是纯文本，请检查后再导入');
      }

      text = text
        .replace(/^\uFEFF/, '')
        .replace(/\r\n?/g, '\n')
        .replace(/\u0000/g, '');

      res.json({
        filename: decodeOriginalName(file.originalname),
        size: file.size,
        encoding: decoded.encoding,
        content: text
      });
    } catch (e) {
      next(e);
    }
  });
});

/* ---------------- 回显图片 ---------------- */
router.get('/:id', requireAuth, (req, res, next) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) throw httpError(404, '图片不存在');
    const u = db.prepare('SELECT * FROM uploads WHERE id = ?').get(Number(req.params.id));
    if (!u) throw httpError(404, '图片不存在');

    const filePath = path.join(UPLOAD_DIR, path.basename(u.stored_name));
    if (!filePath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) throw httpError(400, '非法路径');
    if (!fs.existsSync(filePath)) throw httpError(404, '文件已丢失');

    res.setHeader('Content-Type', u.mime || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    // 链接带自增 id 且内容不变，可放心长期缓存
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    next(e);
  }
});

/* ---------------- 删除图片（本人或管理员） ---------------- */
router.delete('/:id', requireAuth, (req, res, next) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) throw httpError(404, '图片不存在');
    const u = db.prepare('SELECT * FROM uploads WHERE id = ?').get(Number(req.params.id));
    if (!u) throw httpError(404, '图片不存在');
    if (u.user_id !== req.user.id && req.user.role !== 'admin') throw httpError(403, '无权删除');

    db.prepare('DELETE FROM uploads WHERE id = ?').run(u.id);
    fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(u.stored_name))).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
