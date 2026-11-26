'use strict';

/**
 * Cyberpunk · 赛博朋克风
 * 深紫底 + 霓虹紫/青双色、扫描线感的分隔、网格化信息、方块按钮。
 */

const { document, container } = require('./_shared');

const C = {
  page: '#08040F',
  card: '#120A22',
  panel: '#180D30',
  border: '#33205C',
  neon: '#B14CFF',
  cyan: '#22E3E3',
  text: '#C9C2E8',
  dim: '#7A6BA8',
  bright: '#F4EFFF',
  line: '#2A1A48'
};

function statusTag(ctx) {
  if (!ctx.status) return '';
  const color = ctx.status.tone === 'pending' ? '#FFB020' : ctx.status.tone === 'ok' ? C.cyan : C.neon;
  return `<tr><td style="padding:4px 30px 0 30px;">
    <span style="display:inline-block;padding:5px 12px;border:1px solid ${color};color:${color};font-size:11.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">${ctx.esc(
    ctx.status.text
  )}</span>
  </td></tr>`;
}

function infoGrid(ctx) {
  if (!ctx.info.length) return '';
  const rows = [];
  for (let i = 0; i < ctx.info.length; i += 2) {
    const a = ctx.info[i];
    const b = ctx.info[i + 1];
    const cell = (r) =>
      r
        ? `<td width="50%" style="padding:11px 12px;border:1px solid ${C.line};vertical-align:top;">
             <div style="color:${C.dim};font-size:10px;letter-spacing:1.4px;text-transform:uppercase;">${ctx.esc(r.label)}</div>
             <div style="margin-top:5px;color:${C.bright};font-size:13px;font-weight:600;line-height:1.5;">${ctx.esc(r.value)}</div>
           </td>`
        : `<td width="50%" style="border:1px solid transparent;">&nbsp;</td>`;
    rows.push(`<tr>${cell(a)}${cell(b)}</tr>`);
  }
  return `<tr><td style="padding:18px 30px 0 30px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="border-collapse:collapse;background-color:${C.panel};">
      ${rows.join('')}
    </table>
  </td></tr>`;
}

function bodyBlock(ctx) {
  if (!ctx.body) return '';
  return `<tr><td style="padding:18px 30px 0 30px;color:${C.text};font-size:13.5px;line-height:1.9;">${ctx.body}</td></tr>`;
}

function quoteBlock(ctx) {
  if (!ctx.quote) return '';
  return `<tr><td style="padding:18px 30px 0 30px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${C.panel};border-left:2px solid ${C.cyan};">
      <tr><td style="padding:12px 16px;color:${C.bright};font-size:13px;line-height:1.85;">${ctx.esc(ctx.quote)}</td></tr>
    </table>
  </td></tr>`;
}

function codeBlock(ctx) {
  if (!ctx.code) return '';
  return `<tr><td style="padding:18px 30px 0 30px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${C.panel};border:1px solid ${C.cyan};">
      <tr><td align="center" style="padding:20px 16px;">
        <div style="color:${C.cyan};font-family:${ctx.mono};font-size:30px;font-weight:700;letter-spacing:12px;">${ctx.esc(ctx.code.text)}</div>
        <div style="margin-top:10px;color:${C.dim};font-size:11px;letter-spacing:1.2px;">VALID FOR ${ctx.esc(ctx.code.ttl)} MIN</div>
      </td></tr>
    </table>
  </td></tr>`;
}

function contentBlock(ctx) {
  if (ctx.rawHtml) {
    return `<tr><td style="padding:18px 30px 0 30px;color:${C.text};font-size:13.5px;line-height:1.9;">${ctx.rawHtml}</td></tr>`;
  }
  if (ctx.rawText) {
    return `<tr><td style="padding:18px 30px 0 30px;color:${C.text};font-size:13.5px;line-height:1.9;white-space:pre-wrap;">${ctx.esc(
      ctx.rawText
    )}</td></tr>`;
  }
  if (ctx.rawInner) {
    return `<tr><td style="padding:18px 30px 0 30px;color:${C.text};font-size:13.5px;line-height:1.9;">${ctx.rawInner}</td></tr>`;
  }
  return '';
}

function buttonBlock(ctx) {
  if (!ctx.button) return '';
  return `<tr><td style="padding:24px 30px 2px 30px;">
    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid ${C.neon};">
      <tr><td style="background-color:${C.cyan};padding:0;">
        <a href="${ctx.esc(ctx.button.url)}" target="_blank" style="display:inline-block;padding:12px 28px;color:#08040F;font-size:13px;font-weight:800;text-decoration:none;letter-spacing:2px;text-transform:uppercase;">${ctx.esc(
    ctx.button.text
  )}</a>
      </td></tr>
    </table>
    <p style="margin:12px 0 0 0;color:${C.dim};font-size:11px;line-height:1.7;word-break:break-all;">LINK &rarr; <a href="${ctx.esc(
    ctx.button.url
  )}" target="_blank" style="color:${C.cyan};text-decoration:none;">${ctx.esc(ctx.button.url)}</a></p>
  </td></tr>`;
}

function signatureBlock(ctx) {
  if (!ctx.signature) return '';
  return `<tr><td style="padding:18px 30px 0 30px;color:${C.neon};font-size:12px;line-height:1.85;letter-spacing:.4px;">&gt;_ ${ctx.esc(
    ctx.signature
  )}</td></tr>`;
}

function render(ctx) {
  const card = `${container({ bg: C.card, border: C.border, radius: 2, font: ctx.font })}
    <tr><td style="height:3px;background-color:${C.neon};line-height:3px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="height:1px;background-color:${C.cyan};line-height:1px;font-size:0;">&nbsp;</td></tr>

    <tr><td style="padding:24px 30px 0 30px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tr>
        <td style="vertical-align:middle;">
          <div style="color:${C.neon};font-size:16px;font-weight:800;letter-spacing:4px;">HJSEC</div>
          <div style="margin-top:5px;color:${C.dim};font-size:9.5px;letter-spacing:2.4px;">NEON WEEKLY REPORT</div>
        </td>
        ${
          ctx.badge
            ? `<td align="right"><span style="display:inline-block;padding:5px 11px;border:1px solid ${C.neon};color:${C.neon};font-size:11px;letter-spacing:1.4px;white-space:nowrap;">${ctx.esc(
                ctx.badge
              )}</span></td>`
            : ''
        }
      </tr></table>
    </td></tr>

    <tr><td style="padding:20px 30px 0 30px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tr>
        <td style="width:3px;background-color:${C.cyan};">&nbsp;</td>
        <td style="padding-left:14px;">
          <h1 style="margin:0;color:${C.bright};font-size:23px;font-weight:800;line-height:1.45;letter-spacing:.5px;">${ctx.esc(
            ctx.heading
          ) || '&nbsp;'}</h1>
          ${ctx.intro ? `<p style="margin:9px 0 0 0;color:${C.text};font-size:13.5px;line-height:1.85;">${ctx.esc(ctx.intro)}</p>` : ''}
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:16px 30px 0 30px;"><div style="height:1px;background-color:${C.line};line-height:1px;font-size:0;">&nbsp;</div></td></tr>

    ${statusTag(ctx)}
    ${infoGrid(ctx)}
    ${bodyBlock(ctx)}
    ${quoteBlock(ctx)}
    ${codeBlock(ctx)}
    ${contentBlock(ctx)}
    ${buttonBlock(ctx)}
    ${signatureBlock(ctx)}

    <tr><td style="padding:22px 30px 0 30px;"><div style="height:1px;background-color:${C.line};line-height:1px;font-size:0;">&nbsp;</div></td></tr>
    <tr><td style="padding:14px 30px 22px 30px;">
      <p style="margin:0 0 5px 0;color:${C.dim};font-size:10.5px;line-height:1.75;letter-spacing:.4px;">${ctx.esc(ctx.footerNote)}</p>
      <p style="margin:0;color:${C.dim};font-size:10.5px;line-height:1.75;">&copy; ${ctx.year} ${ctx.esc(ctx.org)}</p>
      <p style="margin:8px 0 0 0;color:${C.neon};font-size:10px;letter-spacing:2px;">// TRANSMISSION END</p>
    </td></tr>
  </table>`;

  return document({
    title: ctx.docTitle,
    preheader: ctx.preheader,
    bg: C.page,
    font: ctx.font,
    inner: card,
    trailing: `<p style="margin:16px 0 0 0;color:${C.dim};font-size:10px;letter-spacing:2.6px;">HJSEC · NEON GRID · 2049</p>`
  });
}

module.exports = {
  key: 'cyberpunk',
  name: 'Cyberpunk 霓虹',
  desc: '深紫底 + 紫青霓虹，网格信息与方块按钮',
  mode: 'dark',
  palette: { primary: C.neon, page: C.page, accent: C.cyan },
  render
};
