'use strict';

/** 系统设置（简单 key-value，全部存 settings 表） */

const { db } = require('./db');
const { REPORT_GROUPS } = require('./taxonomy');
const { get: cfgGet } = require('./config');

// 默认值统一从 appsettings.json 读（数据库里有值就以数据库为准，后台改过的不丢）
const DEFAULTS = {
  site_name: 'HJSEC 安全学习周报',
  site_tagline: '记录每一次学习，见证每一步成长', // 平台标语
  site_description: '', // 平台简介（登录页 / 页脚）
  site_icp: '', // ICP 备案号
  ui_style: 'zhihu', // github | zhihu —— 默认界面风格
  ui_locked: 'false', // true = 锁定界面风格，用户不能手动切换
  default_avatar_provider: 'letter', // letter | github —— 无自定义头像时的默认头像样式
  site_notice: '',
  allow_register: 'true',
  // 注册策略
  email_enabled: 'true', // 邮箱功能总开关：false = 无 SMTP 场景，注册跳过验证、重置密码引导联系管理员
  register_auto_activate: 'true', // true = 自动激活（无需邮箱验证）；false = 邮箱验证码激活
  register_need_review: 'false', // true = 注册后需管理员审核（pending），与激活方式独立
  register_verify_email: 'true', // 兼容旧字段
  register_email_domains: '', // 邮箱域名白名单，逗号分隔，空 = 不限制
  register_domain_mode: 'off', // off | allow | deny —— 白名单/黑名单模式
  comment_mail: String(cfgGet('features.commentMail', true)) === 'false' ? 'false' : 'true',
  reminder_enabled: cfgGet('features.reminders.enabled', true) === false ? 'false' : 'true',
  reminder_sat_time: String(cfgGet('features.reminders.satTime', '22:00')),
  reminder_sun_time: String(cfgGet('features.reminders.sunTime', '22:00')),
  reminder_mode: cfgGet('features.reminders.mode', 'all') === 'selected' ? 'selected' : 'all',
  site_url: String(cfgGet('mail.siteUrl', 'https://example.com')),
  mail_theme: 'random', // 旧字段，保留兼容；新逻辑读 mail_theme_mode / mail_theme_default
  mail_theme_mode: 'random', // random | fixed —— 随机主题 / 固定主题
  mail_theme_default: 'nature', // 固定模式使用，也是全部禁用时的兜底主题
  mail_custom_html: '', // 管理员自定义 HTML 模板（{{content}} 占位）
  mail_themes_enabled: '', // JSON 数组，空 = 全部启用（nature/hacker/cyberpunk/developer/minimal）
  week_base_start: String(cfgGet('week.baseStart', '2026-09-14')),
  week_base_number: String(cfgGet('week.baseNumber', 1))
};

const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setStmt = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

function get(key) {
  const row = getStmt.get(key);
  if (row) return row.value;
  return Object.prototype.hasOwnProperty.call(DEFAULTS, key) ? DEFAULTS[key] : '';
}

function set(key, value) {
  setStmt.run(key, String(value));
}

function siteSettings() {
  let groups = [];
  try {
    groups = db
      .prepare('SELECT name FROM report_groups ORDER BY id ASC')
      .all()
      .map((r) => r.name);
  } catch (e) {
    groups = [];
  }
  const logo = get('site_logo');
  let modal = { enabled: false, title: '', body: '', version: '' };
  try {
    const raw = get('notice_modal');
    if (raw) {
      const parsed = JSON.parse(raw);
      modal = {
        enabled: !!parsed.enabled,
        title: String(parsed.title || ''),
        body: String(parsed.body || ''),
        version: String(parsed.version || '')
      };
    }
  } catch (e) {
    /* 配置坏了就当没公告 */
  }
  return {
    siteName: get('site_name'),
    siteTagline: get('site_tagline'),
    siteDescription: get('site_description'),
    siteIcp: get('site_icp'),
    uiStyle: get('ui_style') === 'github' ? 'github' : 'zhihu',
    uiLocked: get('ui_locked') === 'true',
    defaultAvatarProvider: get('default_avatar_provider') === 'github' ? 'github' : 'letter',
    logoUrl: logo ? `/api/branding/logo?v=${encodeURIComponent(String(logo).replace(/\.[a-z0-9]+$/i, ''))}` : '',
    siteNotice: get('site_notice'),
    allowRegister: get('allow_register') === 'true',
    emailEnabled: get('email_enabled') !== 'false',
    registerAutoActivate: get('register_auto_activate') !== 'false',
    registerNeedReview: get('register_need_review') === 'true',
    modalNotice: modal,
    reportGroups: groups.length ? groups : REPORT_GROUPS
  };
}

module.exports = { get, set, siteSettings, DEFAULTS };
