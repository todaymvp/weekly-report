'use strict';

/**
 * 周报提醒（周六 / 周日两次邮件）
 *   - 周六 22:00：本周还没提交 → 提醒一下
 *   - 周日 22:00：仍未提交 → 发一封「本周未提交」通知
 *   - 管理员可配时间、可指定发给谁、可手动立即发送
 * 幂等：每次运行把日期写进 settings（reminder_last_sat / reminder_last_sun），同一天只发一次。
 */

const { db } = require('./db');
const { weekStartOf, siteUrl } = require('./helpers');
const { sendMail, isConfigured } = require('./mailer');
const settings = require('./settings');
const { audit } = require('./audit');
const log = require('./logger');

const DEFAULT_SAT = '22:00';
const DEFAULT_SUN = '22:00';

const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** 第 N 周：以「周次基准」推算，和前端展示保持一致 */
function weekNumber(weekStart) {
  const baseStart = settings.get('week_base_start') || '2026-09-14';
  const baseNum = parseInt(settings.get('week_base_number') || '1', 10) || 1;
  const diff = (new Date(weekStart + 'T00:00:00') - new Date(baseStart + 'T00:00:00')) / (7 * 86400000);
  return Math.max(1, baseNum + Math.round(diff));
}

function config() {
  let ids = [];
  try {
    const raw = settings.get('reminder_ids');
    ids = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids)) ids = [];
  } catch (e) {
    ids = [];
  }
  return {
    enabled: settings.get('reminder_enabled') !== 'false',
    satTime: settings.get('reminder_sat_time') || DEFAULT_SAT,
    sunTime: settings.get('reminder_sun_time') || DEFAULT_SUN,
    mode: settings.get('reminder_mode') === 'selected' ? 'selected' : 'all',
    ids: ids.map(Number).filter((n) => Number.isInteger(n) && n > 0),
    lastSat: settings.get('reminder_last_sat') || '',
    lastSun: settings.get('reminder_last_sun') || ''
  };
}

function saveConfig(patch) {
  if (patch.enabled !== undefined) settings.set('reminder_enabled', patch.enabled ? 'true' : 'false');
  if (patch.satTime !== undefined && /^\d{2}:\d{2}$/.test(String(patch.satTime)))
    settings.set('reminder_sat_time', String(patch.satTime));
  if (patch.sunTime !== undefined && /^\d{2}:\d{2}$/.test(String(patch.sunTime)))
    settings.set('reminder_sun_time', String(patch.sunTime));
  if (patch.mode !== undefined) settings.set('reminder_mode', patch.mode === 'selected' ? 'selected' : 'all');
  if (patch.ids !== undefined) {
    const valid = new Set(db.prepare('SELECT id FROM users').all().map((u) => u.id));
    const clean = [...new Set((Array.isArray(patch.ids) ? patch.ids : []).map(Number))].filter((id) => valid.has(id));
    settings.set('reminder_ids', JSON.stringify(clean));
  }
  return config();
}

/** 本周还没提交的人（按配置的发送对象过滤） */
function pendingUsers(weekStart = weekStartOf()) {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.display_name, u.status
       FROM users u
       WHERE u.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM reports r
           WHERE r.user_id = u.id AND r.week_start = ? AND r.status = 'submitted'
         )
       ORDER BY u.id ASC`
    )
    .all(weekStart);

  const cfg = config();
  if (cfg.mode === 'selected') {
    const allow = new Set(cfg.ids);
    return rows.filter((u) => allow.has(u.id));
  }
  return rows;
}

function buildMail(stage, user, weekStart, total) {
  const wk = weekNumber(weekStart);
  const link = `${siteUrl()}/#/report/new?week=${weekStart}`;
  const name = user.display_name || user.username;
  const templates = require('./mail_templates');

  if (stage === 'sat') {
    const mail = templates.renderMail('reminderSat', { ownerName: name, reportUrl: link, weekNumber: wk });
    return {
      subject: `【学习周报】别忘了提交第 ${wk} 周周报`,
      text: templates.plain('reminderSat', { ownerName: name, reportUrl: link, weekNumber: wk }),
      html: mail.html,
      theme: mail.theme
    };
  }

  const mail = templates.renderMail('reminderSun', { ownerName: name, reportUrl: link, weekNumber: wk });
  return {
    subject: `【学习周报】第 ${wk} 周周报还差你一份`,
    text: templates.plain('reminderSun', { ownerName: name, reportUrl: link, weekNumber: wk }),
    html: mail.html,
    theme: mail.theme
  };
}

/**
 * 发送一轮提醒
 * @param {'sat'|'sun'} stage
 * @param {{actor?: object, manual?: boolean, onlyIds?: number[]}} opts
 */
async function sendRound(stage, opts = {}) {
  const weekStart = weekStartOf();
  let targets = pendingUsers(weekStart);
  if (Array.isArray(opts.onlyIds) && opts.onlyIds.length) {
    const allow = new Set(opts.onlyIds.map(Number));
    targets = targets.filter((u) => allow.has(u.id));
  }
  targets = targets.filter((u) => u.email);

  let sent = 0;
  let failed = 0;
  for (const u of targets) {
    const mail = buildMail(stage, u, weekStart, targets.length);
    try {
      await sendMail({
        to: u.email,
        toName: u.display_name || u.username,
        type: stage === 'sat' ? 'reminder_sat' : 'reminder_sun',
        ...mail
      });
      sent += 1;
    } catch (e) {
      failed += 1;
    }
  }

  audit({
    actor: opts.actor || null,
    action: 'reminder_send',
    targetType: 'reminder',
    detail: `${stage === 'sat' ? '周六提醒' : '周日未提交通知'}${opts.manual ? '（手动）' : ''}：本周未提交 ${targets.length} 人，成功 ${sent}，失败 ${failed}`,
    req: opts.req || null
  });
  log.info(`[reminder] ${stage} 发送完成`, { week: weekStart, targets: targets.length, sent, failed, manual: !!opts.manual, mailMode: isConfigured() ? 'smtp' : 'console' });
  return {
    stage,
    weekStart,
    weekNumber: weekNumber(weekStart),
    targets: targets.length,
    sent,
    failed,
    mailMode: isConfigured() ? 'smtp' : 'console' // console 模式下"成功"只是写了日志，没有真发信
  };
}

/** 每分钟检查一次是否到点（同一天同一阶段只跑一次） */
function tick(now = new Date()) {
  try {
    const cfg = config();
    if (!cfg.enabled) return;
    const day = now.getDay(); // 6=周六 0=周日
    const hm = fmtTime(now);
    const today = fmtDate(now);

    if (day === 6 && hm >= cfg.satTime && cfg.lastSat !== today) {
      settings.set('reminder_last_sat', today);
      log.info(`[reminder] 触发周六提醒 ${today} ${hm}`);
      sendRound('sat').catch((e) => log.error('[reminder] sat 失败：' + e.message));
    }
    if (day === 0 && hm >= cfg.sunTime && cfg.lastSun !== today) {
      settings.set('reminder_last_sun', today);
      log.info(`[reminder] 触发周日未提交通知 ${today} ${hm}`);
      sendRound('sun').catch((e) => log.error('[reminder] sun 失败：' + e.message));
    }
  } catch (e) {
    log.error('[reminder] tick 异常：' + e.message);
  }
}

function startScheduler() {
  const timer = setInterval(() => tick(), 60 * 1000);
  timer.unref();
  tick(); // 启动时也检查一次（避免正好卡在 22:00 重启漏发）
  return timer;
}

module.exports = { config, saveConfig, pendingUsers, sendRound, tick, startScheduler, weekNumber, DEFAULT_SAT, DEFAULT_SUN };
