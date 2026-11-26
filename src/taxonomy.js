'use strict';

/**
 * 周报方向分组：写周报时选一个，仪表盘/总览按它聚合与筛选。
 * 需要增删分组时改这里即可（前端会通过 /api/site 拿到同一份列表）。
 */
const REPORT_GROUPS = ['基础知识', '逆向工程', 'Web 安全', 'Pwn', '密码学', '杂项'];

module.exports = { REPORT_GROUPS };
