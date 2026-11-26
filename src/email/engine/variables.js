'use strict';

/**
 * 邮件变量层
 *
 * 所有主题共用同一套变量接口：主题只负责「长什么样」，业务只负责「说什么」。
 * buildContext() 把业务模板传来的字段规整成主题可直接消费的 ctx。
 */

const SITE_NAME = 'HJSEC 安全学习周报';
const ORG = '桂电计算机与信息安全学院 大学生科技协会安全部';

const escapeHtml = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',Roboto,'Helvetica Neue',Arial,sans-serif";

const MONO =
  "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono','Courier New',monospace";

const TONES = new Set(['ok', 'pending', 'info']);

/** 信息行：丢掉空值，统一成字符串 */
function normalizeInfo(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => r && r.value !== undefined && r.value !== null && String(r.value) !== '')
    .map((r) => ({ label: String(r.label == null ? '' : r.label), value: String(r.value) }));
}

/**
 * @param {object} o 业务字段（见 mail_templates 各通知函数）
 * @returns {object} 主题消费用的 ctx
 */
function buildContext(o = {}) {
  const status = o.status && o.status.text
    ? { text: String(o.status.text), tone: TONES.has(o.status.tone) ? o.status.tone : 'info' }
    : null;

  const button = o.button && o.button.url
    ? { text: String(o.button.text || '查看详情'), url: String(o.button.url) }
    : null;

  const code = o.code
    ? { text: String(o.code), ttl: o.ttlMinutes ? String(o.ttlMinutes) : '10' }
    : null;

  return {
    esc: escapeHtml,
    font: FONT,
    mono: MONO,
    siteName: SITE_NAME,
    org: ORG,
    year: new Date().getFullYear(),
    docTitle: o.docTitle || SITE_NAME,
    preheader: o.preheader || o.intro || o.docTitle || SITE_NAME,
    badge: o.badge ? String(o.badge) : '',
    heading: o.heading ? String(o.heading) : '',
    intro: o.intro ? String(o.intro) : '',
    status,
    info: normalizeInfo(o.info),
    body: o.body || '',
    quote: o.quote ? String(o.quote) : '',
    code,
    rawHtml: o.rawHtml || '',
    rawText: o.rawText ? String(o.rawText) : '',
    rawInner: o.rawInner || '',
    button,
    signature: o.signature ? String(o.signature) : '',
    footerNote: o.footerNote ? String(o.footerNote) : '此邮件由 HJSEC 周报系统自动发送，请勿直接回复。'
  };
}

module.exports = { SITE_NAME, ORG, FONT, MONO, escapeHtml, normalizeInfo, buildContext };
