'use strict';

/**
 * 主题选择器（服务端）
 *
 * 规则：
 *  - random 模式：只从「已启用」主题里抽；全部禁用 → 回退默认主题 nature
 *  - fixed 模式：始终使用指定主题（不看启用列表）
 *  - 同一次发送只调用一次 select()，渲染与日志共用同一个 key
 */

const themes = require('../themes');

const DEFAULT_THEME = 'nature';

function safeGet(key) {
  try {
    return require('../../settings').get(key) || '';
  } catch (e) {
    return '';
  }
}

/** 旧配置里可能只有 mail_theme=forest，这里归一化 */
function normalize(key) {
  const k = String(key || '');
  if (!k) return '';
  return themes.exists(k) ? themes.LEGACY[k] || k : '';
}

/** 已启用主题（空数组 = 全部禁用） */
function enabledThemes() {
  const raw = safeGet('mail_themes_enabled');
  if (!raw) return themes.keys();
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch (e) {
    return themes.keys();
  }
  if (!Array.isArray(arr)) return themes.keys();
  const out = [];
  for (const item of arr) {
    const k = normalize(item);
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

function mode() {
  const m = safeGet('mail_theme_mode');
  if (m === 'fixed' || m === 'random') return m;
  const legacy = safeGet('mail_theme');
  if (legacy === 'random') return 'random';
  if (legacy) return 'fixed';
  return 'random';
}

function fixedTheme() {
  return normalize(safeGet('mail_theme_default')) || normalize(safeGet('mail_theme')) || DEFAULT_THEME;
}

/** 从数组里随机取一个（可单测） */
function pickFrom(list) {
  if (!Array.isArray(list) || !list.length) return DEFAULT_THEME;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * @returns {{key:string, mode:'random'|'fixed', pool:string[], fallback:boolean}}
 */
function select() {
  if (mode() === 'fixed') {
    const key = fixedTheme();
    return { key, mode: 'fixed', pool: [key], fallback: false };
  }
  const pool = enabledThemes();
  if (!pool.length) {
    return { key: DEFAULT_THEME, mode: 'random', pool, fallback: true };
  }
  return { key: pickFrom(pool), mode: 'random', pool, fallback: false };
}

/** 后台展示用快照 */
function snapshot() {
  return {
    mode: mode(),
    enabled: enabledThemes(),
    defaultTheme: fixedTheme(),
    all: themes.list()
  };
}

module.exports = {
  DEFAULT_THEME,
  select,
  pickFrom,
  enabledThemes,
  mode,
  fixedTheme,
  normalize,
  snapshot
};
