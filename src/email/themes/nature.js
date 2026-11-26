'use strict';

/**
 * Nature · 自然治愈风
 * 森林绿 + 米白 + 鼠尾草绿；圆角卡片、衬线标题、叶片符号，安静温暖。
 */

const { document, container } = require('./_shared');

const ORDER = {
  primary: '#365744',
  heading: '#2F4A39',
  accent: '#8FA687',
  tint: '#F1F5EC',
  line: '#E1E8DA',
  text: '#5F6F5D',
  warm: '#B17D42',
  page: '#F2F5EC'
};

const SERIF = "Georgia,'Songti SC','Noto Serif CJK SC',serif";

function statusPill(ctx) {
  if (!ctx.status) return '';
  const pending = ctx.status.tone === 'pending';
  const bg = pending ? '#FBF3E6' : ORDER.tint;
  const fg = pending ? ORDER.warm : ORDER.primary;
  return `<tr><td style="padding:2px 32px 0 32px;">
    <span style="display:inline-block;padding:5px 13px;background-color:${bg};color:${fg};border-radius:999px;font-size:12px;font-weight:600;">${ctx.esc(
    ctx.status.text
  )}</span>
  </td></tr>`;
}

function infoRows(ctx) {
  if (!ctx.info.length) return '';
  return `<tr><td style="padding:20px 32px 0 32px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${ORDER.tint};border-radius:12px;">
      <tr><td style="padding:6px 18px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
          ${ctx.info
            .map(
              (r) => `<tr>
            <td style="padding:9px 0;color:${ORDER.text};font-size:13px;line-height:1.7;width:44%;">${ctx.esc(r.label)}</td>
            <td style="padding:9px 0;color:${ORDER.heading};font-size:13px;line-height:1.7;font-weight:600;text-align:right;">${ctx.esc(
              r.value
            )}</td>
          </tr>`
            )
            .join('')}
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function bodyBlock(ctx) {
  if (!ctx.body) return '';
  return `<tr><td style="padding:18px 32px 0 32px;color:${ORDER.text};font-size:14px;line-height:1.85;">${ctx.body}</td></tr>`;
}

function quoteBlock(ctx) {
  if (!ctx.quote) return '';
  return `<tr><td style="padding:18px 32px 0 32px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${ORDER.tint};border-radius:10px;">
      <tr><td style="padding:14px 18px;border-left:3px solid ${ORDER.accent};color:${ORDER.heading};font-size:13.5px;line-height:1.85;font-style:italic;">${ctx.esc(
    ctx.quote
  )}</td></tr>
    </table>
  </td></tr>`;
}

function codeBlock(ctx) {
  if (!ctx.code) return '';
  return `<tr><td style="padding:18px 32px 0 32px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${ORDER.tint};border-radius:12px;">
      <tr><td align="center" style="padding:20px 18px;">
        <div style="color:${ORDER.heading};font-size:30px;font-weight:700;letter-spacing:10px;font-family:${ctx.mono};">${ctx.esc(
    ctx.code.text
  )}</div>
        <div style="margin-top:8px;color:${ORDER.text};font-size:12px;">${ctx.esc(ctx.code.ttl)} 分钟内有效，若非本人操作请忽略本邮件。</div>
      </td></tr>
    </table>
  </td></tr>`;
}

function contentBlock(ctx) {
  if (ctx.rawHtml) {
    return `<tr><td style="padding:18px 32px 0 32px;color:${ORDER.text};font-size:14px;line-height:1.85;">${ctx.rawHtml}</td></tr>`;
  }
  if (ctx.rawText) {
    return `<tr><td style="padding:18px 32px 0 32px;color:${ORDER.text};font-size:14px;line-height:1.85;white-space:pre-wrap;">${ctx.esc(
      ctx.rawText
    )}</td></tr>`;
  }
  if (ctx.rawInner) {
    return `<tr><td style="padding:18px 32px 0 32px;color:${ORDER.text};font-size:14px;line-height:1.85;">${ctx.rawInner}</td></tr>`;
  }
  return '';
}

function buttonBlock(ctx) {
  if (!ctx.button) return '';
  return `<tr><td style="padding:24px 32px 2px 32px;">
    <table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td align="center" style="background-color:${ORDER.primary};border-radius:999px;">
        <a href="${ctx.esc(ctx.button.url)}" target="_blank" style="display:inline-block;padding:12px 30px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:.3px;">${ctx.esc(
    ctx.button.text
  )}</a>
      </td>
    </tr></table>
    <p style="margin:12px 0 0 0;color:${ORDER.accent};font-size:11.5px;line-height:1.65;word-break:break-all;">按钮无法点击时，请复制链接：<a href="${ctx.esc(
    ctx.button.url
  )}" target="_blank" style="color:${ORDER.primary};text-decoration:underline;">${ctx.esc(ctx.button.url)}</a></p>
  </td></tr>`;
}

function signatureBlock(ctx) {
  if (!ctx.signature) return '';
  return `<tr><td style="padding:20px 32px 4px 32px;">
    <p style="margin:0;color:${ORDER.accent};font-size:12.5px;line-height:1.8;font-style:italic;">${ctx.esc(ctx.signature)}</p>
  </td></tr>`;
}

function render(ctx) {
  const card = `${container({ bg: '#FFFFFF', border: ORDER.line, radius: 16, font: ctx.font })}
    <tr><td style="height:4px;background-color:${ORDER.primary};line-height:4px;font-size:0;">&nbsp;</td></tr>

    <tr><td style="padding:26px 32px 16px 32px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation"><tr>
        <td style="vertical-align:middle;">
          <table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="width:36px;height:36px;background-color:${ORDER.primary};border-radius:50%;text-align:center;vertical-align:middle;color:#FFFFFF;font-size:15px;font-weight:700;">H</td>
            <td style="padding-left:12px;vertical-align:middle;">
              <div style="color:${ORDER.heading};font-size:15px;font-weight:700;letter-spacing:.3px;">HJSEC</div>
              <div style="color:${ORDER.accent};font-size:9.5px;letter-spacing:1.8px;margin-top:2px;">WEEKLY · GROW SLOWLY</div>
            </td>
          </tr></table>
        </td>
        ${
          ctx.badge
            ? `<td align="right"><span style="display:inline-block;padding:5px 12px;background-color:${ORDER.tint};color:${ORDER.primary};border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap;">${ctx.esc(
                ctx.badge
              )}</span></td>`
            : ''
        }
      </tr></table>
    </td></tr>

    <tr><td style="padding:4px 32px 0 32px;">
      <h1 style="margin:0;color:${ORDER.heading};font-family:${SERIF};font-size:23px;font-weight:400;line-height:1.5;letter-spacing:.2px;">${
    ctx.esc(ctx.heading) || '&nbsp;'
  }</h1>
      ${ctx.intro ? `<p style="margin:10px 0 0 0;color:${ORDER.text};font-size:14px;line-height:1.85;">${ctx.esc(ctx.intro)}</p>` : ''}
    </td></tr>

    <tr><td style="padding:18px 32px 0 32px;"><div style="height:1px;background-color:${ORDER.line};line-height:1px;font-size:0;">&nbsp;</div></td></tr>

    ${statusPill(ctx)}
    ${infoRows(ctx)}
    ${bodyBlock(ctx)}
    ${quoteBlock(ctx)}
    ${codeBlock(ctx)}
    ${contentBlock(ctx)}
    ${buttonBlock(ctx)}
    ${signatureBlock(ctx)}

    <tr><td style="padding:24px 32px 0 32px;"><div style="height:1px;background-color:${ORDER.line};line-height:1px;font-size:0;">&nbsp;</div></td></tr>
    <tr><td style="padding:16px 32px 24px 32px;">
      <p style="margin:0 0 5px 0;color:${ORDER.text};font-size:11.5px;line-height:1.7;">${ctx.esc(ctx.footerNote)}</p>
      <p style="margin:0;color:${ORDER.accent};font-size:11.5px;line-height:1.7;">&copy; ${ctx.year} ${ctx.esc(ctx.org)}</p>
    </td></tr>
  </table>`;

  return document({
    title: ctx.docTitle,
    preheader: ctx.preheader,
    bg: ORDER.page,
    font: ctx.font,
    inner: card,
    trailing: `<p style="margin:16px 0 0 0;color:${ORDER.accent};font-size:10.5px;letter-spacing:1.2px;font-family:${ctx.font};">HJSEC · WEEKLY REPORT · 慢慢来，比较快</p>`
  });
}

module.exports = {
  key: 'nature',
  name: 'Nature 自然',
  desc: '森林绿 + 米白，圆角与衬线标题，温暖治愈',
  mode: 'light',
  palette: { primary: ORDER.primary, page: ORDER.page, accent: ORDER.accent },
  render
};
