'use strict';

/**
 * 主题注册表
 * 新增主题只要在三处出现：本文件 require + registry + ORDER。
 */

const nature = require('./nature');
const hacker = require('./hacker');
const cyberpunk = require('./cyberpunk');
const developer = require('./developer');
const minimal = require('./minimal');
const custom = require('./custom');
const ocean = require('./ocean');
const sunset = require('./sunset');
const forest = require('./forest');
const aurora = require('./aurora');

const registry = { nature, hacker, cyberpunk, developer, minimal, ocean, sunset, forest, aurora, custom };
const ORDER = ['nature', 'hacker', 'cyberpunk', 'developer', 'minimal', 'ocean', 'sunset', 'forest', 'aurora', 'custom'];

/** 旧版只有配色、没有版式，这里把历史值映射到最接近的新主题 */
const LEGACY = {
  forest: 'nature',
  sage: 'nature',
  mist: 'hacker',
  sunrise: 'nature',
  clay: 'nature',
  pine: 'hacker'
};

function get(key) {
  return registry[LEGACY[key]] || registry[key] || null;
}

function exists(key) {
  return !!get(key);
}

function keys() {
  return ORDER.slice();
}

function list() {
  return ORDER.map((k) => ({
    key: k,
    name: registry[k].name,
    desc: registry[k].desc,
    mode: registry[k].mode,
    palette: registry[k].palette
  }));
}

module.exports = { registry, ORDER, LEGACY, get, exists, keys, list };
