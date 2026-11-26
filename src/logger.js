'use strict';

/**
 * 轻量结构化日志（输出到 stdout/stderr，`docker logs` 直接可看）
 *   LOG_LEVEL=debug|info|warn|error（默认 info）
 * 格式：2026-11-23T10:40:03.123Z INFO  GET /api/reports 200 12ms {"ip":"1.2.3.4","user":"admin"}
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const CURRENT = String(process.env.LOG_LEVEL || 'info').toLowerCase();
const THRESHOLD = LEVELS[CURRENT] || LEVELS.info;

function stamp() {
  return new Date().toISOString();
}

function fmt(extra) {
  if (extra === undefined || extra === null || extra === '') return '';
  try {
    return ' ' + (typeof extra === 'string' ? extra : JSON.stringify(extra));
  } catch (e) {
    return ' ' + String(extra);
  }
}

function emit(level, msg, extra) {
  if (LEVELS[level] < THRESHOLD) return;
  const line = `${stamp()} ${level.toUpperCase().padEnd(5)} ${msg}${fmt(extra)}`;
  if (level === 'error') console.error(line);
  else console.log(line);
}

module.exports = {
  level: CURRENT,
  debug: (m, e) => emit('debug', m, e),
  info: (m, e) => emit('info', m, e),
  warn: (m, e) => emit('warn', m, e),
  error: (m, e) => emit('error', m, e)
};
