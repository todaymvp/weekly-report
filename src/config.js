'use strict';

/**
 * 统一配置加载：appsettings.json + 环境变量
 *
 * 优先级（从高到低）：
 *   1. 进程环境变量（docker compose / CI / 命令行里设的，方便临时覆盖）
 *   2. appsettings.json（本文件，日常改这里就够）
 *   3. 代码内置默认值
 *
 * appsettings.json 里的字符串支持引用环境变量：  "pass": "${SMTP_PASS}"
 * （适合把密钥留在 .env 里，其余配置放在 json 里）
 *
 * 路径可用 APPSETTINGS_FILE 指定，默认仓库根目录的 appsettings.json
 */

const fs = require('fs');
const path = require('path');
const log = require('./logger');

const FILE = process.env.APPSETTINGS_FILE || path.join(__dirname, '..', 'appsettings.json');

const DEFAULTS = {
  server: {
    port: 3000,
    logLevel: 'info',
    trustProxy: false,
    cookieSecure: true,
    devCodeHint: false
  },
  database: { dataDir: '' },
  mail: {
    mode: '', // 留空 = 配了 host 就 smtp，否则 console
    host: '',
    port: 465,
    secure: true,
    user: '',
    pass: '',
    from: '',
    siteUrl: ''
  },
  week: { baseStart: '2026-09-14', baseNumber: 1 },
  features: {
    commentMail: true,
    reminders: { enabled: true, satTime: '22:00', sunTime: '22:00', mode: 'all', ids: [] }
  },
  admin: { username: 'admin', email: 'admin@example.com', password: 'please-change-me' }
};

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function merge(base, patch) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const [k, v] of Object.entries(patch || {})) {
    if (isPlainObject(v) && isPlainObject(out[k])) out[k] = merge(out[k], v);
    else out[k] = v;
  }
  return out;
}

/** 把 "abc${VAR}def" 换成环境变量的值；${VAR:-默认} 支持缺省 */
function interpolate(value) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g, (_m, key, fallback) => {
      const v = process.env[key];
      if (v !== undefined && v !== '') return v;
      return fallback !== undefined ? fallback : '';
    });
  }
  if (Array.isArray(value)) return value.map(interpolate);
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolate(v);
    return out;
  }
  return value;
}

let fileConfig = {};
let loaded = false;

function loadFile() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    fileConfig = JSON.parse(raw);
    loaded = true;
    log.info(`[config] 已加载 ${path.basename(FILE)}`);
  } catch (e) {
    if (e.code === 'ENOENT') {
      log.warn(`[config] 没有 ${path.basename(FILE)}，使用环境变量 + 内置默认值`);
    } else {
      log.error(`[config] ${path.basename(FILE)} 解析失败：${e.message}（已忽略，改用环境变量）`);
    }
    fileConfig = {};
  }
}

loadFile();

const config = interpolate(merge(DEFAULTS, fileConfig));

/** 把配置文件里的值补进 process.env（只在环境变量没设时），
 *  这样仍按 env 读取的老代码路径（mailer 等）也能受益 */
function applyEnv() {
  const pairs = [
    ['PORT', config.server.port],
    ['LOG_LEVEL', config.server.logLevel],
    ['TRUST_PROXY', String(!!config.server.trustProxy)],
    ['COOKIE_SECURE', String(!!config.server.cookieSecure)],
    ['DEV_CODE_HINT', String(!!config.server.devCodeHint)],
    ['DATA_DIR', config.database.dataDir],
    ['MAIL_MODE', config.mail.mode],
    ['SMTP_HOST', config.mail.host],
    ['SMTP_PORT', config.mail.port],
    ['SMTP_SECURE', String(!!config.mail.secure)],
    ['SMTP_USER', config.mail.user],
    ['SMTP_PASS', config.mail.pass],
    ['MAIL_FROM', config.mail.from],
    ['SITE_URL', config.mail.siteUrl],
    ['ADMIN_USERNAME', config.admin.username],
    ['ADMIN_EMAIL', config.admin.email],
    ['ADMIN_PASSWORD', config.admin.password]
  ];
  for (const [key, value] of pairs) {
    const v = value === undefined || value === null ? '' : String(value);
    if (process.env[key] === undefined && v !== '') process.env[key] = v;
  }
}
applyEnv();

/** 点路径取值：get('mail.host') */
function get(dotted, fallback) {
  const parts = String(dotted).split('.');
  let cur = config;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return fallback;
    cur = cur[p];
  }
  return cur === undefined ? fallback : cur;
}

module.exports = { config, get, applyEnv, FILE, loaded: () => loaded };
