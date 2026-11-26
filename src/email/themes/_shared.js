'use strict';

/**
 * 主题公共外壳：<html>/<head>/<body> 与 580px 容器。
 * 只处理文档级的东西，视觉细节留给各主题。
 */

const { escapeHtml } = require('../engine/variables');

/**
 * @param {object} o
 *   o.title       <title>
 *   o.preheader   预览文本（隐藏）
 *   o.bg          页面背景色
 *   o.font        正文字体栈
 *   o.inner       容器 HTML
 *   o.pad         页面上下留白
 *   o.trailing    容器下方的小字（可选）
 */
function document({ title, preheader, bg, font, inner, pad = 32, trailing = '' }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<!--[if mso]><style>body,table,td,p,a,div{font-family:Segoe UI,Arial,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${bg};-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;color:${bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(
    preheader
  )}</div>
<table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="background-color:${bg};">
  <tr>
    <td align="center" style="padding:${pad}px 14px;">
      ${inner}
      ${trailing}
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** 580px 主容器开标签 */
function container({ max = 580, bg = '#FFFFFF', border = '', radius = 0, font, extra = '' }) {
  const borderStyle = border ? `border:1px solid ${border};` : '';
  return `<table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="max-width:${max}px;width:100%;background-color:${bg};${borderStyle}border-radius:${radius}px;overflow:hidden;font-family:${font};${extra}">`;
}

module.exports = { document, container };
