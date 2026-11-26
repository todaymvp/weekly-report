'use strict';

/**
 * 邮件发送
 * 配置来源优先级：数据库 settings（后台「邮件设置」页）> appsettings.json / 环境变量
 * 后台填好 SMTP 后点「测试连接」即可验证，不需要改任何启动参数。
 */

const log = require('./logger');
const { audit } = require('./audit');

let cachedTransport = null;
let cachedKey = '';

/** 读取当前 SMTP 配置（数据库优先，退回环境变量） */
function smtpConfig() {
  let s = {};
  try {
    s = require('./settings');
  } catch (e) {
    s = null;
  }
  const pick = (key, envKey) => {
    let v = '';
    try {
      v = s ? s.get(key) : '';
    } catch (e) {
      v = '';
    }
    return v || process.env[envKey] || '';
  };
  const host = pick('smtp_host', 'SMTP_HOST');
  const port = parseInt(pick('smtp_port', 'SMTP_PORT'), 10) || 465;
  const secure = pick('smtp_secure', 'SMTP_SECURE') !== 'false';
  const user = pick('smtp_user', 'SMTP_USER');
  const pass = pick('smtp_pass', 'SMTP_PASS');
  const from = pick('mail_from', 'MAIL_FROM') || user || 'no-reply@localhost';
  const enabled = pick('smtp_enabled', 'MAIL_MODE') !== 'console' && !!host;
  return { host, port, secure, user, pass, from, enabled };
}

const isConfigured = () => {
  const c = smtpConfig();
  return !!(c.host && c.user && c.pass);
};

function getTransport() {
  const c = smtpConfig();
  const key = `${c.host}|${c.port}|${c.secure}|${c.user}|${c.pass}`;
  if (cachedTransport && key === cachedKey) return cachedTransport;
  const nodemailer = require('nodemailer');
  cachedTransport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: c.user ? { user: c.user, pass: c.pass } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
  cachedKey = key;
  return cachedTransport;
}

/** 后台「测试连接」：验证 SMTP 配置是否可用 */
async function verifySmtp() {
  if (!isConfigured()) {
    return { ok: false, error: 'SMTP 未配置完整（需要 host / user / pass）' };
  }
  try {
    await getTransport().verify();
    const c = smtpConfig();
    return { ok: true, host: c.host, port: c.port, user: c.user, from: c.from };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function maskMail(to) {
  const s = String(to || '');
  const at = s.indexOf('@');
  if (at <= 1) return s;
  return s.slice(0, 1) + '***' + s.slice(at);
}

/** 记录一封邮件的发送结果与实际使用的主题（失败不影响发送流程） */
function recordMail({ to, subject, type, theme, ok, error }) {
  try {
    const { db } = require('./db');
    db.prepare(
      'INSERT INTO mail_logs (to_email, type, theme, subject, ok, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      String(to || ''),
      String(type || ''),
      String(theme || ''),
      String(subject || '').slice(0, 200),
      ok ? 1 : 0,
      String(error || '').slice(0, 300),
      new Date().toISOString()
    );
    // 只留最近 500 条，避免表无限增长
    db.prepare('DELETE FROM mail_logs WHERE id <= (SELECT MAX(id) - 500 FROM mail_logs)').run();
  } catch (e) {
    log.warn(`[mail] 写发送日志失败：${e.message}`);
  }
}

/** 后台「最近邮件主题」用 */
function recentMailLogs(limit = 12) {
  try {
    const { db } = require('./db');
    return db
      .prepare('SELECT id, to_email, type, theme, subject, ok, error, created_at FROM mail_logs ORDER BY id DESC LIMIT ?')
      .all(Math.max(1, Math.min(50, Number(limit) || 12)));
  } catch (e) {
    return [];
  }
}

/**
 * @param {object} opts { to, toName, subject, text, html, type, actor, theme, retries }
 */
async function sendMail({
  to,
  toName = '',
  subject,
  text,
  html,
  type = 'mail',
  actor = null,
  theme = '',
  retries = 1
}) {
  const kind = String(type);
  const label = `"${toName || String(to).split('@')[0]}" <${to}>`;

  if (!isConfigured()) {
    // 没配置 SMTP：写日志 + 审计，不阻断业务
    log.warn(`[mail] 未配置 SMTP，跳过发送 type=${kind} theme=${theme || '-'} to=${to}`);
    recordMail({ to, subject, type: kind, theme, ok: false, error: 'SMTP 未配置' });
    audit({ actor, action: 'mail_failed', targetType: 'mail', detail: `${label}：SMTP 未配置` });
    return { ok: false, mode: 'none', theme, error: 'SMTP 未配置' };
  }

  const c = smtpConfig();
  const attempts = Math.max(1, Math.min(3, Number(retries) || 1));
  let lastErr = null;

  // 重试时沿用同一份 html / 同一个 theme，不重新选主题
  for (let i = 0; i < attempts; i += 1) {
    try {
      const info = await getTransport().sendMail({ from: c.from, to, subject, text, html });
      const id = info.messageId || '-';
      log.info(`[mail] 已发送 type=${kind} theme=${theme || '-'} to=${to} id=${id} attempt=${i + 1}`);
      recordMail({ to, subject, type: kind, theme, ok: true });
      audit({ actor, action: 'mail_send', targetType: 'mail', detail: `${label}${theme ? ` [${theme}]` : ''}` });
      return { ok: true, mode: 'smtp', messageId: id, theme, attempts: i + 1 };
    } catch (e) {
      lastErr = e;
      const retryable = /timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ESOCKET|421|450|451|452/i.test(
        String(e.message || '')
      );
      if (i + 1 < attempts && retryable) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      break;
    }
  }

  log.error(`[mail] 发送失败 type=${kind} theme=${theme || '-'} to=${to}：${lastErr && lastErr.message}`);
  recordMail({ to, subject, type: kind, theme, ok: false, error: lastErr && lastErr.message });
  audit({
    actor,
    action: 'mail_failed',
    targetType: 'mail',
    detail: `${label}${theme ? ` [${theme}]` : ''}：${String((lastErr && lastErr.message) || '').slice(0, 120)}`
  });
  throw lastErr;
}

const isConsoleMode = () => !isConfigured();

module.exports = { sendMail, isConsoleMode, smtpConfig, isConfigured, verifySmtp, maskMail, recordMail, recentMailLogs };