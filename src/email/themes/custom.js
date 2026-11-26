'use strict';

/**
 * Custom · 管理员自定义 HTML 模板
 * 后台「邮件设置 → 自定义 HTML 模板」里填写完整 HTML，
 * 用 {{content}} 作为正文占位符（其余可用变量见下）。
 * 如果没配置或没有 {{content}}，自动回退到 nature 主题，保证邮件始终能发。
 */

const nature = require('./nature');
const { escapeHtml } = require('../engine/variables');

function setting(key) {
  try {
    return require('../../settings').get(key) || '';
  } catch (e) {
    return '';
  }
}

const VARS = {
  site: () => setting('site_name') || 'HJSEC 安全学习周报',
  siteUrl: () => setting('site_url') || 'https://study.hjsec.top',
  year: () => String(new Date().getFullYear())
};

/** 业务字段 → 一段通用正文 HTML（供自定义外壳注入） */
function innerHtml(ctx) {
  const parts = [];
  if (ctx.heading) {
    parts.push(
      `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.4;color:#2F4A39;">${ctx.esc(ctx.heading)}</h1>`
    );
  }
  if (ctx.intro) {
    parts.push(`<p style="margin:0 0 14px;font-size:14px;line-height:1.85;color:#5F6F5D;">${ctx.esc(ctx.intro)}</p>`);
  }
  if (ctx.status && ctx.status.text) {
    parts.push(
      `<p style="margin:0 0 14px;"><span style="display:inline-block;padding:4px 12px;background:#F1F5EC;color:#365744;border-radius:999px;font-size:12px;">${ctx.esc(
        ctx.status.text
      )}</span></p>`
    );
  }
  if (ctx.info && ctx.info.length) {
    parts.push(
      '<table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="margin:0 0 14px;border-top:1px solid #E1E8DA;">' +
        ctx.info
          .filter((r) => r && r.value)
          .map(
            (r) =>
              `<tr><td style="padding:9px 0;font-size:13px;color:#5F6F5D;">${ctx.esc(r.label)}</td>` +
              `<td style="padding:9px 0;font-size:13px;color:#2F4A39;font-weight:600;text-align:right;">${ctx.esc(
                r.value
              )}</td></tr>`
          )
          .join('') +
        '</table>'
    );
  }
  if (ctx.body) parts.push(`<div style="font-size:14px;line-height:1.85;color:#5F6F5D;">${ctx.body}</div>`);
  if (ctx.quote) {
    parts.push(
      `<blockquote style="margin:14px 0;padding:12px 16px;border-left:3px solid #8FA687;background:#F1F5EC;color:#2F4A39;font-size:13.5px;line-height:1.8;">${ctx.esc(
        ctx.quote
      )}</blockquote>`
    );
  }
  if (ctx.button && ctx.button.url) {
    parts.push(
      `<p style="margin:20px 0 0;"><a href="${ctx.esc(ctx.button.url)}" style="display:inline-block;padding:12px 26px;background:#365744;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">${ctx.esc(
        ctx.button.text || '查看详情'
      )}</a></p>`
    );
  }
  return parts.join('\n');
}

function render(ctx) {
  let html = setting('mail_custom_html');
  if (!html || !html.includes('{{content}}')) {
    // 没配好就回退 nature，绝不发空邮件
    return nature.render(ctx);
  }
  const content = innerHtml(ctx);
  return html
    .split('{{content}}')
    .join(content)
    .split('{{site}}')
    .join(escapeHtml(VARS.site()))
    .split('{{site_url}}')
    .join(escapeHtml(VARS.siteUrl()))
    .split('{{year}}')
    .join(VARS.year())
    .split('{{title}}')
    .join(ctx.esc(ctx.title || ctx.heading || ''));
}

module.exports = {
  key: 'custom',
  name: '自定义 HTML',
  desc: '后台填写自己的 HTML 外壳，用 {{content}} 占位',
  mode: 'fixed',
  palette: { primary: '#365744', heading: '#2F4A39', text: '#5F6F5D', page: '#F2F5EC' },
  render
};
