'use strict';

/** 邮箱验证码：签发 / 校验（bcrypt 存储，限频，一次性，10 分钟有效） */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('./db');
const { nowIso, httpError } = require('./helpers');
const { sendMail, isConsoleMode } = require('./mailer');

const TTL_MIN = 10;
const COOLDOWN_SEC = 60;
const MAX_ATTEMPTS = 5;
const MAX_PER_IP_HOUR = 10;

function genCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

async function issue({ email, purpose = 'register', ip = '', name = '' }) {
  const last = db
    .prepare(
      'SELECT created_at FROM email_codes WHERE email = ? COLLATE NOCASE AND purpose = ? ORDER BY id DESC LIMIT 1'
    )
    .get(email, purpose);

  if (last) {
    const elapsed = Date.now() - new Date(last.created_at).getTime();
    if (elapsed < COOLDOWN_SEC * 1000) {
      const wait = Math.ceil((COOLDOWN_SEC * 1000 - elapsed) / 1000);
      throw httpError(429, `请 ${wait} 秒后再获取验证码`);
    }
  }

  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  const ipCount = db
    .prepare('SELECT COUNT(*) AS c FROM email_codes WHERE ip = ? AND created_at > ?')
    .get(ip, hourAgo).c;
  if (ipCount >= MAX_PER_IP_HOUR) throw httpError(429, '获取验证码过于频繁，请稍后再试');

  const code = genCode();
  const expires = new Date(Date.now() + TTL_MIN * 60000).toISOString();
  db.prepare(
    `INSERT INTO email_codes (email, purpose, code_hash, expires_at, attempts, consumed, ip, created_at)
     VALUES (?, ?, ?, ?, 0, 0, ?, ?)`
  ).run(email, purpose, bcrypt.hashSync(code, 8), expires, ip, nowIso());

  const isReset = purpose === 'reset';
  const subject = isReset ? '【学习周报】重置密码验证码' : '【学习周报】邮箱验证码';
  const tip = isReset
    ? `${TTL_MIN} 分钟内有效。如果不是你本人操作，请忽略本邮件，你的密码不会被修改。`
    : `${TTL_MIN} 分钟内有效，若非本人操作请忽略本邮件。`;
  const lead = isReset ? '你正在重置学习周报账号的密码，验证码是：' : '你的验证码是：';

  const templates = require('./mail_templates');
  const mail = templates.renderMail(isReset ? 'resetCode' : 'registerCode', { code, ttlMinutes: TTL_MIN });

  await sendMail({
    to: email,
    toName: name,
    type: isReset ? 'reset_code' : 'register_code',
    subject,
    text: `HJSEC 安全学习周报\n\n${lead}${code}\n\n${tip}\n\n此邮件由 HJSEC 周报系统自动发送，请勿直接回复。`,
    html: mail.html,
    theme: mail.theme
  });
  return { cooldown: COOLDOWN_SEC, expiresIn: TTL_MIN * 60, consoleMode: isConsoleMode(), code };
}

function verify({ email, purpose = 'register', code }) {
  if (!code) throw httpError(400, '请填写邮箱验证码');

  const row = db
    .prepare(
      `SELECT * FROM email_codes
       WHERE email = ? COLLATE NOCASE AND purpose = ? AND consumed = 0
       ORDER BY id DESC LIMIT 1`
    )
    .get(email, purpose);

  if (!row) throw httpError(400, '请先获取邮箱验证码');
  if (row.expires_at < nowIso()) throw httpError(400, '验证码已过期，请重新获取');
  if (row.attempts >= MAX_ATTEMPTS) throw httpError(429, '尝试次数过多，请重新获取验证码');

  db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
  if (!bcrypt.compareSync(String(code), row.code_hash)) throw httpError(400, '邮箱验证码不正确');

  db.prepare('UPDATE email_codes SET consumed = 1 WHERE id = ?').run(row.id);
  return true;
}

module.exports = { issue, verify, TTL_MIN, COOLDOWN_SEC };
