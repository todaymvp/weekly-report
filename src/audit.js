'use strict';

/**
 * 审计日志：谁在什么时候做了什么
 *   audit({ actor, action, targetType, targetId, detail, req })
 * 落表 audit_logs（后台「日志」页可查），同时按 info 级别打到 stdout，
 * 所以 `docker logs` 里也能看到同一条记录。
 */

const { db } = require('./db');
const { nowIso } = require('./helpers');
const log = require('./logger');

const MAX_DETAIL = 500;

function clientInfo(req) {
  if (!req) return { ip: '', ua: '' };
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || '';
  const ua = String(req.get ? req.get('user-agent') || '' : '').slice(0, 200);
  return { ip, ua };
}

function audit({ actor, action, targetType = '', targetId = null, detail = '', req = null }) {
  try {
    const { ip, ua } = clientInfo(req);
    const actorId = actor && actor.id ? actor.id : null;
    // 系统自身触发的事件（定时清理、匿名发信等）统一记成 system
    const actorName = actor ? actor.username || 'system' : 'system';
    const text = String(detail == null ? '' : detail).slice(0, MAX_DETAIL);

    db.prepare(
      `INSERT INTO audit_logs (actor_id, actor_name, action, target_type, target_id, detail, ip, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(actorId, actorName, action, targetType, targetId, text, ip, ua, nowIso());

    const target = targetType ? `${targetType}:${targetId == null ? '-' : targetId}` : '-';
    log.info(`audit ${action}`, { actor: actorName, target, detail: text, ip });
  } catch (e) {
    // 审计失败绝不能影响业务
    log.error('[audit] 写入失败：' + e.message);
  }
}

/** 只保留最近 N 天的日志，启动时和每小时各跑一次 */
function pruneAuditLogs(days = 90) {
  try {
    const before = new Date(Date.now() - days * 86400000).toISOString();
    const info = db.prepare('DELETE FROM audit_logs WHERE created_at < ?').run(before);
    if (info.changes) log.info(`[audit] 清理 ${info.changes} 条 ${days} 天前的日志`);
    return info.changes;
  } catch (e) {
    log.error('[audit] 清理失败：' + e.message);
    return 0;
  }
}

module.exports = { audit, pruneAuditLogs };
