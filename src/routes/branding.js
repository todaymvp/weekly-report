'use strict';

/** 站点 Logo 读取（公开，登录页也要显示） */
const express = require('express');
const path = require('path');
const fs = require('fs');
const branding = require('../branding');
const { httpError } = require('../helpers');

const router = express.Router();

router.get('/logo', (req, res, next) => {
  try {
    const name = branding.current();
    if (!name) throw httpError(404, '未设置 Logo');
    const file = path.basename(name);
    const full = path.join(branding.DIR, file);
    if (!full.startsWith(path.resolve(branding.DIR) + path.sep)) throw httpError(400, '非法路径');
    if (!fs.existsSync(full)) throw httpError(404, 'Logo 已丢失');
    const ext = path.extname(file).toLowerCase();
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[ext] || 'image/png';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
