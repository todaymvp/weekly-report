'use strict';

/**
 * Hacker · 黑客终端风
 * 纯黑绿终端：窗口标题栏、等宽字体、日志行、命令提示符。
 * 正文用低饱和绿，保证深色下依然好读。
 */

const { document, container } = require('./_shared');

const C = {
  page: '#05090A',
  card: '#0B1410',
  bar: '#101C16',
  border: '#1E3A2A',
  green: '#3BF07A',
  text: '#9FD8B4',
  dim: '#4E8F68',
  bright: '#C8FFDC',
  amber: '#FFC66D',
  red: '#FF6B6B',
  codeBg: '#08120D'
};

function statusLine(ctx) {
  if (!ctx.status) return '';
  const color = ctx.status.tone === 'pending' ? C.amber : ctx.status.tone === 'ok' ? C.green : '#67C7E8';
  return `<tr><td style="padding:10px 28px 0 28px;font-family:${ctx.mono};font-size:12.5px;color:${color};">
    <span style="color:${C.dim};">[STATUS]</span> ${ctx.esc(ctx.status.text)}
  </td></tr>`;
}

function infoRows(ctx) {
  if (!ctx.info.length) return '';
  return `<tr><td style="padding:14px 28px 0 28px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${C.codeBg};border:1px solid ${C.border};border-radius:4px;">
      <tr><td style="padding:12px 16px;font-family:${ctx.mono};font-size:12.5px;line-height:1.9;">
        ${ctx.info
          .map(
            (r) =>
              `<div><span style="color:${C.dim};">[INFO]</span> <span style="color:${C.text};">${ctx.esc(r.label)}</span> <span style="color:${C.dim};">&rarr;</span> <span style="color:${C.bright};font-weight:600;">${ctx.esc(
                r.value
              )}</span></div>`
          )
          .join('')}
      </td></tr>
    </table>
  </td></tr>`;
}

function bodyBlock(ctx) {
  if (!ctx.body) return '';
  return `<tr><td style="padding:14px 28px 0 28px;color:${C.text};font-family:${ctx.mono};font-size:13px;line-height:1.95;">${ctx.body}</td></tr>`;
}

function quoteBlock(ctx) {
  if (!ctx.quote) return '';
  return `<tr><td style="padding:14px 28px 0 28px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${C.codeBg};border-left:3px solid ${C.green};">
      <tr><td style="padding:12px 16px;color:${C.bright};font-family:${ctx.mono};font-size:12.5px;line-height:1.95;">
        <span style="color:${C.dim};">// </span>${ctx.esc(ctx.quote)}
      </td></tr>
    </table>
  </td></tr>`;
}

function codeBlock(ctx) {
  if (!ctx.code) return '';
  return `<tr><td style="padding:16px 28px 0 28px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${C.codeBg};border:1px dashed ${C.green};border-radius:4px;">
      <tr><td align="center" style="padding:18px 16px;">
        <div style="color:${C.green};font-family:${ctx.mono};font-size:28px;font-weight:700;letter-spacing:10px;">${ctx.esc(ctx.code.text)}</div>
        <div style="margin-top:8px;color:${C.dim};font-family:${ctx.mono};font-size:11.5px;"># 有效期 ${ctx.esc(ctx.code.ttl)} min · 非本人操作请忽略</div>
      </td></tr>
    </table>
  </td></tr>`;
}

function contentBlock(ctx) {
  if (ctx.rawHtml) {
    return `<tr><td style="padding:14px 28px 0 28px;color:${C.text};font-family:${ctx.mono};font-size:13px;line-height:1.95;">${ctx.rawHtml}</td></tr>`;
  }
  if (ctx.rawText) {
    return `<tr><td style="padding:14px 28px 0 28px;color:${C.text};font-family:${ctx.mono};font-size:13px;line-height:1.95;white-space:pre-wrap;">${ctx.esc(
      ctx.rawText
    )}</td></tr>`;
  }
  if (ctx.rawInner) {
    return `<tr><td style="padding:14px 28px 0 28px;color:${C.text};font-family:${ctx.mono};font-size:13px;line-height:1.95;">${ctx.rawInner}</td></tr>`;
  }
  return '';
}

function buttonBlock(ctx) {
  if (!ctx.button) return '';
  return `<tr><td style="padding:20px 28px 4px 28px;">
    <table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td style="background-color:${C.green};border-radius:3px;">
        <a href="${ctx.esc(ctx.button.url)}" target="_blank" style="display:inline-block;padding:11px 22px;color:${C.page};font-family:${ctx.mono};font-size:13px;font-weight:700;text-decoration:none;letter-spacing:.5px;">[ ${ctx.esc(
    ctx.button.text
  )} ]</a>
      </td>
    </tr></table>
    <div style="margin-top:12px;font-family:${ctx.mono};font-size:11px;color:${C.dim};line-height:1.7;word-break:break-all;">$ curl -s "${ctx.esc(
    ctx.button.url
  )}"</div>
  </td></tr>`;
}

function signatureBlock(ctx) {
  if (!ctx.signature) return '';
  return `<tr><td style="padding:16px 28px 0 28px;color:${C.dim};font-family:${ctx.mono};font-size:11.5px;line-height:1.9;">
    <span style="color:${C.green};">#</span> ${ctx.esc(ctx.signature)}
  </td></tr>`;
}

function render(ctx) {
  const card = `${container({ bg: C.card, border: C.border, radius: 6, font: ctx.mono })}
    <tr><td style="background-color:${C.bar};padding:10px 16px;border-bottom:1px solid ${C.border};">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tr>
        <td style="font-family:${ctx.mono};font-size:12px;color:${C.dim};letter-spacing:.2px;">
          <span style="color:${C.red};">&#9679;</span> <span style="color:${C.amber};">&#9679;</span> <span style="color:${C.green};">&#9679;</span>
          <span style="padding-left:10px;color:${C.text};">hjsec@weekly: ~/report</span>
        </td>
        ${ctx.badge ? `<td align="right" style="font-family:${ctx.mono};font-size:11.5px;color:${C.green};white-space:nowrap;">${ctx.esc(ctx.badge)}</td>` : ''}
      </tr></table>
    </td></tr>

    <tr><td style="padding:22px 28px 0 28px;">
      <div style="font-family:${ctx.mono};font-size:14px;color:${C.green};letter-spacing:1px;">HJSEC<span style="color:${C.dim};">/</span>SEC-WEEKLY</div>
      <div style="margin-top:4px;font-family:${ctx.mono};font-size:10.5px;color:${C.dim};letter-spacing:1.4px;">SECURITY LEARNING REPORT SYSTEM</div>
    </td></tr>

    <tr><td style="padding:18px 28px 0 28px;">
      <h1 style="margin:0;color:${C.bright};font-family:${ctx.mono};font-size:20px;font-weight:700;line-height:1.55;">
        <span style="color:${C.green};">&gt; </span>${ctx.esc(ctx.heading) || '&nbsp;'}
      </h1>
      ${ctx.intro ? `<p style="margin:10px 0 0 0;color:${C.text};font-family:${ctx.mono};font-size:13px;line-height:1.95;">${ctx.esc(ctx.intro)}</p>` : ''}
    </td></tr>

    <tr><td style="padding:16px 28px 0 28px;"><div style="height:1px;background-color:${C.border};line-height:1px;font-size:0;">&nbsp;</div></td></tr>

    ${statusLine(ctx)}
    ${infoRows(ctx)}
    ${bodyBlock(ctx)}
    ${quoteBlock(ctx)}
    ${codeBlock(ctx)}
    ${contentBlock(ctx)}
    ${buttonBlock(ctx)}
    ${signatureBlock(ctx)}

    <tr><td style="padding:20px 28px 0 28px;"><div style="height:1px;background-color:${C.border};line-height:1px;font-size:0;">&nbsp;</div></td></tr>
    <tr><td style="padding:14px 28px 22px 28px;font-family:${ctx.mono};font-size:11px;line-height:1.9;color:${C.dim};">
      <div>${ctx.esc(ctx.footerNote)}</div>
      <div style="margin-top:4px;">&copy; ${ctx.year} ${ctx.esc(ctx.org)}</div>
      <div style="margin-top:6px;color:${C.green};">$ <span style="color:${C.dim};">exit 0</span></div>
    </td></tr>
  </table>`;

  return document({
    title: ctx.docTitle,
    preheader: ctx.preheader,
    bg: C.page,
    font: ctx.mono,
    inner: card,
    trailing: `<p style="margin:16px 0 0 0;color:${C.dim};font-family:${ctx.mono};font-size:10.5px;letter-spacing:1px;">ROOT@HJSEC · NO REPLY · END OF TRANSMISSION</p>`
  });
}

module.exports = {
  key: 'hacker',
  name: 'Hacker 终端',
  desc: '黑底终端绿、等宽字体与命令提示符，安全部门气质',
  mode: 'dark',
  palette: { primary: C.green, page: C.page, accent: C.dim },
  render
};
