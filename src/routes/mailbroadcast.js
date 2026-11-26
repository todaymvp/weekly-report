'use strict';

/**
 * 管理员群发邮件（手动活动 / 通知）
 *   POST /api/admin/mail/send   { subject, body, format: 'text'|'html', recipients: 'all'|'selected', ids: [] }
 *   GET  /api/admin/mail/recipients  可选收件人列表
 *
 * 纯手动触发，不影响定时任务和系统邮件。
 */

const express = require('express');
const { db } = require('../db');
const { sendMail } = require('../mailer');
const { audit } = require('../audit');
const { httpError } = require('../helpers');
const settings = require('../settings');
const { escapeHtml } = require('../mail_templates');
const { requireAuth, } = require('../auth');

const router = express.Router();
router.use(requireAuth, (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
});

router.get('/recipients', (req, res) => {
  const rows = db
    .prepare("SELECT id, username, display_name, email, status FROM users WHERE status='active' ORDER BY id ASC")
    .all();
  res.json({
    items: rows.map((u) => ({ id: u.id, username: u.username, displayName: u.display_name, email: u.email }))
  });
});

router.post('/send', async (req, res, next) => {
  try {
    const subject = String(req.body.subject || '').trim().slice(0, 120);
    const body = String(req.body.body || '').slice(0, 20000);
    const format = req.body.format === 'html' ? 'html' : 'text';
    let targets = [];

    if (req.body.recipients === 'selected' && Array.isArray(req.body.ids)) {
      const ids = req.body.ids.map(Number).filter(Number.isInteger);
      if (!ids.length) throw httpError(400, '请至少选择一个收件人');
      const ph = ids.map(() => '?').join(',');
      targets = db
        .prepare(`SELECT id, username, email, display_name FROM users WHERE id IN (${ph}) AND status='active' AND email != ''`)
        .all(...ids);
    } else {
      targets = db
        .prepare("SELECT id, username, email, display_name FROM users WHERE status='active' AND email != ''")
        .all();
    }

    if (!subject) throw httpError(400, '请填写邮件主题');
    if (!body) throw httpError(400, '请填写邮件内容');
    if (!targets.length) throw httpError(400, '没有可发送的收件人');

    const templates = require('../mail_templates');
    const heading = String(req.body.heading || '').trim() || subject;
    const intro = String(req.body.intro || '').trim();
    const plainText =
      format === 'html'
        ? body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800)
        : body;

    let sent = 0;
    let failed = 0;
    const errors = [];
    const themeCount = {};

    // 每封独立选主题 + 独立渲染：随机模式下同一批群发会出现不同版式
    for (const target of targets) {
      const sel = templates.selector.select();
      const html = templates.renderAs(sel.key, () =>
        templates.broadcast({
          subject,
          heading,
          intro,
          html: format === 'html' ? body : '',
          text: format === 'html' ? '' : body
        })
      );
      try {
        await sendMail({
          to: target.email,
          toName: target.display_name || target.username,
          subject,
          text: plainText,
          html,
          type: 'admin_broadcast',
          theme: sel.key,
          actor: req.user
        });
        sent += 1;
        themeCount[sel.key] = (themeCount[sel.key] || 0) + 1;
      } catch (e) {
        failed += 1;
        errors.push(`${target.email}: ${e.message}`);
      }
    }

    audit({
      actor: req.user,
      action: 'admin_mail_broadcast',
      detail: `群发邮件「${subject}」→ ${targets.length} 人，成功 ${sent}，失败 ${failed}${
        Object.keys(themeCount).length ? `，主题 ${Object.entries(themeCount).map(([k, v]) => `${k}×${v}`).join('/')}` : ''
      }${errors.length ? '：' + errors.slice(0, 3).join('；') : ''}`,
      req
    });

    res.json({ ok: true, targets: targets.length, sent, failed, themes: themeCount, errors: errors.slice(0, 5) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
