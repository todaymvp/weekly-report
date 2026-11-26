'use strict';

/**
 * Sunset 暖阳 · 预制模板
 * 暖橙 + 米白，温暖明亮
 * 基于 Minimal 版式，替换配色生成。
 */

const { document, container } = require('./_shared');

const C = {
  page: '#FDF9F4',
  heading: '#7C3E1D',
  text: '#9A6B4A',
  muted: '#C4A98F',
  line: '#F3E7D8',
  blue: '#C2571A',
  blueSoft: '#FCEBDD',
  soft: '#FBF1E7'
};

function statusLine(ctx) {
  if (!ctx.status) return '';
  const color = ctx.status.tone === 'pending' ? '#B45309' : ctx.status.tone === 'ok' ? '#0F766E' : C.blue;
  return `<tr><td style="padding:2px 8px 0 8px;">
    <span style="display:inline-block;font-size:12px;color:${color};letter-spacing:.4px;">
      <span style="color:${color};">&#9679;</span>&nbsp; ${ctx.esc(ctx.status.text)}
    </span>
  </td></tr>`;
}

function infoRows(ctx) {
  if (!ctx.info.length) return '';
  return `<tr><td style="padding:22px 8px 0 8px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
      ${ctx.info
        .map(
          (r, i) => `<tr>
        <td style="padding:11px 0;${i ? `border-top:1px solid ${C.line};` : ''}color:${C.muted};font-size:12.5px;line-height:1.7;letter-spacing:.2px;">${ctx.esc(
            r.label
          )}</td>
        <td style="padding:11px 0;${i ? `border-top:1px solid ${C.line};` : ''}color:${C.heading};font-size:12.5px;line-height:1.7;font-weight:600;text-align:right;">${ctx.esc(
            r.value
          )}</td>
      </tr>`
        )
        .join('')}
    </table>
  </td></tr>`;
}

function bodyBlock(ctx) {
  if (!ctx.body) return '';
  return `<tr><td style="padding:20px 8px 0 8px;color:${C.text};font-size:13.5px;line-height:1.95;">${ctx.body}</td></tr>`;
}

function quoteBlock(ctx) {
  if (!ctx.quote) return '';
  return `<tr><td style="padding:20px 8px 0 8px;">
    <div style="padding:2px 0 2px 14px;border-left:2px solid #BFDBFE;color:${C.text};font-size:13px;line-height:1.9;">${ctx.esc(
    ctx.quote
  )}</div>
  </td></tr>`;
}

function codeBlock(ctx) {
  if (!ctx.code) return '';
  return `<tr><td style="padding:22px 8px 0 8px;">
    <div style="padding:20px 0;background-color:${C.soft};text-align:center;">
      <div style="color:${C.heading};font-family:${ctx.mono};font-size:28px;font-weight:400;letter-spacing:12px;">${ctx.esc(ctx.code.text)}</div>
      <div style="margin-top:8px;color:${C.muted};font-size:11.5px;letter-spacing:.6px;">${ctx.esc(ctx.code.ttl)} 分钟内有效</div>
    </div>
  </td></tr>`;
}

function contentBlock(ctx) {
  if (ctx.rawHtml) {
    return `<tr><td style="padding:20px 8px 0 8px;color:${C.text};font-size:13.5px;line-height:1.95;">${ctx.rawHtml}</td></tr>`;
  }
  if (ctx.rawText) {
    return `<tr><td style="padding:20px 8px 0 8px;color:${C.text};font-size:13.5px;line-height:1.95;white-space:pre-wrap;">${ctx.esc(
      ctx.rawText
    )}</td></tr>`;
  }
  if (ctx.rawInner) {
    return `<tr><td style="padding:20px 8px 0 8px;color:${C.text};font-size:13.5px;line-height:1.95;">${ctx.rawInner}</td></tr>`;
  }
  return '';
}

function buttonBlock(ctx) {
  if (!ctx.button) return '';
  return `<tr><td style="padding:28px 8px 2px 8px;">
    <a href="${ctx.esc(ctx.button.url)}" target="_blank" style="display:inline-block;padding:11px 24px;background-color:${C.blueSoft};color:${C.blue};font-size:13px;font-weight:600;text-decoration:none;letter-spacing:.3px;">${ctx.esc(
    ctx.button.text
  )}</a>
    <p style="margin:12px 0 0 0;color:${C.muted};font-size:11px;line-height:1.7;word-break:break-all;">${ctx.esc(ctx.button.url)}</p>
  </td></tr>`;
}

function signatureBlock(ctx) {
  if (!ctx.signature) return '';
  return `<tr><td style="padding:24px 8px 0 8px;color:${C.muted};font-size:12px;line-height:1.85;font-style:italic;">${ctx.esc(
    ctx.signature
  )}</td></tr>`;
}

function render(ctx) {
  const card = `${container({ max: 540, bg: C.page, font: ctx.font })}
    <tr><td style="padding:0 8px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tr>
        <td style="font-size:11px;color:${C.muted};letter-spacing:4px;text-transform:uppercase;">HJSEC</td>
        ${
          ctx.badge
            ? `<td align="right" style="font-size:11.5px;color:${C.muted};letter-spacing:.6px;white-space:nowrap;">${ctx.esc(ctx.badge)}</td>`
            : ''
        }
      </tr></table>
    </td></tr>

    <tr><td style="padding:34px 8px 0 8px;">
      <h1 style="margin:0;color:${C.heading};font-size:26px;font-weight:300;line-height:1.4;letter-spacing:-.4px;">${ctx.esc(
        ctx.heading
      ) || '&nbsp;'}</h1>
      ${ctx.intro ? `<p style="margin:14px 0 0 0;color:${C.text};font-size:13.5px;line-height:1.95;">${ctx.esc(ctx.intro)}</p>` : ''}
    </td></tr>

    <tr><td style="padding:26px 8px 0 8px;"><div style="height:1px;background-color:${C.line};line-height:1px;font-size:0;">&nbsp;</div></td></tr>

    ${statusLine(ctx)}
    ${infoRows(ctx)}
    ${bodyBlock(ctx)}
    ${quoteBlock(ctx)}
    ${codeBlock(ctx)}
    ${contentBlock(ctx)}
    ${buttonBlock(ctx)}
    ${signatureBlock(ctx)}

    <tr><td style="padding:34px 8px 0 8px;"><div style="height:1px;background-color:${C.line};line-height:1px;font-size:0;">&nbsp;</div></td></tr>
    <tr><td style="padding:16px 8px 8px 8px;">
      <p style="margin:0 0 5px 0;color:${C.muted};font-size:11px;line-height:1.7;">${ctx.esc(ctx.footerNote)}</p>
      <p style="margin:0;color:#C4A98F;font-size:11px;line-height:1.7;">&copy; ${ctx.year} ${ctx.esc(ctx.org)}</p>
    </td></tr>
  </table>`;

  return document({
    title: ctx.docTitle,
    preheader: ctx.preheader,
    bg: C.page,
    font: ctx.font,
    pad: 36,
    inner: card,
    trailing: `<p style="margin:18px 0 0 0;color:#F3E7D8;font-size:10px;letter-spacing:2px;">HJSEC WEEKLY · SUNSET</p>`
  });
}

module.exports = {
  key: 'sunset',
  name: 'Sunset 暖阳',
  desc: '暖橙 + 米白，温暖明亮',
  mode: 'light',
  palette: { primary: C.blue, page: C.page, accent: C.muted },
  render
};
