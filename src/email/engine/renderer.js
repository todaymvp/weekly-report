'use strict';

/**
 * 渲染器：把业务字段 + 主题 → 完整 HTML 邮件
 */

const themes = require('../themes');
const selector = require('./selector');
const { buildContext } = require('./variables');

/**
 * 指定主题渲染
 * @returns {{html:string, theme:string, themeName:string}}
 */
function renderWithTheme(themeKey, o = {}) {
  const theme = themes.get(themeKey) || themes.get(selector.DEFAULT_THEME);
  const ctx = buildContext(o);
  return { html: theme.render(ctx), theme: theme.key, themeName: theme.name };
}

/** 兼容旧 render(o)：o.theme 可指定主题，否则按配置随机 */
function render(o = {}, opts = {}) {
  const explicit = opts.theme || o.theme;
  const key = themes.exists(explicit) ? (themes.LEGACY[explicit] || explicit) : selector.select().key;
  return renderWithTheme(key, o).html;
}

/**
 * 发送链路用：先选主题，再渲染，主题 key 与 HTML 一起返回，
 * 调用方把同一个 key 写进日志 / 重试时复用。
 */
function renderSelected(o = {}) {
  const sel = selector.select();
  const out = renderWithTheme(sel.key, o);
  return { html: out.html, theme: out.theme, themeName: out.themeName, selection: sel };
}

module.exports = { render, renderWithTheme, renderSelected };
