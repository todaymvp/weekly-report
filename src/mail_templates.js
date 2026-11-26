'use strict';

/**
 * HJSEC 周报系统 · 邮件模板（业务层）
 *
 * 结构：
 *   mail_templates.js        业务内容（标题 / 正文 / 状态 / 按钮）+ 站点文案
 *   email/engine/renderer    主题渲染入口
 *   email/engine/selector    随机 / 固定主题选择
 *   email/engine/variables   统一变量接口
 *   email/themes/*           五套视觉主题（Nature / Hacker / Cyberpunk / Developer / Minimal）
 *
 * 原则：一套业务逻辑，多套视觉主题，服务端随机选择，统一变量渲染。
 * 业务函数签名保持不变，主题只影响视觉，不影响字段与跳转地址。
 */

const renderer = require('./email/engine/renderer');
const selector = require('./email/engine/selector');
const themes = require('./email/themes');
const { SITE_NAME, ORG, FONT, MONO, escapeHtml } = require('./email/engine/variables');

const STATUS = { ok: 'ok', pending: 'pending', info: 'info' };

// 预览时临时指定主题（不改变持久化设置）
let __themeOverride = '';

/* ------------------------------------------------------------------ *
 * 渲染入口
 * ------------------------------------------------------------------ */

function render(o = {}) {
  const explicit = __themeOverride || o.theme || '';
  return renderer.render(explicit ? { ...o, theme: explicit } : o, explicit ? { theme: explicit } : {});
}

/** 用指定主题渲染（预览用）：themeKey 可为 'random' */
function renderAs(themeKey, fn, data) {
  const prev = __themeOverride;
  if (themeKey === 'random') __themeOverride = selector.select().key;
  else __themeOverride = themeKey || '';
  try {
    return fn(data || {});
  } finally {
    __themeOverride = prev;
  }
}

function getThemeKey() {
  return selector.select().key;
}

function getTheme(key) {
  const t = themes.get(key);
  return t ? t.palette : themes.get(selector.DEFAULT_THEME).palette;
}

function themeList() {
  return themes.list();
}

/* ------------------------------------------------------------------ *
 * 业务模板
 * ------------------------------------------------------------------ */

/** 评论 / 回复通知 */
function commentMail({ actorName, ownerName, reportTitle, content, reportUrl, weekNumber, isReply, parentContent }) {
  return render({
    docTitle: `HJSEC · ${actorName} ${isReply ? '回复了你的评论' : '评论了你的周报'}`,
    badge: weekNumber ? `第 ${weekNumber} 周` : '',
    heading: `${actorName} ${isReply ? '回复了你的评论' : '评论了你的周报'}`,
    intro: isReply
      ? `你好，${ownerName}。你的评论收到了一条回复。`
      : `你好，${ownerName}。有人读了你的记录，并留下了想法。`,
    status: { text: isReply ? '新回复' : '新评论', tone: 'info' },
    info: [
      { label: '周报', value: reportTitle },
      { label: '周次', value: weekNumber ? `第 ${weekNumber} 周` : '' }
    ],
    body: isReply && parentContent
      ? `<p style="margin:0 0 8px 0;color:inherit;font-size:12.5px;">你之前写道：</p>`
      : '',
    quote: isReply && parentContent ? parentContent : content,
    rawInner: isReply && parentContent
      ? `<tr><td style="padding:12px 32px 0 32px;"><p style="margin:0 0 6px 0;color:inherit;font-size:12.5px;">${escapeHtml(actorName)} 回复：</p></td></tr>` +
        `<tr><td style="padding:0 32px 0 32px;"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#FFFFFF;border:1px solid #EAF0E6;border-radius:8px;"><tr><td style="padding:14px 18px;color:#304B39;font-size:13.5px;line-height:1.8;white-space:pre-wrap;">${escapeHtml(content)}</td></tr></table></td></tr>`
      : '',
    button: { text: isReply ? '查看对话' : '查看并回复', url: reportUrl },
    signature: isReply ? '有来有往的讨论，往往比一个人闷头看收获更多。' : '认真写下的每一段，都会有人认真读。'
  });
}

/** 周六提醒：别忘了提交 */
function reminderSat({ ownerName, reportUrl, weekNumber, deadline }) {
  return render({
    docTitle: 'HJSEC · 别忘了提交本周周报哦',
    badge: weekNumber ? `第 ${weekNumber} 周` : '',
    heading: '别忘了提交本周周报哦',
    intro: `你好，${ownerName}。新的一周已经开始啦，记得抽一点时间，整理本周的工作与收获。`,
    status: { text: '待提交', tone: 'pending' },
    info: [
      { label: '周报周期', value: weekNumber ? `第 ${weekNumber} 周` : '' },
      { label: '提交状态', value: '尚未提交' },
      { label: '截止时间', value: deadline || '本周日 22:00' }
    ],
    button: { text: '去提交周报', url: reportUrl },
    signature: '每一份认真记录，都是成长的印记。'
  });
}

/** 截止提醒 */
function deadlineReminder({ ownerName, reportUrl, weekNumber, deadline }) {
  return render({
    docTitle: 'HJSEC · 本周周报即将截止',
    badge: weekNumber ? `第 ${weekNumber} 周` : '',
    heading: '本周周报即将截止',
    intro: `你好，${ownerName}。还有一点时间，整理好就能提交了。`,
    status: { text: '即将截止', tone: 'pending' },
    info: [
      { label: '周报周期', value: weekNumber ? `第 ${weekNumber} 周` : '' },
      { label: '提交状态', value: '尚未提交' },
      { label: '截止时间', value: deadline || '本周日 22:00' }
    ],
    button: { text: '立即提交', url: reportUrl },
    signature: '不用追求完美，先把这周记下来就很好。'
  });
}

/** 周日未提交 */
function reminderSun({ ownerName, reportUrl, weekNumber, deadline }) {
  return render({
    docTitle: 'HJSEC · 本周周报还差你一份',
    badge: weekNumber ? `第 ${weekNumber} 周` : '',
    heading: '本周周报还差你一份',
    intro: `你好，${ownerName}。第 ${weekNumber} 周的周报这次没有收到，如果只是忘了，现在补交也来得及。`,
    status: { text: '未提交', tone: 'pending' },
    info: [
      { label: '周报周期', value: weekNumber ? `第 ${weekNumber} 周` : '' },
      { label: '提交状态', value: '未提交' },
      { label: '补交说明', value: '可在正文里注明' }
    ],
    button: { text: '去补交周报', url: reportUrl },
    signature: '偶尔落下也没关系，重要的是继续写下去。'
  });
}

/** 提交成功 */
function submitSuccess({ ownerName, reportTitle, reportUrl, weekNumber, chars }) {
  return render({
    docTitle: 'HJSEC · 已收到你的周报啦',
    badge: weekNumber ? `第 ${weekNumber} 周` : '',
    heading: '已收到你的周报啦',
    intro: `你好，${ownerName}。已经收到你的周报啦，感谢认真记录，辛苦了。`,
    status: { text: '已提交', tone: 'ok' },
    info: [
      { label: '周报标题', value: reportTitle },
      { label: '周报周期', value: weekNumber ? `第 ${weekNumber} 周` : '' },
      { label: '字数', value: chars ? `${chars} 字` : '' }
    ],
    button: { text: '查看周报', url: reportUrl },
    signature: '每周留下一点痕迹，回头看会很有力量。'
  });
}

/** 审核通过 */
function reviewApproved({ ownerName, reportTitle, reportUrl, weekNumber, reviewer }) {
  return render({
    docTitle: 'HJSEC · 本周周报审核通过',
    badge: weekNumber ? `第 ${weekNumber} 周` : '',
    heading: '本周周报审核通过',
    intro: `你好，${ownerName}。本周周报审核通过，感谢你的认真付出。`,
    status: { text: '审核通过', tone: 'ok' },
    info: [
      { label: '周报标题', value: reportTitle },
      { label: '周报周期', value: weekNumber ? `第 ${weekNumber} 周` : '' },
      { label: '审核人', value: reviewer || '' }
    ],
    button: { text: '查看详情', url: reportUrl },
    signature: '认真对待每一次复盘，成长会自己说话。'
  });
}

/** 审核退回 */
function reviewRejected({ ownerName, reportTitle, reportUrl, weekNumber, comment, reviewer }) {
  return render({
    docTitle: 'HJSEC · 你的周报还有一些内容需要完善',
    badge: weekNumber ? `第 ${weekNumber} 周` : '',
    heading: '你的周报还有一些内容需要完善',
    intro: `你好，${ownerName}。还有一点内容需要完善，不着急，修改后重新提交即可。`,
    status: { text: '待完善', tone: 'pending' },
    info: [
      { label: '周报标题', value: reportTitle },
      { label: '周报周期', value: weekNumber ? `第 ${weekNumber} 周` : '' },
      { label: '审核人', value: reviewer || '' }
    ],
    quote: comment || '',
    button: { text: '修改周报', url: reportUrl },
    signature: '改一改往往就清楚了，这也是复盘的一部分。'
  });
}

/** 管理员统计 */
function adminStats({ ownerName, weekNumber, total, submitted, pending, reportUrl }) {
  return render({
    docTitle: 'HJSEC · 本周周报统计已生成',
    badge: weekNumber ? `第 ${weekNumber} 周` : '',
    heading: '本周周报统计已生成',
    intro: `你好，${ownerName}。第 ${weekNumber} 周的提交情况已经整理好了。`,
    status: { text: '统计完成', tone: 'info' },
    info: [
      { label: '应有提交', value: total ? `${total} 人` : '' },
      { label: '已提交', value: submitted !== undefined ? `${submitted} 人` : '' },
      { label: '未提交', value: pending !== undefined ? `${pending} 人` : '' },
      { label: '周次', value: weekNumber ? `第 ${weekNumber} 周` : '' }
    ],
    button: { text: '查看统计', url: reportUrl },
    signature: '数据只是参考，重要的是每个人都在往前走。'
  });
}

/** 账号安全通知（密码重置等） */
function securityNotice({ ownerName, time, reportUrl, actionText }) {
  const when = time || new Date().toLocaleString('zh-CN');
  return render({
    docTitle: 'HJSEC · 账号安全提醒',
    heading: '账号安全提醒',
    intro: `你好，${ownerName}。你的账号有一项安全相关的变更。`,
    status: { text: '安全提醒', tone: 'pending' },
    info: [
      { label: '变更内容', value: actionText || '密码已重置' },
      { label: '操作时间', value: when }
    ],
    body: '如果不是你本人的操作，请尽快联系管理员处理。',
    button: reportUrl ? { text: '查看详情', url: reportUrl } : null,
    signature: '账号安全无小事，看到异常记得及时说一声。'
  });
}

/** 密码重置通知（兼容旧签名） */
function resetNotice({ ownerName, time, reportUrl }) {
  return securityNotice({ ownerName, time, reportUrl, actionText: '密码已重置' });
}

/** 注册验证码 */
function registerCode({ code, ttlMinutes = 10 }) {
  return render({
    docTitle: 'HJSEC · 邮箱验证码',
    heading: '验证一下你的邮箱',
    intro: '你好，感谢加入 HJSEC 安全学习周报。请使用下面的验证码完成注册。',
    status: { text: '验证码', tone: 'info' },
    code,
    ttlMinutes,
    signature: '欢迎加入，一起把每周的记录坚持下去。'
  });
}

/** 重置密码验证码 */
function resetCode({ code, ttlMinutes = 10 }) {
  return render({
    docTitle: 'HJSEC · 重置密码验证码',
    heading: '重置密码验证码',
    intro: '你正在重置 HJSEC 账号的密码，请使用下面的验证码。',
    status: { text: '验证码', tone: 'info' },
    code,
    ttlMinutes,
    signature: '如果不是你发起的，记得告诉管理员一声。'
  });
}

/** 管理员群发 */
function broadcast({ subject, html, text, heading, intro, button }) {
  return render({
    docTitle: subject,
    heading: heading || subject,
    intro: intro || '',
    rawHtml: html || '',
    rawText: html ? '' : text || '',
    button: button || null
  });
}

/** 低层容器：保留旧签名，把 inner（HTML 片段）塞进正文区 */
function shell(title, inner, weekLabel, opts = {}) {
  return render({
    theme: opts.theme,
    docTitle: title,
    badge: weekLabel || '',
    heading: opts.heading || title,
    intro: opts.intro || '',
    rawInner: inner || '',
    signature: opts.signature || ''
  });
}

/* ------------------------------------------------------------------ *
 * 通知类型注册（预览、测试发送、群发共用）
 * ------------------------------------------------------------------ */
const NOTIFICATION_KINDS = [
  { key: 'reminderSat', label: '周报未提交（周六）', fn: reminderSat },
  { key: 'reminderSun', label: '周报未提交（周日补交）', fn: reminderSun },
  { key: 'deadlineReminder', label: '周报即将截止', fn: deadlineReminder },
  { key: 'submitSuccess', label: '提交成功', fn: submitSuccess },
  { key: 'reviewApproved', label: '审核通过', fn: reviewApproved },
  { key: 'reviewRejected', label: '审核退回', fn: reviewRejected },
  { key: 'adminStats', label: '管理员统计', fn: adminStats },
  { key: 'securityNotice', label: '账号安全通知', fn: securityNotice },
  { key: 'comment', label: '评论通知', fn: commentMail },
  { key: 'registerCode', label: '注册验证码', fn: registerCode },
  { key: 'resetCode', label: '重置密码验证码', fn: resetCode },
  { key: 'broadcast', label: '管理员群发', fn: broadcast }
];

const KIND_MAP = NOTIFICATION_KINDS.reduce((m, k) => {
  m[k.key] = k;
  return m;
}, {});

function kindList() {
  return NOTIFICATION_KINDS.map((k) => ({ key: k.key, label: k.label }));
}

/** 用模拟业务数据渲染任意通知类型（预览 / 测试发送共用同一条路径） */
function renderKind(kind, data = {}) {
  const item = KIND_MAP[kind] || KIND_MAP.reminderSat;
  return item.fn(data);
}

/**
 * 发送链路专用：先选一次主题，再用同一主题渲染。
 * 返回的 theme 需要原样传给 sendMail（写日志 / 重试保持同一主题）。
 * @returns {{html:string, theme:string, themeName:string}}
 */
function renderMail(kind, data = {}) {
  const sel = selector.select();
  const html = renderAs(sel.key, () => renderKind(kind, data));
  const meta = themes.get(sel.key);
  return { html, theme: sel.key, themeName: meta ? meta.name : sel.key };
}

/* ------------------------------------------------------------------ *
 * 纯文本备用内容
 * ------------------------------------------------------------------ */
function plain(kind, data = {}) {
  const site = (() => {
    try {
      return require('./helpers').siteUrl();
    } catch (e) {
      return 'https://study.hjsec.top';
    }
  })();
  const wk = data.weekNumber ? `第 ${data.weekNumber} 周` : '';
  const lines = {
    reminderSat: [
      `你好，${data.ownerName || ''}。`,
      '',
      `新的一周已经开始啦，记得抽一点时间，整理本周（${wk}）的工作与收获。`,
      '每一份认真记录，都是成长的印记。',
      '',
      data.reportUrl ? `去提交周报：${data.reportUrl}` : ''
    ],
    reminderSun: [
      `你好，${data.ownerName || ''}。`,
      '',
      `${wk}的周报这次没有收到，如果只是忘了，现在补交也来得及。`,
      '',
      data.reportUrl ? `去补交周报：${data.reportUrl}` : ''
    ],
    deadlineReminder: [
      `你好，${data.ownerName || ''}。`,
      '',
      `${wk}的周报即将截止，还有一点时间，整理好就能提交了。`,
      '',
      data.reportUrl ? `立即提交：${data.reportUrl}` : ''
    ],
    submitSuccess: [
      `你好，${data.ownerName || ''}。`,
      '',
      '已经收到你的周报啦，感谢认真记录，辛苦了。',
      '',
      data.reportUrl ? `查看周报：${data.reportUrl}` : ''
    ],
    comment: [
      `你好，${data.ownerName || ''}。`,
      '',
      `${data.actorName || '有人'}评论了你的周报《${data.reportTitle || ''}》：`,
      '',
      data.content || '',
      '',
      data.reportUrl ? `查看并回复：${data.reportUrl}` : ''
    ],
    default: [`你好，${data.ownerName || 'HJSEC 成员'}。`, '', data.summary || '这是一封来自 HJSEC 周报系统的通知。', '', site]
  };
  const body = lines[kind] || lines.default;
  return body.concat(['', '———', '此邮件由 HJSEC 周报系统自动发送，请勿直接回复。', `${ORG} (HJSEC)`]).join('\n');
}

module.exports = {
  // 基础设施
  escapeHtml,
  FONT,
  MONO,
  SITE_NAME,
  ORG,
  STATUS,
  shell,
  render,
  renderAs,
  renderKind,
  renderMail,
  plain,
  themeList,
  getTheme,
  getThemeKey,

  // 主题系统
  themes,
  selector,
  renderer,
  NOTIFICATION_KINDS,
  kindList,

  // 业务模板
  commentMail,
  reminderSat,
  reminderSun,
  deadlineReminder,
  submitSuccess,
  reviewApproved,
  reviewRejected,
  adminStats,
  securityNotice,
  resetNotice,
  registerCode,
  resetCode,
  broadcast
};
