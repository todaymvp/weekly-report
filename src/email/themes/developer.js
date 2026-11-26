'use strict';

/**
 * Developer · 开发者工程风
 * 参考 GitHub / GitLab / VS Code：浅灰底、白卡、细边框、代码块、标签式信息行。
 */

const { document, container } = require('./_shared');

const C = {
  page: '#F6F8FA',
  card: '#FFFFFF',
  border: '#D0D7DE',
  header: '#F6F8FA',
  heading: '#1F2328',
  text: '#424A53',
  muted: '#57606A',
  faint: '#8C959F',
  link: '#0969DA',
  green: '#1F883D',
  greenSoft: '#DAFBE1',
  blueSoft: '#DDF4FF',
  codeBg: '#F6F8FA'
};

function statusChip(ctx) {
  if (!ctx.status) return '';
  const pending = ctx.status.tone === 'pending';
  const dot = pending ? '#BF8700' : ctx.status.tone === 'ok' ? C.green : C.link;
  const bg = pending ? '#FFF8C5' : ctx.status.tone === 'ok' ? C.greenSoft : C.blueSoft;
  return `<tr><td style="padding:4px 28px 0 28px;">
    <span style="display:inline-block;padding:4px 10px;background-color:${bg};border-radius:999px;font-size:12px;font-weight:600;color:${C.heading};">
      <span style="color:${dot};">&#9679;</span>&nbsp; ${ctx.esc(ctx.status.text)}
    </span>
  </td></tr>`;
}

function infoTable(ctx) {
  if (!ctx.info.length) return '';
  return `<tr><td style="padding:18px 28px 0 28px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="border:1px solid ${C.border};border-radius:6px;border-collapse:separate;overflow:hidden;">
      ${ctx.info
        .map(
          (r, i) => `<tr>
        <td style="padding:10px 14px;background-color:${C.header};border-bottom:1px solid ${C.border};color:${C.muted};font-size:12.5px;line-height:1.7;width:40%;${
            i === ctx.info.length - 1 ? 'border-bottom:none;' : ''
          }">${ctx.esc(r.label)}</td>
        <td style="padding:10px 14px;background-color:#FFFFFF;border-bottom:1px solid ${C.border};color:${C.heading};font-size:13px;line-height:1.7;font-weight:600;${
            i === ctx.info.length - 1 ? 'border-bottom:none;' : ''
          }">${ctx.esc(r.value)}</td>
      </tr>`
        )
        .join('')}
    </table>
  </td></tr>`;
}

function bodyBlock(ctx) {
  if (!ctx.body) return '';
  return `<tr><td style="padding:16px 28px 0 28px;color:${C.text};font-size:13.5px;line-height:1.85;">${ctx.body}</td></tr>`;
}

function quoteBlock(ctx) {
  if (!ctx.quote) return '';
  return `<tr><td style="padding:16px 28px 0 28px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${C.codeBg};border:1px solid ${C.border};border-radius:6px;">
      <tr><td style="padding:12px 14px;border-left:3px solid ${C.border};color:${C.heading};font-size:13px;line-height:1.8;">${ctx.esc(
    ctx.quote
  )}</td></tr>
    </table>
  </td></tr>`;
}

function codeBlock(ctx) {
  if (!ctx.code) return '';
  return `<tr><td style="padding:16px 28px 0 28px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${C.codeBg};border:1px solid ${C.border};border-radius:6px;">
      <tr><td style="padding:8px 14px;border-bottom:1px solid ${C.border};color:${C.faint};font-family:${ctx.mono};font-size:11px;">verification-code.txt</td></tr>
      <tr><td align="center" style="padding:18px 14px;">
        <div style="color:${C.heading};font-family:${ctx.mono};font-size:28px;font-weight:700;letter-spacing:9px;">${ctx.esc(ctx.code.text)}</div>
        <div style="margin-top:8px;color:${C.muted};font-family:${ctx.mono};font-size:11.5px;">expires in ${ctx.esc(ctx.code.ttl)}m</div>
      </td></tr>
    </table>
  </td></tr>`;
}

function contentBlock(ctx) {
  if (ctx.rawHtml) {
    return `<tr><td style="padding:16px 28px 0 28px;color:${C.text};font-size:13.5px;line-height:1.85;">${ctx.rawHtml}</td></tr>`;
  }
  if (ctx.rawText) {
    return `<tr><td style="padding:16px 28px 0 28px;color:${C.text};font-size:13.5px;line-height:1.85;white-space:pre-wrap;">${ctx.esc(
      ctx.rawText
    )}</td></tr>`;
  }
  if (ctx.rawInner) {
    return `<tr><td style="padding:16px 28px 0 28px;color:${C.text};font-size:13.5px;line-height:1.85;">${ctx.rawInner}</td></tr>`;
  }
  return '';
}

function buttonBlock(ctx) {
  if (!ctx.button) return '';
  return `<tr><td style="padding:20px 28px 4px 28px;">
    <table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td style="background-color:${C.green};border-radius:6px;">
        <a href="${ctx.esc(ctx.button.url)}" target="_blank" style="display:inline-block;padding:9px 18px;color:#FFFFFF;font-size:13px;font-weight:600;text-decoration:none;">${ctx.esc(
    ctx.button.text
  )}</a>
      </td>
    </tr></table>
    <p style="margin:12px 0 0 0;color:${C.faint};font-family:${ctx.mono};font-size:11px;line-height:1.7;word-break:break-all;">&rarr; <a href="${ctx.esc(
    ctx.button.url
  )}" target="_blank" style="color:${C.link};text-decoration:none;">${ctx.esc(ctx.button.url)}</a></p>
  </td></tr>`;
}

function signatureBlock(ctx) {
  if (!ctx.signature) return '';
  return `<tr><td style="padding:16px 28px 0 28px;">
    <p style="margin:0;padding:10px 12px;background-color:${C.codeBg};border-radius:6px;color:${C.muted};font-family:${ctx.mono};font-size:11.5px;line-height:1.75;">// ${ctx.esc(
    ctx.signature
  )}</p>
  </td></tr>`;
}

function render(ctx) {
  const card = `${container({ bg: C.card, border: C.border, radius: 6, font: ctx.font })}
    <tr><td style="background-color:${C.header};border-bottom:1px solid ${C.border};padding:12px 18px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tr>
        <td style="font-family:${ctx.mono};font-size:12px;color:${C.muted};">
          <span style="color:${C.heading};font-weight:700;">HJSEC</span> <span style="color:${C.faint};">/</span> weekly-report
        </td>
        ${
          ctx.badge
            ? `<td align="right"><span style="display:inline-block;padding:3px 9px;background-color:${C.blueSoft};color:${C.link};border-radius:999px;font-size:11.5px;font-weight:600;white-space:nowrap;">${ctx.esc(
                ctx.badge
              )}</span></td>`
            : ''
        }
      </tr></table>
    </td></tr>

    <tr><td style="padding:22px 28px 0 28px;">
      <h1 style="margin:0;color:${C.heading};font-size:20px;font-weight:600;line-height:1.5;letter-spacing:-.1px;">${ctx.esc(
        ctx.heading
      ) || '&nbsp;'}</h1>
      ${ctx.intro ? `<p style="margin:9px 0 0 0;color:${C.muted};font-size:13.5px;line-height:1.8;">${ctx.esc(ctx.intro)}</p>` : ''}
    </td></tr>

    <tr><td style="padding:16px 28px 0 28px;"><div style="height:1px;background-color:${C.border};line-height:1px;font-size:0;">&nbsp;</div></td></tr>

    ${statusChip(ctx)}
    ${infoTable(ctx)}
    ${bodyBlock(ctx)}
    ${quoteBlock(ctx)}
    ${codeBlock(ctx)}
    ${contentBlock(ctx)}
    ${buttonBlock(ctx)}
    ${signatureBlock(ctx)}

    <tr><td style="padding:20px 28px 0 28px;"><div style="height:1px;background-color:${C.border};line-height:1px;font-size:0;">&nbsp;</div></td></tr>
    <tr><td style="padding:14px 28px 22px 28px;">
      <p style="margin:0 0 5px 0;color:${C.muted};font-size:11.5px;line-height:1.7;">${ctx.esc(ctx.footerNote)}</p>
      <p style="margin:0;color:${C.faint};font-size:11.5px;line-height:1.7;">&copy; ${ctx.year} ${ctx.esc(ctx.org)}</p>
    </td></tr>
  </table>`;

  return document({
    title: ctx.docTitle,
    preheader: ctx.preheader,
    bg: C.page,
    font: ctx.font,
    inner: card,
    trailing: `<p style="margin:16px 0 0 0;color:${C.faint};font-family:${ctx.mono};font-size:10.5px;">generated by weekly-report-bot &middot; commit-ready</p>`
  });
}

module.exports = {
  key: 'developer',
  name: 'Developer 工程师',
  desc: 'GitHub 风格：细边框、代码块、标签式信息',
  mode: 'light',
  palette: { primary: C.green, page: C.page, accent: C.link },
  render
};
