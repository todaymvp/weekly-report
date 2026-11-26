/* 学习周报系统 — 前端主逻辑 */
(function () {
  'use strict';

  const api = window.api;
  const esc = window.escapeHtml;
  const md = window.mdToHtml;

  const state = {
    user: null,
    unread: 0,
    pendingReply: null,
    editorFiles: [],
    weekBase: { start: '2026-09-14', num: 1 },
    version: '',
    site: { siteName: 'HJSEC 安全学习周报', siteNotice: '', allowRegister: true, reportGroups: [] }
  };

  // 方向分组：以 /api/site 下发的为准，加载完成前用默认值兜底
  const FALLBACK_GROUPS = ['基础知识', '逆向工程', 'Web 安全', 'Pwn', '密码学', '杂项'];
  const reportGroups = () => (state.site.reportGroups && state.site.reportGroups.length ? state.site.reportGroups : FALLBACK_GROUPS);

  const CATS = {
    ask: { label: '提问求助', color: '#b45309', bg: '#fef4e6' },
    share: { label: '经验分享', color: '#047857', bg: '#e7f7f0' },
    checkin: { label: '学习打卡', color: '#0369a1', bg: '#e6f4fb' },
    chat: { label: '闲聊灌水', color: '#6d28d9', bg: '#f3edff' }
  };

  const ICONS = {
    dashboard:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    file:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    users:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    chat:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>',
    bell:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    settings:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    shield:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    search:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    sun:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>',
    moon:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    folder:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    mail:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    send:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>',
    star:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z"/></svg>',
    plus:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  };

  /* ---------------- 主题 / 配色 ---------------- */
  // Nature Glass 色板：低饱和、自然色系
  const ACCENTS = [
    { id: 'blue', name: '雾霾蓝', primary: '#568DBB', dark: '#437BA9', soft: '#DCEAF5', softDark: 'rgba(124,173,211,.16)' },
    { id: 'teal', name: '冰川青', primary: '#5A9A9B', dark: '#48807F', soft: '#DDF0F0', softDark: 'rgba(122,178,178,.16)' },
    { id: 'purple', name: '远山紫', primary: '#7E7FB8', dark: '#66679B', soft: '#E7E8F5', softDark: 'rgba(150,151,201,.16)' },
    { id: 'green', name: '森林绿', primary: '#659B83', dark: '#517E69', soft: '#DFF0E7', softDark: 'rgba(127,183,159,.16)' },
    { id: 'orange', name: '暖砂岩', primary: '#C69A62', dark: '#A87D4A', soft: '#F5EBDD', softDark: 'rgba(216,180,131,.16)' },
    { id: 'rose', name: '雾玫瑰', primary: '#C77D7D', dark: '#A96464', soft: '#F5E3E3', softDark: 'rgba(217,154,154,.16)' }
  ];

  const ls = {
    get(k, d) {
      try {
        return localStorage.getItem(k) || d;
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch (e) {
        /* 隐私模式下忽略 */
      }
    }
  };

  const themeNow = () => (ls.get('wrs-theme', 'light') === 'dark' ? 'dark' : 'light');

  /** 把版本号写进所有 [data-ver] 占位（侧栏 / 下拉 / 设置页） */
  function fillVersion() {
    const v = state.version ? 'v' + String(state.version).replace(/^v/i, '') : 'v—';
    document.querySelectorAll('[data-ver]').forEach((el) => {
      el.textContent = v;
    });
  }

  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;
    ls.set('wrs-theme', t);
    applyAccent(ls.get('wrs-accent', 'blue'));
    const btn = $('#theme-btn');
    if (btn) {
      btn.innerHTML = t === 'dark' ? ICONS.sun : ICONS.moon;
      btn.title = t === 'dark' ? '切换到浅色模式' : '切换到深色模式';
    }
  }

  function applyAccent(id) {
    const a = ACCENTS.find((x) => x.id === id) || ACCENTS[0];
    const dark = themeNow() === 'dark';
    const r = document.documentElement.style;
    r.setProperty('--primary', a.primary);
    r.setProperty('--primary-dark', a.dark);
    r.setProperty('--primary-soft', dark ? a.softDark : a.soft);
    ls.set('wrs-accent', a.id);
  }

  /** 周报 Markdown 阅读主题（default 跟随界面；其余按 data-md-theme 覆盖配色） */
  function applyMdTheme(key) {
    const k = ['default', 'nature', 'hacker', 'cyberpunk', 'developer', 'minimal'].includes(key) ? key : 'default';
    if (k === 'default') document.documentElement.removeAttribute('data-md-theme');
    else document.documentElement.dataset.mdTheme = k;
    ls.set('wrs-md-theme', k);
  }

  // 首屏先定主题，避免闪白
  document.documentElement.dataset.theme = themeNow();
  document.documentElement.style.colorScheme = themeNow();
  if (ls.get('wrs-md-theme', 'default') !== 'default') {
    document.documentElement.dataset.mdTheme = ls.get('wrs-md-theme');
  }

  /* ================= 工具 ================= */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  /** 复制文本兜底（非安全上下文 / 老浏览器没有 clipboard API 时用） */
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (done) done();
    } catch (e) {
      toast('复制失败，请手动选择代码', 'error');
    }
    ta.remove();
  }

  function toast(msg, type) {
    const wrap = $('#toast-wrap');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .3s';
      setTimeout(() => el.remove(), 320);
    }, 2600);
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 86400000 * 7) return Math.floor(diff / 86400000) + ' 天前';
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function dateTime(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function dateTimeShort(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function initials(name) {
    const s = String(name || '?').trim();
    if (!s) return '?';
    if (/[\u4e00-\u9fa5]/.test(s)) return s.slice(-1);
    return s.slice(0, 1).toUpperCase();
  }

  /** 品牌标识：管理员上传过 Logo 就用它，否则用内置 SVG */
  function brandMark(cls, size) {
    const url = state.site && state.site.logoUrl;
    const px = size || 30;
    if (url) {
      return `<img src="${esc(url)}" alt="HJSEC" class="${cls || ''}" style="width:${px}px;height:${px}px;border-radius:8px;object-fit:cover;display:block" />`;
    }
    return `<span class="brand-logo ${cls || ''}" role="img" aria-label="HJSEC" style="width:${px}px;height:${px}"></span>`;
  }

  function avatar(user, cls) {
    const u = user || {};
    const color = /^#[0-9a-f]{6}$/i.test(u.avatarColor || '') ? u.avatarColor : '#6366f1';
    const url = typeof u.avatarUrl === 'string' && /^\/api\/users\/\d+\/avatar/.test(u.avatarUrl) ? u.avatarUrl : '';
    const uid = Number(u.id) || 0;
    // 点了头像能进个人主页：带上 data-uid，交给全局点击代理处理
    const attrs = uid ? ` data-uid="${uid}" title="查看 ${esc(u.displayName || u.username || '')} 的主页"` : '';
    const clickable = uid ? ' clickable' : '';
    if (url) {
      return `<div class="avatar has-img${clickable} ${cls || ''}"${attrs} style="background:${color}"><img src="${esc(url)}" alt="" loading="lazy" decoding="async" /></div>`;
    }
    return `<div class="avatar${clickable} ${cls || ''}"${attrs} style="background:${color}">${esc(initials(u.displayName || u.username))}</div>`;
  }

  /* 头像上传：本地居中等比裁成正方形，再压到 size×size 的 JPEG（不依赖服务端图像库） */
  function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('图片读取失败，请换一张试试'));
      };
      img.src = url;
    });
  }

  async function squareAvatarBlob(file, size) {
    const img = await loadImageFile(file);
    const side = Math.min(img.naturalWidth, img.naturalHeight) || 1;
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b || null), 'image/jpeg', 0.9));
  }

  function weekNumber(ws) {
    // 周次 = 基准周次 + 与基准周一相差的周数（基准可由管理员在后台配置）
    const base = state.weekBase || { start: '2026-09-14', num: 1 };
    const diff = (new Date(ws + 'T00:00:00') - new Date(base.start + 'T00:00:00')) / (7 * 86400000);
    return Math.max(1, base.num + Math.round(diff));
  }

  function fmtShort(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
  }

  function weekRange(ws) {
    const d = new Date(ws + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    const p = (n) => String(n).padStart(2, '0');
    return `${fmtShort(ws)} – ${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  }

  function todayStr() {
    return new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
  }

  function dateStr(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** 学期起点（基准周往前推 num-1 周），早于它的周不属于本学期 */
  function termStartDate() {
    const b = state.weekBase || { start: '2026-09-14', num: 1 };
    const d = new Date(b.start + 'T00:00:00');
    d.setDate(d.getDate() - (b.num - 1) * 7);
    return dateStr(d);
  }

  function weekStartOfDate(d) {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day);
    const p = (n) => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  }

  function lastWeeks(n) {
    const out = [];
    const cur = new Date(weekStartOfDate(new Date()) + 'T00:00:00');
    for (let i = 0; i < n; i += 1) {
      const d = new Date(cur);
      d.setDate(d.getDate() - i * 7);
      const p = (x) => String(x).padStart(2, '0');
      out.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    }
    return out;
  }

  function confirmDialog(opts) {
    return new Promise((resolve) => {
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal" role="dialog" aria-modal="true">
            <h3>${esc(opts.title || '确认操作')}</h3>
            <p>${esc(opts.message || '')}</p>
            <div class="acts">
              ${opts.cancelText === '' ? '' : `<button class="btn" data-act="cancel">${esc(opts.cancelText || '取消')}</button>`}
              <button class="btn ${opts.danger ? 'danger' : 'primary'}" data-act="ok">${esc(opts.okText || '确定')}</button>
            </div>
          </div>
        </div>`;
      const close = (v) => {
        root.innerHTML = '';
        resolve(v);
      };
      const cancelBtn = root.querySelector('[data-act="cancel"]');
      if (cancelBtn) cancelBtn.onclick = () => close(false);
      root.querySelector('[data-act="ok"]').onclick = () => close(true);
      root.querySelector('.modal-backdrop').onclick = (e) => {
        if (e.target.classList.contains('modal-backdrop')) close(false);
      };
    });
  }

  function promptDialog(opts) {
    return new Promise((resolve) => {
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal" role="dialog" aria-modal="true" style="max-width:420px">
            <h3>${esc(opts.title || '输入')}</h3>
            <div class="field">
              ${opts.label ? `<label>${esc(opts.label)}</label>` : ''}
              <input class="input" id="prompt-input" maxlength="${opts.maxlength || 40}" placeholder="${esc(opts.placeholder || '')}" value="${esc(opts.value || '')}" />
              ${opts.hint ? `<div style="font-size:11.5px;color:var(--muted);margin-top:6px">${esc(opts.hint)}</div>` : ''}
            </div>
            <div class="acts">
              <button class="btn" data-act="cancel">取消</button>
              <button class="btn primary" data-act="ok">${esc(opts.okText || '确定')}</button>
            </div>
          </div>
        </div>`;
      const input = root.querySelector('#prompt-input');
      const close = (v) => {
        root.innerHTML = '';
        resolve(v);
      };
      root.querySelector('[data-act="cancel"]').onclick = () => close('');
      root.querySelector('[data-act="ok"]').onclick = () => close(input.value.trim());
      input.onkeydown = (e) => {
        if (e.key === 'Enter') close(input.value.trim());
      };
      root.querySelector('.modal-backdrop').onclick = (e) => {
        if (e.target.classList.contains('modal-backdrop')) close('');
      };
      input.focus();
      input.select();
    });
  }

  /* ---------- 标签选择器（可多选已有标签，也能加新标签） ---------- */
  function cssEsc(s) {
    return window.CSS && CSS.escape ? CSS.escape(String(s)) : String(s).replace(/["\\]/g, '\\$&');
  }

  /** 标签选择：compact=true 时默认只显示 3 个选中标签 +N 展开 */
  function tagPickerHtml(allTags, selected, compact) {
    const sel = new Set(selected || []);
    const chips = (allTags || [])
      .map(
        (t) =>
          `<button type="button" class="tag-opt ${sel.has(t) ? 'active' : ''}" data-tag="${esc(t)}" ${sel.has(t) ? '' : 'hidden'}>${esc(t)}<span class="tag-x" data-remove="${esc(t)}" title="移除">×</span></button>`
      )
      .join('');
    const compactAttr = compact ? ' data-compact="1"' : '';
    return `<div class="tag-picker" data-tag-picker${compactAttr}>${chips}<button type="button" class="tag-more" data-tag-more hidden></button></div>
      <input class="input tag-new" data-tag-input maxlength="16" placeholder="输入标签，回车添加" />`;
  }

  function bindTagPicker(root, selected) {
    const picked = new Set(selected || []);
    const picker = root.querySelector('[data-tag-picker]');
    const input = root.querySelector('[data-tag-input]');
    const compact = !!(picker && picker.dataset.compact === '1');
    const moreBtn = picker ? picker.querySelector('[data-tag-more]') : null;
    let expanded = false;
    const LIMIT = 3;

    const sync = () => {
      const all = [...picker.querySelectorAll('[data-tag]')];
      all.forEach((b) => b.classList.toggle('active', picked.has(b.dataset.tag)));
      if (!compact) return;
      const pickedBtns = all.filter((b) => picked.has(b.dataset.tag));
      const otherBtns = all.filter((b) => !picked.has(b.dataset.tag));
      // 默认：选中的只显示前 LIMIT 个；其余选中的与全部已有标签都收起
      pickedBtns.forEach((b, idx) => { b.hidden = !expanded && idx >= LIMIT; });
      otherBtns.forEach((b) => { b.hidden = !expanded; });
      const hiddenPicked = pickedBtns.filter((b) => b.hidden).length;
      // 按钮始终可见：有折叠的已选标签显示 +N，否则显示「选择标签」入口
      if (moreBtn) {
        moreBtn.hidden = false;
        if (expanded) moreBtn.textContent = '收起';
        else if (hiddenPicked > 0) moreBtn.textContent = `+${hiddenPicked}`;
        else if (otherBtns.length > 0) moreBtn.textContent = `选择标签 (${otherBtns.length})`;
        else moreBtn.hidden = true;
      }
    };

    const add = (raw) => {
      const t = String(raw || '').trim().slice(0, 16);
      if (!t) return;
      if (picked.size >= 8) return toast('最多 8 个标签', 'error');
      picked.add(t);
      if (!picker.querySelector('[data-tag="' + cssEsc(t) + '"]')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tag-opt active';
        b.dataset.tag = t;
        b.innerHTML = `${esc(t)}<span class="tag-x" data-remove="${esc(t)}" title="移除">×</span>`;
        picker.insertBefore(b, moreBtn || null);
      }
      sync();
    };

    if (picker) {
      picker.onclick = (e) => {
        const rm = e.target.closest('[data-remove]');
        if (rm) {
          e.stopPropagation();
          picked.delete(rm.dataset.remove);
          sync();
          return;
        }
        if (e.target.closest('[data-tag-more]')) {
          expanded = !expanded;
          sync();
          return;
        }
        const b = e.target.closest('[data-tag]');
        if (!b) return;
        const t = b.dataset.tag;
        if (picked.has(t)) picked.delete(t);
        else {
          if (picked.size >= 8) return toast('最多 8 个标签', 'error');
          picked.add(t);
        }
        sync();
      };
    }
    if (input) {
      input.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        add(input.value);
        input.value = '';
      };
    }
    sync();
    return { get: () => [...picked], add };
  }

  /* ---------- 快速编辑（标题 / 简介 / 分组 / 标签） ---------- */
  async function quickEditReport(r) {
    const [g, t] = await Promise.all([
      api.get('/report-groups').catch(() => ({ items: [] })),
      api.get('/reports/tags').catch(() => ({ items: [] }))
    ]);
    const groups = (g.items || []).map((x) => x.name);
    const tags = (t.items || []).map((x) => x.tag);
    return new Promise((resolve) => {
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal" role="dialog" aria-modal="true" style="max-width:560px">
            <h3>快速编辑</h3>
            <div class="field">
              <label>标题</label>
              <input class="input" id="qe-title" maxlength="80" value="${esc(r.title)}" />
            </div>
            <div class="field">
              <label>一句话总结</label>
              <input class="input" id="qe-summary" maxlength="120" value="${esc(r.summary || '')}" />
            </div>
            <div class="field">
              <label>归属周次</label>
              <input class="input" type="date" id="qe-week" value="${esc(r.weekStart || '')}" />
              <div style="font-size:11.5px;color:var(--muted);margin-top:6px">
                周一提交、但内容其实属于上一周时，把日期改到上一周即可（自动对齐到周一）
              </div>
            </div>
            <div class="field">
              <label>方向分组</label>
              <select class="select" id="qe-cat">
                <option value="">不分组</option>
                ${groups
                  .map((x) => `<option value="${esc(x)}" ${r.category === x ? 'selected' : ''}>${esc(x)}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="field">
              <label>标签</label>
              ${tagPickerHtml(tags, r.tags || [])}
            </div>
            <div class="acts">
              <button class="btn" data-act="cancel">取消</button>
              <button class="btn primary" data-act="ok">保存</button>
            </div>
          </div>
        </div>`;
      const tp = bindTagPicker(root.querySelector('.modal'), r.tags || []);
      const close = (v) => {
        root.innerHTML = '';
        resolve(v);
      };
      root.querySelector('[data-act="cancel"]').onclick = () => close(null);
      root.querySelector('.modal-backdrop').onclick = (e) => {
        if (e.target.classList.contains('modal-backdrop')) close(null);
      };
      root.querySelector('[data-act="ok"]').onclick = async () => {
        const title = root.querySelector('#qe-title').value.trim();
        if (title.length < 2) return toast('标题至少 2 个字', 'error');
        try {
          const { report } = await api.put('/reports/' + r.id, {
            title,
            summary: root.querySelector('#qe-summary').value.trim(),
            category: root.querySelector('#qe-cat').value,
            weekStart: root.querySelector('#qe-week') ? root.querySelector('#qe-week').value : undefined,
            tags: tp.get().join(',')
          });
          close(report);
        } catch (e) {
          toast(e.message, 'error');
        }
      };
    });
  }

  function canEditReport(r) {
    if (!state.user || !r || !r.author) return false;
    return r.author.id === state.user.id || state.user.role === 'admin';
  }

  /** 给列表里的卡片按钮绑定快速编辑 */
  function bindQuickEdit(root) {
    (root || document).querySelectorAll('[data-qe]').forEach((btn) => {
      btn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          const { report } = await api.get('/reports/' + btn.dataset.qe);
          const saved = await quickEditReport(report);
          if (saved) {
            toast('已更新', 'success');
            navigate();
          }
        } catch (err) {
          toast(err.message, 'error');
        }
      };
    });
  }

  function fmtSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  function fmtChars(n) {
    const v = Number(n) || 0;
    return v >= 1000 ? (v / 1000).toFixed(1) + 'k 字' : v + ' 字';
  }

  function emptyState(icon, text, extra) {    return `<div class="empty"><span class="icon">${icon}</span>${esc(text)}${
      extra ? `<div style="margin-top:14px">${extra}</div>` : ''
    }</div>`;
  }

  /* ================= Markdown 编辑器增强：图片 / 导入 .md ================= */
  const MD_TEMPLATE =
    '## 本周目标\n- \n\n## 学习内容\n1. \n2. \n\n## 关键收获\n> \n\n## 遇到的问题\n- \n\n## 下周计划\n- ';
  window.__MD_TEMPLATE = MD_TEMPLATE;

  /** 在光标处插入一段 Markdown（块级内容自动补换行） */
  function insertSnippet(ta, snippet) {
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const before = ta.value.slice(0, s);
    const after = ta.value.slice(e);
    const lead = !before || /\n$/.test(before) ? '' : '\n';
    const tail = !after || /^\n/.test(after) ? '' : '\n';
    const block = lead + snippet + tail;
    ta.value = before + block + after;
    const pos = before.length + block.length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function imageAlt(name) {
    return String(name || '图片').replace(/[[\]\n]/g, '').slice(0, 60) || '图片';
  }

  async function uploadImageFile(file) {
    if (!/^image\//.test(file.type || '')) throw new Error('只支持 png / jpg / gif / webp 图片');
    if (file.size > 8 * 1024 * 1024) throw new Error('图片不能超过 8MB');
    const fd = new FormData();
    fd.append('image', file, file.name || 'pasted-image.png');
    const { item } = await api.upload('/uploads/image', fd);
    return item;
  }

  async function uploadInlineImage(file, ed) {
    try {
      const item = await uploadImageFile(file);
      ed.insertImageItem(item);
      toast('图片已插入正文', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function importMarkdownFile(file, ed) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const data = await api.upload('/uploads/markdown', fd);
    ed.setValue(data.content);
    return data;
  }

  async function confirmOverwrite(ed) {
    if (!String(ed.getValue() || '').trim()) return true;
    return confirmDialog({
      title: '导入 Markdown 文件？',
      message: '编辑器里已有内容，导入会整体覆盖（覆盖后仍可继续编辑）。',
      okText: '覆盖导入'
    });
  }

  /* ---------- 本地图片自动嵌入：把 ![](本地文件.png) 换成上传后的站内地址 ---------- */
  const MD_IMG_RE = /!\[([^\]\n]{0,200})\]\(([^)\s]{1,300})\)/g;
  // Obsidian 内嵌图片：![[image.png]]（导入时同样支持自动上传替换）
  const MD_WIKI_IMG_RE = /!\[\[([^\]\n|]{1,200})(?:\|([^\]\n]{0,80}))?\]\]/g;
  const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;

  function fileBase(p) {
    const clean = String(p).split(/[?#]/)[0];
    const name = clean.split(/[\\/]/).pop() || clean;
    try {
      return decodeURIComponent(name);
    } catch (e) {
      return name;
    }
  }

  function isLocalImageRef(url) {
    const u = String(url || '').trim();
    if (!u) return false;
    if (/^data:/i.test(u)) return false;
    if (/^(?:https?:)?\/\//i.test(u)) return false;
    if (/^\/api\/(?:uploads|attachments)\/\d+$/.test(u)) return false;
    return true;
  }

  /** 找出正文里还没上传的本地图片引用 */
  function localImageRefs(text) {
    const refs = [];
    const seen = new Set();
    MD_IMG_RE.lastIndex = 0;
    let m;
    while ((m = MD_IMG_RE.exec(String(text || ''))) !== null) {
      if (!isLocalImageRef(m[2])) continue;
      if (seen.has(m[0])) continue;
      seen.add(m[0]);
      refs.push({ raw: m[0], alt: m[1], url: m[2], base: fileBase(m[2]) });
    }

    // Obsidian 的 ![[file.png]] 一并收进来
    MD_WIKI_IMG_RE.lastIndex = 0;
    while ((m = MD_WIKI_IMG_RE.exec(String(text || ''))) !== null) {
      const target = String(m[1]).trim();
      if (!IMAGE_EXT_RE.test(target)) continue;
      if (seen.has(m[0])) continue;
      seen.add(m[0]);
      refs.push({ raw: m[0], alt: m[2] || '', url: target, base: fileBase(target), wiki: true });
    }
    return refs;
  }

  /** 按文件名把选中的图片上传，并替换正文里对应的 ![](xx) */
  async function embedLocalImages(ed, files) {
    const raw = String(ed.getValue() || '');
    const refs = localImageRefs(raw);
    if (!refs.length) return { replaced: 0, pending: 0, failed: 0 };

    const pool = new Map();
    for (const f of files || []) {
      if (!/^image\//.test(f.type || '')) continue;
      const key = String(f.name).toLowerCase();
      if (!pool.has(key)) pool.set(key, f);
    }

    let text = raw;
    let replaced = 0;
    let failed = 0;
    for (const ref of refs) {
      const hit = pool.get(ref.base.toLowerCase());
      if (!hit) continue;
      try {
        const item = await uploadImageFile(hit);
        const piece = `![${imageAlt(ref.alt || hit.name)}](${item.url})`;
        text = text.split(ref.raw).join(piece);
        replaced += 1;
        pool.delete(ref.base.toLowerCase());
      } catch (e) {
        failed += 1;
      }
    }
    if (replaced) ed.setValue(text);
    return { replaced, pending: localImageRefs(ed.getValue()).length, failed };
  }

  /** 给编辑器挂上「插入图片 / 导入 .md（可连图片一起选）/ 粘贴截图 / 拖拽文件」能力 */
  function markdownComposer(ta, ed) {
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/png,image/jpeg,image/gif,image/webp';
    imageInput.hidden = true;

    // 导入 .md 时可以顺手把同目录的图片一起选上，自动上传并改写引用
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.multiple = true;
    importInput.accept = '.md,.markdown,.mdown,.txt,image/png,image/jpeg,image/gif,image/webp';
    importInput.hidden = true;

    // 补传未匹配的本地图片
    const embedInput = document.createElement('input');
    embedInput.type = 'file';
    embedInput.multiple = true;
    embedInput.accept = 'image/png,image/jpeg,image/gif,image/webp';
    embedInput.hidden = true;

    document.body.append(imageInput, importInput, embedInput);

    // 正文里有未上传的本地图片时，在编辑框【上方】和【下方】都提示，避免漏看
    const mkHint = (where) => {
      const el = document.createElement('div');
      el.className = 'md-img-hint md-image-hint';
      el.dataset.where = where;
      el.hidden = true;
      if (where === 'top') ta.insertAdjacentElement('beforebegin', el);
      else ta.insertAdjacentElement('afterend', el);
      return el;
    };
    const hints = [mkHint('top'), mkHint('bottom')];

    const refreshHint = () => {
      const refs = localImageRefs(ed.getValue());
      if (!refs.length) {
        hints.forEach((h) => { h.hidden = true; h.innerHTML = ''; });
        return;
      }
      const names = refs.slice(0, 4).map((r) => `<code>${esc(r.base)}</code>`).join('、');
      hints.forEach((h, i) => {
        h.hidden = false;
        h.innerHTML =
          `<span class="md-img-hint-mark">⚠ ${i === 0 ? '上方提醒' : '提醒'}</span>` +
          `<span>还有 ${refs.length} 张本地图片未上传：${names}${refs.length > 4 ? '…' : ''}</span>` +
          `<button type="button" class="btn sm" data-img-pick>选择图片自动嵌入</button>`;
        const btn = h.querySelector('[data-img-pick]');
        if (btn) btn.onclick = () => embedInput.click();
      });
    };

    imageInput.onchange = () => {
      const f = imageInput.files && imageInput.files[0];
      imageInput.value = '';
      if (f) uploadInlineImage(f, ed);
    };

    importInput.onchange = async () => {
      const files = [...(importInput.files || [])];
      importInput.value = '';
      if (!files.length) return;
      const mdFile = files.find((f) => /\.(md|markdown|mdown|txt)$/i.test(f.name));
      const images = files.filter((f) => /^image\//.test(f.type || ''));
      try {
        if (mdFile) {
          if (!(await confirmOverwrite(ed))) return;
          const data = await importMarkdownFile(mdFile, ed);
          toast(
            `已导入 ${data.filename}${data.encoding && data.encoding !== 'utf-8' ? `（${data.encoding} 已转 UTF-8）` : ''}`,
            'success'
          );
        }
        if (images.length) {
          const r = await embedLocalImages(ed, images);
          if (r.replaced) {
            toast(`已嵌入 ${r.replaced} 张图片${r.pending ? `，还有 ${r.pending} 张没匹配上` : ''}`, r.pending ? 'error' : 'success');
          } else if (!mdFile) {
            toast('选中图片与正文里的本地图片文件名对不上', 'error');
          }
        }
      } catch (e) {
        toast(e.message, 'error');
      }
      refreshHint();
    };

    embedInput.onchange = async () => {
      const files = [...(embedInput.files || [])];
      embedInput.value = '';
      if (!files.length) return;
      try {
        const r = await embedLocalImages(ed, files);
        if (r.replaced) toast(`已嵌入 ${r.replaced} 张图片`, r.pending ? 'error' : 'success');
        else toast('选中图片与正文里的文件名对不上', 'error');
      } catch (e) {
        toast(e.message, 'error');
      }
      refreshHint();
    };

    // 直接粘贴截图（源码模式；富文本模式的粘贴在 editor.js 里处理）
    ta.addEventListener('paste', (e) => {
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (const it of items) {
        if (it.kind === 'file' && /^image\//.test(it.type)) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            uploadInlineImage(f, ed);
          }
          break;
        }
      }
    });

    // 拖拽：.md + 图片一起拖进来也行（源码区和富文本区都接收）
    const onDrop = async (e) => {
      const files = [...((e.dataTransfer && e.dataTransfer.files) || [])];
      if (!files.length) return;
      const mdFile = files.find((f) => /\.(md|markdown|mdown|txt)$/i.test(f.name));
      const images = files.filter((f) => /^image\//.test(f.type || ''));
      if (!mdFile && !images.length) return;
      e.preventDefault();
      try {
        if (mdFile) {
          if (!(await confirmOverwrite(ed))) return;
          const data = await importMarkdownFile(mdFile, ed);
          toast(
            `已导入 ${data.filename}${data.encoding && data.encoding !== 'utf-8' ? `（${data.encoding} 已转 UTF-8）` : ''}`,
            'success'
          );
        }
        if (images.length) {
          const r = await embedLocalImages(ed, images);
          if (r.replaced) toast(`已嵌入 ${r.replaced} 张图片`, r.pending ? 'error' : 'success');
          else if (!mdFile) await uploadInlineImage(images[0], ed);
        }
      } catch (err) {
        toast(err.message, 'error');
      }
      refreshHint();
    };
    const onDragOver = (e) => {
      if (e.dataTransfer && e.dataTransfer.types && [...e.dataTransfer.types].includes('Files')) e.preventDefault();
    };
    [ta, ed.el].forEach((node) => {
      if (!node) return;
      node.addEventListener('dragover', onDragOver);
      node.addEventListener('drop', onDrop);
    });

    ta.addEventListener('input', refreshHint);
    ta.addEventListener('input', () => autoGrow(ta));
    refreshHint();
    autoGrow(ta);

    return {
      pickImage: () => imageInput.click(),
      pickMarkdown: () => importInput.click(),
      refreshHint
    };
  }

  /* ================= 周报编辑工作区：三模式 / Ctrl+E / 全屏 / 分屏拖动 ================= */
  /* ================= Obsidian 风格编辑器头部交互 ================= */
  const MD_CHEATSHEET = [
    { title: '标题', items: [['# 一级标题', '# 一级标题'], ['## 二级标题', '## 二级标题'], ['### 三级标题', '### 三级标题']] },
    { title: '文字格式', items: [['**粗体文字**', '**粗体文字**'], ['*斜体文字*', '*斜体文字*'], ['~~删除线~~', '~~删除线~~'], ['==高亮文字==', '==高亮文字==']] },
    { title: '列表', items: [['- 无序列表', '- 无序列表\n- 第二项'], ['1. 有序列表', '1. 有序列表\n2. 第二项'], ['- [ ] 待完成', '- [ ] 待完成\n- [x] 已完成']] },
    { title: '引用', items: [['> 这是一段引用内容。', '> 这是一段引用内容。']] },
    { title: '行内代码和代码块', items: [['`docker ps`', '`docker ps`'], ['```bash 代码块', '```bash\ndocker compose up -d\n```']] },
    { title: '链接和图片', items: [['[HJSEC](https://example.com)', '[HJSEC](https://example.com)'], ['![图片描述](图片地址)', '![图片描述](/api/uploads/1)']] },
    { title: '表格', items: [['| 项目 | 状态 |', '| 项目 | 状态 |\n| --- | --- |\n| Linux | 已完成 |\n| Docker | 进行中 |']] },
    { title: 'Callout 提示块', items: [['> [!NOTE] 普通说明', '> [!NOTE]\n> 普通说明。'], ['> [!TIP] 技术建议', '> [!TIP]\n> 技术建议。'], ['> [!WARNING] 风险提示', '> [!WARNING]\n> 风险提示。']] },
    { title: 'Mermaid 流程图', items: [['flowchart TD 流程图', '```mermaid\nflowchart TD\n    A[开始] --> B[开发]\n    B --> C[测试]\n    C --> D[完成]\n```']] },
    { title: '数学公式', items: [['$E=mc^2$ 行内公式', '$E=mc^2$'], ['$$ 独立公式', '$$\nE=mc^2\n$$']] }
  ];

  /** 打开 Markdown 使用说明弹窗：示例可点击插入或复制 */
  function openMarkdownHelp(ta, ed) {
    document.querySelectorAll('.ob-help-modal').forEach((m) => m.remove());
    const box = document.createElement('div');
    box.className = 'ob-help-modal';
    box.innerHTML = `
      <div class="ob-help-panel" role="dialog" aria-modal="true" aria-label="Markdown 使用说明">
        <div class="ob-help-head">
          <b>Markdown 使用说明</b>
          <span class="ob-help-sub">点击示例可直接插入正文，或点「复制」复制语法</span>
          <button type="button" class="ob-help-close" id="ob-help-close" title="关闭（Esc）">✕</button>
        </div>
        <div class="ob-help-body">
          ${MD_CHEATSHEET.map(
            (sec, si) => `<section class="ob-help-sec">
              <h4>${si + 1}. ${esc(sec.title)}</h4>
              ${sec.items
                .map(
                  ([label, snippet]) => `<div class="ob-help-item">
                    <code class="ob-help-code">${esc(label)}</code>
                    <span class="ob-help-acts">
                      <button type="button" data-insert="${esc(snippet)}" title="插入到正文">插入</button>
                      <button type="button" data-copy="${esc(snippet)}" title="复制语法">复制</button>
                    </span>
                  </div>`
                )
                .join('')}
            </section>`
          ).join('')}
        </div>
      </div>`;
    document.body.appendChild(box);

    const close = () => {
      box.remove();
      document.removeEventListener('keydown', onEsc, true);
      if (ta) ta.focus();
    };
    const onEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onEsc, true);
    box.querySelector('#ob-help-close').onclick = close;
    box.onclick = (e) => { if (e.target === box) close(); };

    box.querySelectorAll('[data-copy]').forEach((b) => {
      b.onclick = () => {
        const text = b.dataset.copy;
        const done = () => { b.textContent = '已复制'; setTimeout(() => (b.textContent = '复制'), 1200); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
        } else fallbackCopy(text, done);
      };
    });
    box.querySelectorAll('[data-insert]').forEach((b) => {
      b.onclick = () => {
        const snippet = b.dataset.insert;
        const s = ta.selectionStart;
        const before = ta.value.slice(0, s);
        const pad = before && !/\n$/.test(before) ? '\n' : '';
        ta.value = before + pad + snippet + ta.value.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = s + pad.length + snippet.length;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
        close();
        toast('已插入语法示例', 'success');
      };
    });
  }

  /** 绑定 Obsidian 头部：模式切换 / 导入 / 导出 / 使用说明 */
  function bindObsidianHead(ed, composer, ta, ws) {
    // ---- Markdown / 富文本 模式切换 ----
    const modeBtns = [...document.querySelectorAll('[data-ed-mode]')];
    const modeHint = $('#ob-mode-hint');
    const HINTS = {
      markdown: '强烈推荐使用 Markdown 编写周报：代码块、表格、公式、Mermaid 都能正常渲染，也可以直接导入 .md 文件。按 Ctrl + E 进入预览模式，再按一次 Ctrl + E 即可回到源码编辑。',
      rich: '不熟悉 Markdown 语法、实在不想写标记时再用富文本。建议先看「使用说明」，绝大多数场景用 Markdown 更快、效果更好。'
    };
    const paintMode = (which) => {
      modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.edMode === which));
      if (modeHint) {
        const text = HINTS[which] || HINTS.markdown;
        modeHint.dataset.base = text;
        modeHint.textContent = text;
      }
      // 与编辑器内部模式同步（rich/source）
      if (ed) ed.setMode(which === 'rich' ? 'rich' : 'source');
    };
    modeBtns.forEach((b) => {
      b.onclick = () => paintMode(b.dataset.edMode);
    });

    // ---- 导入 Markdown ----
    const importBtn = $('#ob-import');

    // ---- 导出 Markdown ----
    const exportBtn = $('#ob-export');
    if (exportBtn) {
      exportBtn.onclick = () => {
        const text = ed ? ed.getValue() : ta.value;
        if (!String(text || '').trim()) return toast('正文为空，无法导出', 'error');
        // 文件名取标题（若有），否则 weekly-report
        const titleEl = $('#f-title');
        const base = ((titleEl && titleEl.value) || 'weekly-report').trim().replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40);
        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (base || 'weekly-report') + '.md';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
        toast('已导出 Markdown 文件', 'success');
      };
    }

    // ---- 使用说明 ----
    const helpBtn = $('#ew-help');
    if (helpBtn) helpBtn.onclick = () => openMarkdownHelp(ta, ed);

    // 内容变化（含导入 / 切换模式）后刷新空编辑器提示
    const refreshEmpty = () => { if (ws && ws.refreshEmptyHint) ws.refreshEmptyHint(); };
    ta.addEventListener('input', refreshEmpty);
    if (ed && ed.el) ed.el.addEventListener('input', refreshEmpty);
    // 导入按钮点完后延迟刷新（composer 的导入是异步的）
    if (importBtn) {
      const origPick = composer.pickMarkdown;
      if (origPick) {
        const wrapped = () => {
          origPick();
          setTimeout(refreshEmpty, 600);
          setTimeout(refreshEmpty, 1500);
        };
        composer.pickMarkdown = wrapped;
        importBtn.onclick = wrapped;
      }
    }

    // 初始按当前编辑器模式着色
    paintMode(ed && ed.mode === 'rich' ? 'rich' : 'markdown');
  }

  function setupEditorWorkspace(ta, ed) {
    const root = $('#editor-workspace');
    const bodyEl = $('#ew-body');
    const editorPane = $('#ew-editor-pane');
    const previewPane = $('#ew-preview-pane');
    const previewBody = $('#md-preview-body');
    const modeBtns = [...document.querySelectorAll('[data-ws-mode]')];
    if (!root || !bodyEl || !editorPane || !previewPane || !previewBody) return { render: () => {} };

    // 只有两种视图：edit（单栏源码） / preview（阅读预览）；不再提供分屏
    const state = {
      mode: 'edit',
      prevMode: 'edit',   // Ctrl+E 返回时恢复
      fullscreen: false,
      cleanup: []
    };

    function renderPreview() {
      const src = ed ? ed.getValue() : ta.value;
      previewBody.innerHTML = window.mdToHtml(src) || '<p style="color:var(--text-3)">（还没有内容）</p>';
    }

    function apply() {
      const m = state.mode;
      const isPreview = m === 'preview';

      editorPane.hidden = isPreview;
      // 只有阅读预览才显示渲染区；编辑模式永远单栏
      previewPane.hidden = !isPreview;
      bodyEl.dataset.mode = m;
      root.classList.toggle('ws-fullscreen', state.fullscreen);
      modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.wsMode === m));

      editorPane.style.flex = '';
      previewPane.style.flex = '';
      if (!isPreview) renderPreview();
      const saveState = $('#ew-save-state');
      if (saveState) saveState.textContent = isPreview ? '阅读预览' : '编辑中';
      // 视图提示文案 + 预览提示条
      const viewHint = $('#ob-view-hint');
      if (viewHint) {
        viewHint.textContent = isPreview
          ? '正在显示 Markdown 渲染结果，按 Ctrl + E 返回编辑。'
          : '按 Ctrl + E 进入阅读预览，再按一次 Ctrl + E 回到源码编辑。';
      }
      const modeHint = $('#ob-mode-hint');
      if (modeHint) {
        modeHint.textContent = isPreview
          ? '正在显示 Markdown 渲染结果，按 Ctrl + E 返回源码编辑。'
          : (modeHint.dataset.base || 'Markdown 适合技术周报编写，富文本适合直接排版编辑。');
      }
      const previewHint = $('#ob-preview-hint');
      if (previewHint) previewHint.hidden = !isPreview;
      // 全屏时重绘预览尺寸（防止隐藏再显示后高度错误）
      if (isPreview) requestAnimationFrame(renderPreview);
      updateEmptyHint();
    }

    /** 空编辑器提示：有内容就隐藏 */
    function updateEmptyHint() {
      const hint = $('#ob-empty-hint');
      if (!hint) return;
      const hasText = String((ed ? ed.getValue() : ta.value) || '').trim().length > 0;
      hint.hidden = hasText || state.mode === 'preview';
    }

    // 记录光标与滚动，切换模式后恢复（切到预览只隐藏 DOM，不重建编辑器）
    function captureCaret() {
      if (!ed) return null;
      try {
        const active = document.activeElement;
        const isTa = active === ta;
        const isRich = active === ed.el;
        if (isTa) return { kind: 'ta', start: ta.selectionStart, end: ta.selectionEnd, scroll: ta.scrollTop };
        if (isRich) {
          const sel = window.getSelection();
          let offset = 0;
          if (sel && sel.rangeCount) {
            const r = sel.getRangeAt(0).cloneRange();
            r.selectNodeContents(ed.el);
            r.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
            offset = r.toString().length;
          }
          return { kind: 'rich', offset, scroll: ed.el.scrollTop };
        }
      } catch (e) {}
      return null;
    }
    function restoreCaret(snap) {
      if (!snap || !ed) return;
      try {
        if (snap.kind === 'ta' && !ta.hidden) {
          ta.selectionStart = snap.start;
          ta.selectionEnd = snap.end;
          ta.scrollTop = snap.scroll;
          ta.focus();
        } else if (snap.kind === 'rich' && ed.el && !ed.el.hidden) {
          ed.el.scrollTop = snap.scroll;
          // 富文本光标按字符偏移粗略恢复
          const walker = document.createTreeWalker(ed.el, NodeFilter.SHOW_TEXT);
          let node, left = snap.offset;
          while ((node = walker.nextNode())) {
            const len = node.textContent.length;
            if (left <= len) {
              const r = document.createRange();
              r.setStart(node, Math.max(0, left));
              r.collapse(true);
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(r);
              break;
            }
            left -= len;
          }
          ed.el.focus();
        }
      } catch (e) {}
    }

    function setMode(mode) {
      if (!['edit', 'preview'].includes(mode)) return;
      if (mode === state.mode) return;
      const caret = captureCaret();
      const scrolls = { editor: ta.scrollTop, preview: previewBody.scrollTop };
      if (mode === 'preview') state.prevMode = state.mode;
      state.mode = mode;
      apply();
      restoreCaret(caret);
      previewBody.scrollTop = scrolls.preview;
    }

    function togglePreview() {
      if (state.mode === 'preview') setMode('edit');
      else setMode('preview');
    }

    // 模式按钮
    modeBtns.forEach((b) => {
      b.onclick = () => setMode(b.dataset.wsMode);
    });

    // Ctrl/Cmd + E：仅在编辑页、非输入态打字时切换
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      // Ctrl+E：切换阅读预览
      if (k === 'e') {
        e.preventDefault();
        e.stopPropagation();
        togglePreview();
        return;
      }
      // Ctrl+S：保存草稿
      if (k === 's') {
        e.preventDefault();
        e.stopPropagation();
        const btn = $('#save-draft');
        if (btn) btn.click();
        return;
      }
      // Ctrl+B / Ctrl+I / Ctrl+K：格式快捷键（交给编辑器处理）
      if (['b', 'i', 'k'].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
        const map = { b: 'bold', i: 'italic', k: 'link' };
        const target = document.querySelector(`[data-md="${map[k]}"]`);
        if (target) target.click();
        else if (k === 'k') {
          const s = ta.selectionStart, e2 = ta.selectionEnd;
          const sel = ta.value.slice(s, e2) || '链接文字';
          const insert = `[${sel}](https://example.com)`;
          ta.value = ta.value.slice(0, s) + insert + ta.value.slice(e2);
          ta.selectionStart = ta.selectionEnd = s + insert.length;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    };
    // 绑定在 document 捕获阶段；视图卸载时清理
    document.addEventListener('keydown', onKey, true);
    state.cleanup.push(() => document.removeEventListener('keydown', onKey, true));

    // 全屏：只隐藏应用全局导航与顶栏，保留工作区自带工具栏
    const fsBtn = $('#ew-fullscreen');
    const onFsKey = (e) => {
      if (e.key === 'Escape' && state.fullscreen) {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    function toggleFullscreen() {
      state.fullscreen = !state.fullscreen;
      document.body.classList.toggle('md-workspace-fullscreen', state.fullscreen);
      if (fsBtn) fsBtn.textContent = state.fullscreen ? '⛶ 退出全屏' : '⛶ 全屏';
      apply();
    }
    if (fsBtn) fsBtn.onclick = toggleFullscreen;
    document.addEventListener('keydown', onFsKey);
    state.cleanup.push(() => {
      document.removeEventListener('keydown', onFsKey);
      document.body.classList.remove('md-workspace-fullscreen');
    });

    // 输入实时刷新预览（富文本模式在 editor.js 的 onChange 里已 flush 到 textarea）
    const onInput = () => { if (state.mode !== 'edit') renderPreview(); updateEmptyHint(); };
    ta.addEventListener('input', onInput);
    state.cleanup.push(() => ta.removeEventListener('input', onInput));

    // ---- 编辑/预览区：向下拖动放大（双击复位） ----
    const resizeBar = $('#ew-resize');
    const resizeTip = $('#ew-resize-tip');
    const HEIGHT_KEY = 'wrs-editor-body-height';
    let baseBodyH = 0;

    const applyBodyHeight = (px) => {
      if (!bodyEl) return;
      if (!px || px <= 0) {
        bodyEl.style.height = '';
        bodyEl.style.flex = '';
      } else {
        bodyEl.style.height = px + 'px';
        bodyEl.style.flex = '0 0 ' + px + 'px';
      }
      if (resizeTip) {
        const h = Math.round(bodyEl.getBoundingClientRect().height);
        resizeTip.textContent = px > 0 ? `编辑区 ${h}px · 双击复位` : '拖动放大编辑区';
      }
      if (state.mode === 'preview') requestAnimationFrame(renderPreview);
    };

    if (resizeBar) {
      let dragStartY = 0;
      let dragStartH = 0;
      let dragging = false;

      const onDown = (e) => {
        dragging = true;
        dragStartY = e.clientY;
        dragStartH = bodyEl.getBoundingClientRect().height;
        resizeBar.classList.add('dragging');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
      };
      const onMove = (e) => {
        if (!dragging) return;
        // 向下拖 = 增高；向上最多回到自然高度
        const delta = e.clientY - dragStartY;
        const natural = baseBodyH || dragStartH;
        let next = dragStartH + delta;
        // 允许放大到 4000px，缩小不低于 180px
        next = Math.max(180, Math.min(4000, next));
        // 低于自然高度时不强制（回落到弹性布局）
        applyBodyHeight(next > natural + 4 ? Math.round(next) : 0);
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        resizeBar.classList.remove('dragging');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        const h = bodyEl.style.height;
        try {
          if (h) localStorage.setItem(HEIGHT_KEY, String(parseInt(h, 10) || 0));
          else localStorage.removeItem(HEIGHT_KEY);
        } catch (err) {}
      };

      resizeBar.addEventListener('pointerdown', onDown);
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      // 双击复位
      resizeBar.addEventListener('dblclick', () => {
        applyBodyHeight(0);
        try { localStorage.removeItem(HEIGHT_KEY); } catch (err) {}
        toast('已恢复默认高度', 'success');
      });

      state.cleanup.push(() => {
        resizeBar.removeEventListener('pointerdown', onDown);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      });

      // 记录自然高度（用于判断是否已放大），并恢复上次保存的高度
      requestAnimationFrame(() => {
        baseBodyH = bodyEl.getBoundingClientRect().height;
        applyBodyHeight(0);
        try {
          const saved = parseInt(localStorage.getItem(HEIGHT_KEY) || '0', 10);
          if (saved > 0) applyBodyHeight(saved);
        } catch (err) {}
      });
    }

    // 窗口缩放：空间不足自动退出分屏，否则重算分屏宽度
    const onResize = () => {
      if (state.mode === 'preview') requestAnimationFrame(renderPreview);
    };
    window.addEventListener('resize', onResize);
    state.cleanup.push(() => window.removeEventListener('resize', onResize));

    // 语法帮助：点工具栏 ? 展开/收起（默认收起，不占写作空间）
    const helpBtn = $('#ew-help');
    const helpBox = $('#md-syntax-help');
    if (helpBtn && helpBox) {
      helpBtn.onclick = () => {
        helpBox.hidden = !helpBox.hidden;
        helpBtn.classList.toggle('active', !helpBox.hidden);
      };
      state.cleanup.push(() => { helpBtn.onclick = null; });
    }

    apply();
    return {
      setMode,
      togglePreview,
      render: renderPreview,
      refreshEmptyHint: updateEmptyHint,
      mode: () => state.mode,
      destroy: () => state.cleanup.forEach((fn) => fn())
    };
  }

  /* ---------- 编辑区全屏 + 随内容自动增高 ---------- */
  function autoGrow(ta) {
    if (!ta || ta.hidden) return;
    // 全屏/编辑工作台高度由 CSS flex 管理，交内部滚动，不用内联高度覆盖
    if (document.body.classList.contains('md-focus') || ta.closest('#editor-workspace')) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 2 + 'px';
  }

  function setFocusMode(on, btn) {
    document.body.classList.toggle('md-focus', on);
    if (btn) btn.textContent = on ? '✕ 退出全屏' : '⛶ 全屏';
    let tip = document.querySelector('.md-focus-tip');
    if (on) {
      if (!tip) {
        tip = document.createElement('div');
        tip.className = 'md-focus-tip';
        tip.textContent = '全屏编辑中 · 按 Esc 退出';
        document.body.append(tip);
      }
    } else if (tip) {
      tip.remove();
      autoGrow($('#f-content') || $('#p-content'));
    }
  }

  let focusEscBound = false;
  function bindFocusEsc() {
    if (focusEscBound) return;
    focusEscBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('md-focus')) {
        setFocusMode(false, document.querySelector('[data-md="focus"]'));
      }
    });
  }

  /* ---------- 表格：自定义行列 + 表内增删行列 ---------- */
  function tableMarkdown(cols, bodyRows) {
    const c = Math.max(2, Math.min(8, Number(cols) || 3));
    const r = Math.max(1, Math.min(30, Number(bodyRows) || 2));
    const head = Array.from({ length: c }, (_, i) => `列 ${i + 1}`);
    const sep = head.map(() => '---');
    const body = Array.from({ length: r }, () => Array.from({ length: c }, () => '内容'));
    return [head, sep, ...body].map((row) => '| ' + row.join(' | ') + ' |').join('\n');
  }

  function tableDialog(ed, ta) {
    const sel = window.getSelection();
    const anchor = sel && sel.anchorNode;
    const tableEl =
      anchor && anchor.nodeType === 1
        ? anchor.closest('table')
        : anchor && anchor.parentElement
        ? anchor.parentElement.closest('table')
        : null;

    return new Promise((resolve) => {
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal" role="dialog" aria-modal="true" style="max-width:480px">
            <h3>表格</h3>
            <div class="row">
              <div class="field" style="flex:1">
                <label>列数（2-8）</label>
                <input class="input" id="tb-cols" type="number" min="2" max="8" value="3" />
              </div>
              <div class="field" style="flex:1">
                <label>数据行数（不含表头）</label>
                <input class="input" id="tb-rows" type="number" min="1" max="30" value="2" />
              </div>
            </div>
            ${
              tableEl
                ? `<div class="field">
                     <label>当前表格</label>
                     <div style="display:flex;gap:8px;flex-wrap:wrap">
                       <button type="button" class="btn sm" data-tb="add-row">＋ 行</button>
                       <button type="button" class="btn sm" data-tb="add-col">＋ 列</button>
                       <button type="button" class="btn sm" data-tb="del-row">－ 行</button>
                       <button type="button" class="btn sm" data-tb="del-col">－ 列</button>
                     </div>
                   </div>`
                : ''
            }
            <div class="acts">
              <button class="btn" data-act="cancel">取消</button>
              <button class="btn primary" data-act="ok">${tableEl ? '在光标处再插入一个' : '插入表格'}</button>
            </div>
          </div>
        </div>`;

      const close = (v) => {
        root.innerHTML = '';
        resolve(v);
      };
      const sync = () => {
        if (ed && ed.el) ed.el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const cells = (tr) => [...tr.children];

      root.querySelector('[data-act="cancel"]').onclick = () => close(false);
      root.querySelector('.modal-backdrop').onclick = (e) => {
        if (e.target.classList.contains('modal-backdrop')) close(false);
      };
      root.querySelector('[data-act="ok"]').onclick = () => {
        const md = tableMarkdown(
          root.querySelector('#tb-cols').value,
          root.querySelector('#tb-rows').value
        );
        if (ed && ed.mode === 'rich') ed.insertMarkdownText(md);
        else if (ta) insertSnippet(ta, md);
        close(true);
      };

      root.querySelectorAll('[data-tb]').forEach((btn) => {
        btn.onclick = () => {
          if (!tableEl) return;
          const rows = [...tableEl.querySelectorAll('tr')];
          const act = btn.dataset.tb;
          if (act === 'add-row') {
            const last = rows[rows.length - 1];
            const clone = last.cloneNode(true);
            [...clone.children].forEach((c) => {
              c.innerHTML = '内容';
            });
            last.parentElement.appendChild(clone);
          } else if (act === 'add-col') {
            rows.forEach((tr) => {
              const cell = document.createElement(tr.querySelector('th') ? 'th' : 'td');
              cell.textContent = tr.querySelector('th') ? '列 ' + (tr.children.length + 1) : '内容';
              tr.appendChild(cell);
            });
          } else if (act === 'del-row') {
            const bodyRows = rows.filter((tr) => tr.querySelector('td'));
            if (bodyRows.length <= 1) return;
            bodyRows[bodyRows.length - 1].remove();
          } else if (act === 'del-col') {
            const maxCols = Math.max(...rows.map((tr) => tr.children.length));
            if (maxCols <= 2) return;
            rows.forEach((tr) => tr.lastElementChild && tr.lastElementChild.remove());
          }
          sync();
        };
      });
    });
  }

  /** 绑定编辑器的 Markdown 工具条按钮（两个编辑器共用；富文本模式交给 editor.js） */
  /** 周报编辑：切换实时预览面板（右侧分栏，随输入刷新） */
  function toggleMarkdownPreview(ta, ed, btn) {
    const grid = ta.closest('.editor-grid');
    if (!grid) return;
    let pane = grid.querySelector('.md-preview-pane');
    if (pane) {
      pane.remove();
      grid.classList.remove('with-preview');
      btn.classList.remove('active');
      return;
    }
    pane = document.createElement('div');
    pane.className = 'md-preview-pane card pad';
    pane.innerHTML = `<div class="preview-head">
        <span>实时预览</span>
        <button type="button" class="btn sm ghost" id="md-preview-close">关闭</button>
      </div>
      <div class="prose md-preview-body" id="md-preview-body"></div>`;
    grid.appendChild(pane);
    grid.classList.add('with-preview');
    btn.classList.add('active');
    const body = pane.querySelector('#md-preview-body');
    const render = () => {
      const src = ed ? ed.getValue() : ta.value;
      body.innerHTML = window.mdToHtml(src) || '<p style="color:var(--text-3)">（还没有内容）</p>';
    };
    render();
    const onInput = () => render();
    ta.addEventListener('input', onInput);
    if (ed && ed.el) ed.el.addEventListener('input', onInput);
    pane.querySelector('#md-preview-close').onclick = () => btn.click();
    // 记录清理函数，视图切换时解绑
    pane._cleanup = () => {
      ta.removeEventListener('input', onInput);
      if (ed && ed.el) ed.el.removeEventListener('input', onInput);
    };
  }

  /** 工具栏「更多」下拉菜单 */
  function openQuickMenu(anchor, items, onPick) {
    document.querySelectorAll('.ew-quick-menu').forEach((m) => m.remove());
    const menu = document.createElement('div');
    menu.className = 'ew-quick-menu';
    menu.innerHTML = items.map(([k, label]) => `<button type="button" data-k="${k}">${esc(label)}</button>`).join('');
    anchor.parentElement.appendChild(menu);
    menu.querySelectorAll('[data-k]').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); menu.remove(); onPick(b.dataset.k); };
    });
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  function bindMarkdownToolbar(ta, composer, ed) {
    const wrapMap = {
      h1: ['# ', ''],
      h2: ['## ', ''],
      h3: ['### ', ''],
      h4: ['#### ', ''],
      bold: ['**', '**'],
      italic: ['*', '*'],
      list: ['- ', ''],
      quote: ['> ', ''],
      code: ['```\n', '\n```']
    };
    bindFocusEsc();
    document.querySelectorAll('[data-md]').forEach((btn) => {
      btn.onclick = () => {
        const act = btn.dataset.md;
        if (act === 'img') return composer.pickImage();
        if (act === 'import') return composer.pickMarkdown();
        if (act === 'focus') return setFocusMode(!document.body.classList.contains('md-focus'), btn);
        if (act === 'preview') return toggleMarkdownPreview(ta, ed, btn);
        // 富文本模式下的格式操作
        if (act === 'table') return tableDialog(ed, ta);
        if (act === 'more') {
          const items = [
            ['h3', 'H3 标题'], ['h4', 'H4 标题'], ['strike', '删除线'],
            ['quote', '引用'], ['table', '表格'], ['hr', '分割线'],
            ['task', '任务列表'], ['mermaid', 'Mermaid 图表'], ['math', 'KaTeX 公式'],
            ['tpl', '插入周报模板'], ['import', '导入 MD / 图片'],
            ['badge', '徽章'], ['progress', '进度条'], ['fold', '折叠块'], ['timeline', '时间线'],
            ['focus', '专注模式']
          ];
          openQuickMenu(btn, items, (key) => {
            const target = document.querySelector(`[data-md="${key}"]`);
            if (target) { target.click(); return; }
            const inserts = {
              h3: () => '\n### 标题', h4: () => '\n#### 标题',
              strike: () => '\n~~删除线~~', quote: () => '\n> 引用内容',
              hr: () => '\n\n---\n\n', table: () => '\n| 列1 | 列2 |\n|---|---|\n| 内容 | 内容 |',
              import: () => composer.pickMarkdown(),
              task: () => '\n- [ ] 待办事项',
              mermaid: () => '\n```mermaid\ngraph LR\nA --> B\n```',
              math: () => '\n$$E = mc^2$$',
              badge: () => '\n[[badge:标签|blue]]',
              progress: () => '\nprogress:75% 完成度',
              fold: () => '\n::: details 展开查看详情\n\n内容\n:::',
              timeline: () => '\n::: timeline\n2026-01-01: 事件一\n:::'
            };
            if (key === 'focus') { setFocusMode(!document.body.classList.contains('md-focus'), btn); return; }
            if (inserts[key]) {
              const text = inserts[key]();
              if (typeof text === 'string') {
                ta.value += text;
                ta.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
          });
          return;
        }
        if (act === 'tpl') {
          if (ed.mode === 'rich') return ed.exec('tpl');
          ta.value = MD_TEMPLATE;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.focus();
          return;
        }
        // 炫酷元素只在源码模式插入（富文本编辑器无对应命令）
        const extras = {
          strike: ['~~', '~~'],
          hr: '\n\n---\n\n',
          link: '[链接文字](https://example.com)',
          mermaid: '```mermaid\ngraph LR\nA --> B\n```',
          math: '$$E = mc^2$$',
          badge: '[[badge:标签|blue]]',
          progress: 'progress:75% 完成度',
          fold: '::: details 展开查看详情\n\n内容\n:::',
          timeline: '::: timeline\n2026-01-01: 事件一\n2026-02-01: 事件二\n:::'
        };
        if (extras[act]) {
          // 简单包裹型：富文本模式走 exec，源码模式插入
          if (Array.isArray(extras[act])) {
            const pair = extras[act];
            if (ed.mode === 'rich') return ed.exec(act === 'strike' ? 'strikeThrough' : act);
            const s = ta.selectionStart, e2 = ta.selectionEnd;
            const sel = ta.value.slice(s, e2);
            ta.value = ta.value.slice(0, s) + pair[0] + sel + pair[1] + ta.value.slice(e2);
            ta.selectionStart = s + pair[0].length;
            ta.selectionEnd = s + pair[0].length + sel.length;
            ta.focus();
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            return;
          }
          if (ed.mode === 'rich') return toast('该元素请在「源码」模式下插入', 'info');
          const s = ta.selectionStart;
          const insert = extras[act];
          ta.value = ta.value.slice(0, s) + insert + ta.value.slice(ta.selectionEnd);
          ta.selectionStart = ta.selectionEnd = s + insert.length;
          ta.focus();
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
        if (ed.mode === 'rich') return ed.exec(act);
        const wrap = wrapMap[act];
        if (!wrap) return;
        const s = ta.selectionStart;
        const e = ta.selectionEnd;
        const sel = ta.value.slice(s, e);
        ta.value = ta.value.slice(0, s) + wrap[0] + sel + wrap[1] + ta.value.slice(e);
        ta.selectionStart = s + wrap[0].length;
        ta.selectionEnd = s + wrap[0].length + sel.length;
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      };
    });
  }

  /* ================= 登录 / 注册 ================= */
  /* 品牌图标（Lucide 风格线稿） */
  const FI = {
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 9-4 3 4 3M16 9l4 3-4 3M13 5l-2 14"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 11s3.5 7 10 7a9.3 9.3 0 0 0 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/></svg>'
  };

  /** GitHub identicon 像素头像：无自定义头像时按用户名生成，确定性不重复 */
  function identicon(seedStr, sizeClass) {
    // 简单 hash
    let h = 0;
    for (let i = 0; i < seedStr.length; i += 1) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    const bg = `hsl(${hue}, 62%, 52%)`;
    const cells = [];
    // 5x5，左右对称：只算前 3 列
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        h = (h * 1103515245 + 12345) >>> 0;
        const on = (h >>> 16) % 2 === 0;
        if (on) {
          cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
          if (x < 2) cells.push(`<rect x="${4 - x}" y="${y}" width="1" height="1"/>`);
        }
      }
    }
    return `<div class="avatar identicon ${sizeClass || ''}" style="background:${bg}">
      <svg viewBox="0 0 5 5" shape-rendering="crispEdges" style="width:70%;height:70%;fill:rgba(255,255,255,.95)">
        ${cells.join('')}
      </svg>
    </div>`;
  }

  /** 用户头像统一入口：优先上传图，其次按后台设置生成 */
  function userAvatar(u, cls) {
    let html;
    if (u && u.avatarUrl) {
      html = avatar(u, cls);
    } else {
      const provider = (state.site && state.site.defaultAvatarProvider) || 'letter';
      if (provider === 'github' && u && (u.username || u.displayName)) {
        html = identicon(u.username || u.displayName, cls);
      } else {
        html = avatar(u, cls);
      }
    }
    // 统一注入 data-uid + clickable，让全站头像都可点击进个人主页
    const uid = u && u.id;
    if (uid && html.includes('class="avatar')) {
      html = html.replace('class="avatar', `class="avatar clickable" data-uid="${uid}"`);
    }
    return html;
  }

  function brandUrl() {
    return (state.site && state.site.logoUrl) || '/img/logo-mask.png';
  }

  /** 密码明文回显（只改 input.type，不动值，不落日志） */
  function bindPwToggle(btnSel, inputSel) {
    const btn = $(btnSel);
    const inp = $(inputSel);
    if (!btn || !inp) return;
    btn.innerHTML = FI.eye;
    btn.onclick = () => {
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.innerHTML = show ? FI.eyeOff : FI.eye;
      btn.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
      inp.focus();
    };
  }

  function authShell(inner) {
    return `
      <div class="gh-auth">
        <section class="gh-auth-left">
          <div class="gh-auth-brand">
            <img class="gh-auth-logo" src="${esc(brandUrl())}" alt="HJSEC" />
            <div>
              <div class="gh-auth-prod">HJSEC 安全学习周报</div>
              <div class="gh-auth-dept">科协安全部 · HJSEC Security Department</div>
            </div>
          </div>
          <div class="auth-eyebrow"><span class="prompt">$</span> hJsec <span class="arg">--whoami</span><span class="caret"></span></div>
          <h1 class="gh-auth-title">把每一次攻防，<br/>沉淀成可复用的<span class="hl">经验</span>。</h1>
          <p class="gh-auth-desc">
            安全部内部周报平台。记录学习、复盘漏洞、共享工具链 ——
            每周一篇，一年后就是一本属于你自己的攻防手册。
          </p>
          <ul class="gh-auth-feats">
            <li><span class="fi">${FI.file}</span><div><b>每周复盘</b><span>把踩过的坑写成能检索、能复现的笔记</span></div></li>
            <li><span class="fi">${FI.code}</span><div><b>方向同频</b><span>Web · 逆向 · Pwn · 密码学 一起对着打</span></div></li>
            <li><span class="fi">${FI.book}</span><div><b>资产归档</b><span>代码、Payload、附件、命令一处沉淀</span></div></li>
          </ul>
          <div class="auth-sign">HJSEC Security Department · since 2023</div>
        </section>

        <section class="gh-auth-right">
          <button class="gh-auth-theme" id="auth-theme" type="button" aria-label="切换主题"></button>
          <div class="gh-auth-card">${inner}</div>
        </section>
      </div>`;
  }

  function renderAuth(mode) {
    document.body.classList.add('auth-mode');
    if (mode === 'reset') return renderReset();
    const isLogin = mode !== 'register';

    const siteName = (state.site && state.site.siteName) || 'HJSEC';
    const tagline = (state.site && state.site.siteTagline) || '欢迎回来，继续记录你的技术成长。';
    const loginInner = `
      <h2>登录 ${esc(siteName)}</h2>
      <p class="gh-auth-sub">${esc(tagline)}</p>
      <form id="auth-form" novalidate>
        <div class="term-window">
          <div class="term-titlebar">
            <span class="traffic" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="term-title">HJSEC Terminal</span>
          </div>
          <div class="term-body">
            <div class="term-line">$ hjsec auth --login</div>

            <div class="term-prompt-line">username@hjsec:~$</div>
            <input class="term-input term-input-block" id="account" name="username"
                   autocomplete="username" placeholder="用户名或邮箱" required />

            <div class="term-prompt-line">password:</div>
            <div class="term-pass-row">
              <input class="term-input term-input-block" id="password" name="password" type="password"
                     autocomplete="current-password" placeholder="输入密码" required />
              <button class="term-eye" id="pw-toggle" type="button" aria-label="显示密码"></button>
            </div>

            <div class="term-error" id="auth-error" hidden></div>
            <div class="term-hint">&gt; Press <span class="ok">Enter</span> to authenticate · Tab 切换字段</div>
          </div>
        </div>

        <div class="gh-captcha-row">
          <div class="captcha-box" id="captcha-box" title="点击刷新验证码"></div>
          <input class="input" id="captcha" maxlength="4" autocomplete="off" placeholder="输入图中 4 位字符" required />
        </div>
        <div class="gh-captcha-hint" id="captcha-hint"></div>

        <button class="btn primary block" type="submit" id="auth-submit" style="height:40px;margin-top:12px">登录 HJSEC</button>
      </form>
      <div class="gh-auth-links">
        <button type="button" id="auth-forgot">忘记密码？</button>
        <span>·</span>
        ${state.site.allowRegister ? '<button type="button" id="auth-toggle">立即注册</button>' : '<span>账号由管理员开通</span>'}
      </div>
      <div class="gh-auth-foot-version">v${esc(state.version || '—')} · Cupertino Design</div>`;

    const needEmailCode = (state.site && state.site.emailEnabled !== false && state.site.registerAutoActivate === false);
    const emailCodeBlock = needEmailCode ? `
            <div class="term-prompt-line">email code:</div>
            <div class="term-pass-row">
              <input class="term-input-block" id="emailCode" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="6 位数字" required />
              <button class="term-eye" id="send-code" type="button" style="font-size:11px;font-family:var(--mono)">发送</button>
            </div>
            <div class="term-hint" id="code-hint">&gt; 验证码 10 分钟内有效</div>
` : '';

    const registerInner = `
      <h2>注册 ${esc(siteName)}</h2>
      <p class="gh-auth-sub">${esc((state.site && state.site.siteDescription) || '填写信息，加入科协安全部的技术学习。')}</p>
      <form id="auth-form" novalidate>
        <div class="term-window">
          <div class="term-titlebar">
            <span class="traffic" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="term-title">HJSEC Terminal</span>
          </div>
          <div class="term-body">
            <div class="term-line">$ hjsec auth --register</div>

            <div class="term-prompt-line">name:</div>
            <div class="term-pass-row">
              <input class="term-input-block" id="displayName" placeholder="真实姓名" required />
            </div>

            <div class="term-prompt-line">student-id:</div>
            <input class="term-input-block" id="studentId" placeholder="学号" required />

            <div class="term-prompt-line">username:</div>
            <input class="term-input-block" id="username" autocomplete="username" placeholder="3-20 位字母 / 数字 / 下划线" required />

            <div class="term-prompt-line">email:</div>
            <input class="term-input-block" id="email" type="email" autocomplete="email" placeholder="you@example.com" required />
            ${emailCodeBlock}
            <div class="term-prompt-line">password:</div>
            <div class="term-pass-row">
              <input class="term-input-block" id="password" type="password" autocomplete="new-password" placeholder="至少 6 位" required />
              <button class="term-eye" id="pw-toggle" type="button" aria-label="显示密码"></button>
            </div>

            <div class="term-prompt-line">confirm password:</div>
            <div class="term-pass-row">
              <input class="term-input-block" id="password2" type="password" autocomplete="new-password" placeholder="再输入一次" required />
              <button class="term-eye" id="pw-toggle2" type="button" aria-label="显示密码"></button>
            </div>

            <div class="term-error" id="auth-error" hidden></div>
            <div class="term-hint">&gt; Press <span class="ok">Enter</span> to register · Tab 切换字段</div>
          </div>
        </div>

        <button class="btn primary block" type="submit" id="auth-submit" style="height:40px;margin-top:12px">注 册</button>
      </form>
      <div class="gh-auth-links">
        <button type="button" id="auth-toggle">已有账号？去登录</button>
      </div>`;

    $('#root').innerHTML = authShell(isLogin ? loginInner : registerInner);

    // 主题
    const at = $('#auth-theme');
    if (at) {
      const paint = () => {
        at.innerHTML = themeNow() === 'dark' ? ICONS.sun : ICONS.moon;
        at.title = themeNow() === 'dark' ? '切换到浅色' : '切换到深色';
      };
      paint();
      at.onclick = () => {
        applyTheme(themeNow() === 'dark' ? 'light' : 'dark');
        paint();
      };
    }

    const toggleBtn = $('#auth-toggle');
    if (toggleBtn) toggleBtn.onclick = () => renderAuth(isLogin ? 'register' : 'login');

    const forgotBtn = $('#auth-forgot');
    if (forgotBtn) forgotBtn.onclick = () => renderReset();

    bindPwToggle('#pw-toggle', '#password');
    if (!isLogin) bindPwToggle('#pw-toggle2', '#password2');

    // 行内错误提示
    const errBox = $('#auth-error');
    const showErr = (msg) => {
      if (!errBox) return;
      errBox.textContent = msg ? '✗ ' + msg : '';
      errBox.hidden = !msg;
    };

    // 登录：图形验证码
    let captchaId = '';
    const refreshCaptcha = async () => {
      const box = $('#captcha-box');
      if (!box) return;
      try {
        const d = await api.get('/auth/captcha');
        captchaId = d.id;
        box.innerHTML = d.svg;
        const hint = $('#captcha-hint');
        if (hint) {
          hint.textContent = d.devCode
            ? '开发环境验证码：' + d.devCode
            : '看不清？点击图片刷新';
        }
      } catch (e) {
        box.textContent = '加载失败，点击重试';
      }
    };
    if (isLogin) {
      refreshCaptcha();
      $('#captcha-box').onclick = refreshCaptcha;
    }

    // 注册：邮箱验证码（自动激活 / 邮箱关闭时不显示该区域）
    if (!isLogin && $('#send-code')) {
      let timer = null;
      $('#send-code').onclick = async () => {
        const email = $('#email').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return showErr('请先填写正确的邮箱');
        const btn = $('#send-code');
        btn.disabled = true;
        btn.textContent = '发送中…';
        try {
          const d = await api.post('/auth/email-code', { email });
          const hint = $('#code-hint');
          if (d.devCode) {
            $('#emailCode').value = d.devCode;
            hint.textContent = '开发环境验证码已回显：' + d.devCode;
          } else {
            hint.textContent = '验证码已发送到 ' + email;
          }
          showErr('');
          let left = d.cooldown || 60;
          btn.textContent = left + 's 后重发';
          clearInterval(timer);
          timer = setInterval(() => {
            left -= 1;
            if (left <= 0) {
              clearInterval(timer);
              btn.disabled = false;
              btn.textContent = '重新获取';
            } else {
              btn.textContent = left + 's 后重发';
            }
          }, 1000);
        } catch (e) {
          showErr(e.message);
          btn.disabled = false;
          btn.textContent = '获取验证码';
        }
      };
    }

    $('#auth-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('#auth-submit');
      if (btn.disabled) return;
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = '请稍候…';
      showErr('');
      try {
        let res;
        if (isLogin) {
          if (!captchaId) {
            await refreshCaptcha();
            throw new Error('验证码已刷新，请重新输入');
          }
          res = await api.post('/auth/login', {
            account: $('#account').value.trim(),
            password: $('#password').value,
            captchaId,
            captchaCode: $('#captcha').value.trim()
          });
        } else {
          const p1 = $('#password').value;
          const p2 = $('#password2').value;
          if (p1 !== p2) throw new Error('两次输入的密码不一致');
          res = await api.post('/auth/register', {
            username: $('#username').value.trim(),
            email: $('#email').value.trim(),
            displayName: $('#displayName').value.trim(),
            studentId: $('#studentId').value.trim(),
            emailCode: $('#emailCode') ? $('#emailCode').value.trim() : '',
            password: p1
          });
        }
        if (res.pending) {
          // 注册后待审核：不给会话，提示等待管理员激活
          document.body.classList.remove('auth-mode');
          await confirmDialog({
            title: '注册成功，等待审核',
            message: '你的账号已创建，但需要管理员激活后才能登录。请联系管理员完成审核。',
            okText: '知道了',
            cancelText: ''
          });
          location.hash = '#/login';
          renderAuth('login');
          return;
        }
        state.user = res.user;
        document.body.classList.remove('auth-mode');
        toast(isLogin ? '登录成功' : '注册成功，欢迎加入', 'success');
        if (!location.hash || location.hash === '#/login') location.hash = '#/dashboard';
        await loadWeekBase();
        renderShell();
        navigate();
        refreshUnread();
        setTimeout(maybeShowNotice, 300);
      } catch (err) {
        showErr(err.message || '操作失败');
        btn.disabled = false;
        btn.textContent = label;
        if (isLogin) {
          refreshCaptcha();
          const ci = $('#captcha');
          if (ci) ci.value = '';
        }
      }
    };

    const first = isLogin ? $('#account') : $('#displayName');
    if (first) first.focus();
  }

  /* ================= 忘记密码 / 邮件重置 ================= */
  function renderReset() {
    document.body.classList.add('auth-mode');
    const inner = `
      <h2>重置密码</h2>
      <p class="gh-auth-sub">通过注册邮箱验证身份，设置新密码。</p>
      <form id="reset-form" novalidate>
        <div class="term-window">
          <div class="term-titlebar">
            <span class="traffic" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="term-title">HJSEC Terminal</span>
          </div>
          <div class="term-body">
            <div class="term-line">$ hjsec auth --reset-password</div>

            <div class="term-prompt-line">email:</div>
            <input class="term-input-block" id="r-email" type="email" autocomplete="email" placeholder="you@example.com" required />

            <div class="term-prompt-line">email code:</div>
            <div class="term-pass-row">
              <input class="term-input-block" id="r-code" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="6 位数字" required />
              <button class="term-eye" id="r-send" type="button" style="font-size:11px;font-family:var(--mono)">发送</button>
            </div>
            <div class="term-hint" id="r-hint">&gt; 验证码 10 分钟内有效</div>

            <div class="term-prompt-line">new password:</div>
            <div class="term-pass-row">
              <input class="term-input-block" id="r-pwd" type="password" autocomplete="new-password" placeholder="至少 6 位" required />
              <button class="term-eye" id="r-pw-toggle" type="button" aria-label="显示密码"></button>
            </div>

            <div class="term-prompt-line">confirm password:</div>
            <div class="term-pass-row">
              <input class="term-input-block" id="r-pwd2" type="password" autocomplete="new-password" placeholder="再输入一次" required />
              <button class="term-eye" id="r-pw-toggle2" type="button" aria-label="显示密码"></button>
            </div>

            <div class="term-error" id="r-error" hidden></div>
            <div class="term-hint">&gt; Press <span class="ok">Enter</span> to reset</div>
          </div>
        </div>

        <button class="btn primary block" type="submit" id="r-submit" style="height:40px;margin-top:12px">重置密码</button>
      </form>
      <div class="gh-auth-links"><button type="button" id="r-back">返回登录</button></div>`;

    $('#root').innerHTML = authShell(inner);

    const at = $('#auth-theme');
    if (at) {
      const paint = () => {
        at.innerHTML = themeNow() === 'dark' ? ICONS.sun : ICONS.moon;
        at.title = themeNow() === 'dark' ? '切换到浅色' : '切换到深色';
      };
      paint();
      at.onclick = () => {
        applyTheme(themeNow() === 'dark' ? 'light' : 'dark');
        paint();
      };
    }

    const errBox = $('#r-error');
    const showErr = (msg) => {
      if (!errBox) return;
      errBox.textContent = msg ? '✗ ' + msg : '';
      errBox.hidden = !msg;
    };

    $('#r-back').onclick = () => {
      document.body.classList.remove('auth-mode');
      renderAuth('login');
    };

    bindPwToggle('#r-pw-toggle', '#r-pwd');
    bindPwToggle('#r-pw-toggle2', '#r-pwd2');

    let timer = null;
    $('#r-send').onclick = async () => {
      const email = $('#r-email').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return showErr('请先填写正确的邮箱');
      const btn = $('#r-send');
      btn.disabled = true;
      btn.textContent = '发送中…';
      try {
        const d = await api.post('/auth/forgot', { email });
        const hint = $('#r-hint');
        if (d.devCode) {
          $('#r-code').value = d.devCode;
          hint.textContent = '开发环境验证码已回显：' + d.devCode;
        } else if (d.mailMode === 'console') {
          hint.textContent = '当前未配置 SMTP，验证码已打印到服务端日志';
        } else {
          hint.textContent = '验证码已发送到 ' + email;
        }
        showErr('');
        let left = d.cooldown || 60;
        btn.textContent = left + 's 后重发';
        clearInterval(timer);
        timer = setInterval(() => {
          left -= 1;
          if (left <= 0) {
            clearInterval(timer);
            btn.disabled = false;
            btn.textContent = '重新发送';
          } else {
            btn.textContent = left + 's 后重发';
          }
        }, 1000);
      } catch (e) {
        showErr(e.message);
        btn.disabled = false;
        btn.textContent = '发送验证码';
      }
    };

    $('#reset-form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('#r-submit');
      if (btn.disabled) return;
      const email = $('#r-email').value.trim();
      const code = $('#r-code').value.trim();
      const p1 = $('#r-pwd').value;
      const p2 = $('#r-pwd2').value;
      if (!/^\d{6}$/.test(code)) return showErr('请填写 6 位邮箱验证码');
      if (p1.length < 6) return showErr('新密码至少 6 位');
      if (p1 !== p2) return showErr('两次输入的密码不一致');

      btn.disabled = true;
      btn.textContent = '提交中…';
      showErr('');
      try {
        await api.post('/auth/reset', { email, code, password: p1 });
        toast('密码已重置，请用新密码登录', 'success');
        document.body.classList.remove('auth-mode');
        renderAuth('login');
        const acc = $('#account');
        if (acc) acc.value = email;
      } catch (err) {
        showErr(err.message || '重置失败');
        btn.disabled = false;
        btn.textContent = '重置密码';
      }
    };

    const first = $('#r-email');
    if (first) first.focus();
  }

  /* ================= 命令面板（⌘K） ================= */
  function openCommandPalette() {
    if (document.querySelector('.cmd-backdrop')) return;
    const items = [
      { label: '首页', hint: 'G D', icon: ICONS.dashboard, go: '#/dashboard' },
      { label: '写周报', hint: 'N', icon: ICONS.plus, go: '#/report/new' },
      { label: '我的周报', icon: ICONS.file, go: '#/mine' },
      { label: '团队周报', icon: ICONS.users, go: '#/reports' },
      { label: '提交情况', icon: ICONS.file, go: '#/status' },
      { label: '个人设置', icon: ICONS.settings, go: '#/settings' }
    ];
    if (state.user && state.user.role === 'admin') {
      items.push({ label: '管理后台', icon: ICONS.shield, go: '#/admin' });
      items.push({ label: '周报提醒', icon: ICONS.mail, go: '#/admin?tab=reminders' });
      items.push({ label: '系统日志', icon: ICONS.file, go: '#/admin?tab=logs' });
    }

    const root = $('#modal-root');
    root.innerHTML = `
      <div class="cmd-backdrop" id="cmd-backdrop">
        <div class="cmd-panel" role="dialog" aria-modal="true" aria-label="命令面板">
          <input class="cmd-input" id="cmd-input" placeholder="输入页面名称跳转…（Esc 关闭）" autofocus />
          <div class="cmd-list" id="cmd-list"></div>
        </div>
      </div>`;
    const input = $('#cmd-input');
    const list = $('#cmd-list');
    let active = 0;
    let shown = items;

    const paint = () => {
      list.innerHTML = shown
        .map(
          (it, i) =>
            `<div class="cmd-item ${i === active ? 'active' : ''}" data-i="${i}">
               ${it.icon}<span>${esc(it.label)}</span>${it.hint ? `<span class="kbd-hint">${it.hint}</span>` : ''}
             </div>`
        )
        .join('') || '<div class="cmd-item">没有匹配项</div>';
      list.querySelectorAll('.cmd-item[data-i]').forEach((el) => {
        el.onclick = () => go(Number(el.dataset.i));
      });
    };
    const go = (i) => {
      const it = shown[i];
      if (!it) return;
      close();
      location.hash = it.go;
    };
    const close = () => {
      root.innerHTML = '';
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') return close();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        active = Math.min(shown.length - 1, active + 1);
        paint();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        active = Math.max(0, active - 1);
        paint();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        go(active);
      }
    };
    document.addEventListener('keydown', onKey, true);
    input.oninput = () => {
      const kw = input.value.trim().toLowerCase();
      shown = items.filter((it) => it.label.toLowerCase().includes(kw));
      active = 0;
      paint();
    };
    $('#cmd-backdrop').onclick = (e) => {
      if (e.target.id === 'cmd-backdrop') close();
    };
    paint();
    input.focus();
  }

  /* ---------------- vim 键位导航 ---------------- */
  const VIM_SELECTORS = [
    '.gh-nav-item', '.Box-row[href]', '.report-item[href]', '.member-card[href]',
    '.feed-card', '.page-tabs .tab', '.quick-item[href]', '.zh-feed-item a'
  ];
  let vimIndex = -1;
  let vimHintEl = null;
  function vimTargets() {
    return [...document.querySelectorAll(VIM_SELECTORS.join(','))].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }
  function vimHighlight() {
    document.querySelectorAll('.vim-focus').forEach((el) => el.classList.remove('vim-focus'));
    const t = vimTargets()[vimIndex];
    if (!t) return;
    t.classList.add('vim-focus');
    t.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
  function vimClear() {
    document.querySelectorAll('.vim-focus').forEach((el) => el.classList.remove('vim-focus'));
    if (vimHintEl) { vimHintEl.remove(); vimHintEl = null; }
    vimIndex = -1;
  }
  function showVimHint() {
    if (vimHintEl) return;
    vimHintEl = document.createElement('div');
    vimHintEl.className = 'vim-hint';
    vimHintEl.innerHTML = '<b>j/k</b> 移动 · <b>Enter</b> 打开 · <b>g/G</b> 首/尾 · <b>Esc</b> 退出';
    document.body.appendChild(vimHintEl);
    setTimeout(() => { if (vimHintEl) vimHintEl.remove(); }, 2500);
  }
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '') || '';
    const typing = tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable);
    if (typing || !state.user || e.metaKey || e.ctrlKey || e.altKey) return;
    const targets = vimTargets();
    if (!targets.length) return;
    if (e.key === 'j' && targets.length) {
      e.preventDefault();
      vimIndex = Math.min(targets.length - 1, vimIndex + 1);
      vimHighlight();
    } else if (e.key === 'k' && targets.length) {
      e.preventDefault();
      vimIndex = Math.max(0, vimIndex - 1);
      vimHighlight();
    } else if (e.key === 'Enter' && vimIndex >= 0) {
      e.preventDefault();
      const t = targets[vimIndex];
      if (t && t.href) location.hash = t.getAttribute('href').startsWith('#') ? t.getAttribute('href') : t.href;
      else if (t) t.click();
    } else if (e.key === 'g') {
      e.preventDefault();
      vimIndex = 0;
      vimHighlight();
    } else if (e.key === 'G') {
      e.preventDefault();
      vimIndex = targets.length - 1;
      vimHighlight();
    } else if (e.key === '?') {
      e.preventDefault();
      showVimHint();
    } else if (e.key === 'Escape' && vimIndex >= 0) {
      vimClear();
    }
  });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '') || '';
    const typing = tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable);
    if (e.key === '/' && !typing && state.user) {
      e.preventDefault();
      openCommandPalette();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
  });

  const uiPref = () => ls.get('wsec-ui', ''); // '' 表示跟随后台默认
  function effectiveUi() {
    const cfg = state.site || {};
    if (cfg.uiLocked) return cfg.uiStyle || 'zhihu'; // 锁定：忽略用户选择
    return uiPref() || cfg.uiStyle || 'zhihu';
  }
  const uiIsZhihu = () => effectiveUi() !== 'github';
  function applyUiStyle() {
    document.documentElement.dataset.ui = uiIsZhihu() ? 'zhihu' : 'github';
  }
  /** 用户手动切换皮肤（记在本地，随时可切回） */
  function setUiStyle(ui) {
    ls.set('wsec-ui', ui === 'github' ? 'github' : 'zhihu');
    applyUiStyle();
    renderShell();
    navigate();
  }
  function uiSwitchHtml() {
    const locked = !!(state.site && state.site.uiLocked);
    // 管理员锁定风格后，隐藏切换按钮，避免误解为还能切换
    if (locked) return '';
    const zhihu = uiIsZhihu();
    return `<div class="ui-switch" role="group" aria-label="界面风格" title="切换界面风格">
      <button type="button" data-ui-set="zhihu" class="${zhihu ? 'active' : ''}">知乎</button>
      <button type="button" data-ui-set="github" class="${zhihu ? '' : 'active'}">GitHub</button>
    </div>`;
  }
  function bindUiSwitch() {
    document.querySelectorAll('[data-ui-set]:not([disabled])').forEach((b) => {
      b.onclick = () => setUiStyle(b.dataset.uiSet);
    });
  }

  function renderShell() {
    applyUiStyle();
    if (uiIsZhihu()) return renderShellZhihu();
    const u = state.user;
    $('#root').innerHTML = `
      <header class="gh-header">
        <button class="gh-burger" id="menu-btn" aria-label="菜单">☰</button>
        <a class="gh-logo" href="#/dashboard">
          ${brandMark('gh-logo-img', 30)}
          <b>HJSEC</b>
        </a>
        ${uiSwitchHtml()}
        <div class="gh-crumb"><span id="crumb-pre">Home</span> <span>/</span> <b id="page-title">Feed</b></div>

        <button class="gh-search" id="cmd-search" type="button" aria-label="搜索或跳转">
          ${ICONS.search}
          <span class="gh-search-text">Search or jump to…</span>
          <span class="kbd">/</span>
        </button>

        <div class="gh-actions">
          <div class="gh-create">
            <button class="gh-icon-btn" id="create-btn" title="新建">${ICONS.plus}</button>
            <div class="gh-create-menu" id="create-menu" hidden>
              <button class="dropdown-item" data-go="#/report/new">${ICONS.file}写周报</button>
              <button class="dropdown-item" data-go="#/reports">${ICONS.users}看团队周报</button>
            </div>
          </div>
          <button class="gh-icon-btn" id="bell-btn" title="通知">
            ${ICONS.bell}<span class="dot-badge" id="nav-badge" hidden></span>
          </button>
          <button class="gh-icon-btn" id="theme-btn" title="切换主题">${ICONS.moon}</button>
          <div class="user-menu">
            <button class="avatar-btn" id="avatar-btn" aria-label="账户菜单">${userAvatar(u)}</button>
            <div class="dropdown" id="user-dropdown" hidden>
              <div class="dropdown-head"><b>${esc(u.displayName)}</b><span>@${esc(u.username)}${u.role === 'admin' ? ' · 管理员' : ''}</span><span class="dd-ver" data-ver>v—</span></div>
              <button class="dropdown-item" data-go="#/settings">${ICONS.settings}个人设置</button>
              <button class="dropdown-item" data-go="#/mine">${ICONS.file}我的周报</button>
              <div class="dropdown-sep"></div>
              <button class="dropdown-item" id="dd-logout">退出登录</button>
            </div>
          </div>
        </div>
      </header>

      <div class="gh-shell">
        <aside class="gh-side" id="sidebar">
          <nav class="gh-nav" id="gh-nav"></nav>
          <div class="gh-side-title">Top projects <button class="gh-icon-btn" id="gh-proj-all" title="看全部周报">${ICONS.search}</button></div>
          <div id="gh-projects"></div>
          <div class="gh-side-foot">
            <div class="gh-user" id="user-card">
              ${userAvatar(u)}
              <div>
                <div class="name">${esc(u.displayName)} <span class="chip soft-primary" id="lvl-chip" style="height:16px;padding:0 6px;font-size:10px">Lv.1</span></div>
                <div class="sub">@${esc(u.username)}</div>
              </div>
              <a class="gh-icon-btn" href="#/settings" title="设置" style="margin-left:auto">${ICONS.settings}</a>
            </div>
            <div class="term-card" style="margin-top:8px">
              <b>$</b> Welcome to HJSEC!<br/>
              <span style="color:var(--text-3)">security is a journey.</span>
            </div>
            <div class="side-ver"><span data-ver>v—</span><i></i><span class="side-ver-name">HJSEC</span></div>
          </div>
        </aside>
        <main class="gh-main" id="view"></main>
      </div>`;

    renderGhNav();
    fillVersion();

    $('#menu-btn').onclick = () => $('#sidebar').classList.toggle('open');
    $('#user-card').onclick = (e) => {
      if (e.target.closest('a')) return;
      location.hash = '#/settings';
    };

    const tb = $('#theme-btn');
    if (tb) tb.onclick = () => applyTheme(themeNow() === 'dark' ? 'light' : 'dark');
    bindUiSwitch();
    applyTheme(themeNow());

    const bell = $('#bell-btn');
    if (bell) bell.onclick = () => (location.hash = '#/notifications');

    fillVersion();

    const cs = $('#cmd-search');
    if (cs) cs.onclick = () => openCommandPalette();

    const dd = $('#user-dropdown');
    const av = $('#avatar-btn');
    if (av && dd) {
      av.onclick = (e) => {
        e.stopPropagation();
        dd.hidden = !dd.hidden;
      };
      document.addEventListener('click', () => (dd.hidden = true));
      dd.querySelectorAll('[data-go]').forEach((b) => {
        b.onclick = () => {
          dd.hidden = true;
          location.hash = b.dataset.go;
        };
      });
      const lg = $('#dd-logout');
      if (lg)
        lg.onclick = async () => {
          await api.post('/auth/logout');
          state.user = null;
          location.hash = '';
          renderAuth('login');
        };
    }

    // 新建菜单
    const cm = $('#create-menu');
    const cb = $('#create-btn');
    if (cm && cb) {
      cb.onclick = (e) => {
        e.stopPropagation();
        cm.hidden = !cm.hidden;
      };
      document.addEventListener('click', () => (cm.hidden = true));
      cm.querySelectorAll('[data-go]').forEach((b) => {
        b.onclick = () => {
          cm.hidden = true;
          location.hash = b.dataset.go;
        };
      });
    }

    // 左栏 Top projects（复用真实的分组数据）
    api
      .get('/report-groups')
      .then((d) => {
        const items = (d.items || []).slice(0, 8);
        const box = $('#gh-projects');
        if (box) {
          box.innerHTML =
            items
              .map(
                (g) =>
                  `<a class="gh-proj" href="#/reports?category=${encodeURIComponent(g.name)}">
                     <span class="p-ic">${esc((g.name || '?').slice(0, 1))}</span>
                     <span>${esc(g.name)}</span>
                   </a>`
              )
              .join('') || '<div class="rail-empty">还没有分组</div>';
        }
      })
      .catch(() => {});

    bindUiSwitch();
    api
      .get('/reports/stats/me')
      .then((me) => {
        const lvl = 1 + Math.floor((me.totalReports || 0) / 5);
        const chipEl = $('#lvl-chip');
        if (chipEl) {
          chipEl.textContent = `Lv.${lvl}`;
          chipEl.title = `累计 ${me.totalReports || 0} 篇 · 连续 ${me.streak || 0} 周`;
        }
      })
      .catch(() => {});
  }

  function renderGhNav() {
    const u = state.user;
    const items = [
      { key: 'dashboard', label: '首页', icon: ICONS.dashboard, href: '#/dashboard' },
      { key: 'reports', label: '周报', icon: ICONS.file, href: '#/reports' },
      { key: 'members', label: '成员', icon: ICONS.users, href: '#/members' },
      { key: 'leaderboard', label: '排行榜', icon: ICONS.star, href: '#/leaderboard' },
      { key: 'settings', label: '设置', icon: ICONS.settings, href: '#/settings' }
    ];
    if (u.role === 'admin') items.push({ key: 'admin', label: '管理后台', icon: ICONS.shield, href: '#/admin' });

    const projAll = $('#gh-proj-all');
    if (projAll) projAll.onclick = () => (location.hash = '#/reports');
    const nav = $('#gh-nav');
    if (!nav) return;
    nav.innerHTML = items
      .map(
        (it) => `<a class="gh-nav-item" data-nav="${it.key}" href="${it.href}">${it.icon}<span>${it.label}</span></a>`
      )
      .join('');
  }

  /* ================= 知乎风格外壳 ================= */
  function renderShellZhihu() {
    const u = state.user;
    $('#root').innerHTML = `
      <header class="zh-header">
        <div class="zh-header-inner">
          <a class="zh-logo" href="#/dashboard">
            <img src="${esc(brandUrl())}" alt="HJSEC" /><b>HJSEC</b>
          </a>
          <nav class="zh-nav" id="zh-nav">
            <a data-nav="dashboard" href="#/dashboard">首页</a>
            <a data-nav="reports" href="#/reports">周报</a>
            <a data-nav="members" href="#/members">成员</a>
            <a data-nav="leaderboard" href="#/leaderboard">排行</a>
            ${u.role === 'admin' ? '<a data-nav="admin" href="#/admin">管理</a>' : ''}
          </nav>
          <span class="hdr-ver" data-ver title="当前版本">v—</span>
          ${uiSwitchHtml()}
          <button class="zh-search" id="cmd-search" type="button" aria-label="搜索">
            ${ICONS.search}<span class="zh-search-text">搜索成员 / 周报 / 文章</span>
          </button>
          <div class="zh-actions">
            <a class="zh-btn" href="#/report/new">写周报</a>
            <button class="zh-icon-btn" id="bell-btn" title="通知">
              ${ICONS.bell}<span class="dot-badge" id="nav-badge" hidden></span>
            </button>
            <button class="zh-icon-btn" id="theme-btn" title="切换主题"></button>
            <div class="user-menu">
              <button class="avatar-btn" id="avatar-btn" aria-label="账户菜单">${userAvatar(u)}</button>
              <div class="dropdown" id="user-dropdown" hidden>
                <div class="dropdown-head"><b>${esc(u.displayName)}</b><span>@${esc(u.username)}${u.role === 'admin' ? ' · 管理员' : ''}</span><span class="dd-ver" data-ver>v—</span></div>
                <button class="dropdown-item" data-go="#/settings">${ICONS.settings}个人设置</button>
                <button class="dropdown-item" data-go="#/mine">${ICONS.file}我的周报</button>
                <div class="dropdown-sep"></div>
                <button class="dropdown-item" id="dd-logout">退出登录</button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div class="zh-container"><h1 id="page-title" hidden></h1><div id="view"></div></div>`;

    const cs = $('#cmd-search');
    if (cs) cs.onclick = () => openCommandPalette();
    const bell = $('#bell-btn');
    if (bell) bell.onclick = () => (location.hash = '#/notifications');
    const tb = $('#theme-btn');
    if (tb) {
      tb.innerHTML = themeNow() === 'dark' ? ICONS.sun : ICONS.moon;
      tb.onclick = () => {
        applyTheme(themeNow() === 'dark' ? 'light' : 'dark');
        tb.innerHTML = themeNow() === 'dark' ? ICONS.sun : ICONS.moon;
      };
    }
    const dd = $('#user-dropdown');
    const av = $('#avatar-btn');
    if (av && dd) {
      av.onclick = (e) => {
        e.stopPropagation();
        dd.hidden = !dd.hidden;
      };
      document.addEventListener('click', () => (dd.hidden = true));
      dd.querySelectorAll('[data-go]').forEach((b) => {
        b.onclick = () => {
          dd.hidden = true;
          location.hash = b.dataset.go;
        };
      });
      const lg = $('#dd-logout');
      if (lg)
        lg.onclick = async () => {
          await api.post('/auth/logout');
          state.user = null;
          location.hash = '';
          renderAuth('login');
        };
    }
    bindUiSwitch();
  }

  /* ================= 知乎风格首页 Feed ================= */
  async function viewFeedZhihu(view, filter = 'all') {
    setTitle('首页');
    const [reports, members, ov, me, comments] = await Promise.all([
      api.get('/reports?scope=all&limit=10'),
      api.get('/members'),
      api.get('/reports/stats/overview'),
      api.get('/reports/stats/me'),
      api.get('/comments/recent?limit=10').catch(() => ({ items: [] }))
    ]);

    const items = [
      ...(reports.items || []).map((r) => ({ type: 'report', at: r.createdAt, r })),
      ...(comments.items || []).map((c) => ({ type: 'comment', at: c.createdAt, c })),
      ...(members.items || [])
        .filter((m) => m.createdAt)
        .slice(-3)
        .map((m) => ({ type: 'member', at: m.createdAt, m }))
    ]
      .filter((it) => filter === 'all' || it.type === filter)
      .sort((a, b) => (a.at < b.at ? 1 : -1));

    const groups = (ov.groupCounts || []).filter((g) => g.count > 0).slice(0, 6);

    view.innerHTML = `
      <div class="zh-layout">
        <main class="zh-main">
          <div class="zh-card">
            <div class="zh-publish">
              ${userAvatar(state.user, 'zh-avatar')}
              <a class="zh-publish-entry" href="#/report/new">写点什么，记录本周的技术收获…</a>
              <a class="zh-btn" href="#/report/new">写周报</a>
            </div>
          </div>

          <div class="zh-card" style="margin-top:12px">
            <div class="zh-card-h">
              最新动态
              <span class="chip" style="margin-left:6px">${items.length} 条</span>
              <span class="more">
                <a href="#/dashboard?f=all">全部</a> ·
                <a href="#/dashboard?f=report">周报</a> ·
                <a href="#/dashboard?f=comment">评论</a> ·
                <a href="#/dashboard?f=member">成员</a>
              </span>
            </div>
            ${items
              .map((it) => {
                if (it.type === 'report') {
                  const r = it.r;
                  const au = r.author || {};
                  return `<article class="zh-feed-item">
                    <div class="zh-feed-head">
                      ${userAvatar(au, 'zh-avatar')}
                      <b>${esc(au.displayName || au.username || '成员')}</b>
                      <span>提交了第 ${weekNumber(r.weekStart)} 周周报</span>
                      <time>${timeAgo(it.at)}</time>
                    </div>
                    <a class="zh-feed-title" href="#/report/${r.id}">${esc(r.title)}</a>
                    ${(() => {
                      const t = (it.summary && it.summary.length >= (it.excerpt || '').length) ? it.summary : (it.excerpt || it.summary || '');
                      return t ? `<div class="zh-feed-text"><span>${esc(t)}</span><span class="read-more">阅读全文 ></span></div>` : '';
                    })()}
                    <div class="zh-feed-meta">
                      <span class="zh-tag">第 ${weekNumber(r.weekStart)} 周</span>
                      ${r.category ? `<span class="zh-tag blue">${esc(r.category)}</span>` : ''}
                      <span class="zh-tag">${fmtChars(r.chars)}</span>
                    </div>
                    <div class="zh-actions-row">
                      <span>▲ 赞同 ${r.likes}</span>
                      <a href="#/report/${r.id}">💬 评论 ${r.comments}</a>
                      <a href="#/report/${r.id}">查看周报 →</a>
                    </div>
                  </article>`;
                }
                if (it.type === 'comment') {
                  const c = it.c;
                  const ra = c.reportAuthor;
                  const pa = c.parentAuthor;
                  return `<article class="zh-feed-item">
                    <div class="zh-feed-head">
                      ${userAvatar(c.author, 'zh-avatar')}
                      <b>${esc((c.author || {}).displayName || '成员')}</b>
                      <span>${
                        c.isReply
                          ? `回复了 <b>${esc((pa || {}).displayName || '成员')}</b> 的评论`
                          : ra ? `评论了 ${esc(ra.displayName)} 的周报` : '评论了一篇周报'
                      }</span>
                      <time>${timeAgo(it.at)}</time>
                    </div>
                    <a class="zh-feed-title" href="#/report/${c.reportId}">${esc(c.reportTitle || '周报')}</a>
                    <div class="zh-feed-text">${esc(c.content)}</div>
                    <div class="zh-actions-row"><a href="#/report/${c.reportId}">查看讨论 →</a></div>
                  </article>`;
                }
                const m = it.m;
                return `<article class="zh-feed-item">
                  <div class="zh-feed-head">
                    ${userAvatar(m, 'zh-avatar')}
                    <b>${esc(m.displayName)}</b>
                    <span>加入了科协安全部</span>
                    <time>${timeAgo(it.at)}</time>
                  </div>
                  <div class="zh-feed-meta">
                    <span class="zh-tag">@${esc(m.username)}</span>
                    ${m.studentId ? `<span class="zh-tag">${esc(m.studentId)}</span>` : ''}
                  </div>
                  <div class="zh-actions-row"><a href="#/u/${m.id}">查看主页 →</a></div>
                </article>`;
              })
              .join('') || '<div class="zh-feed-item" style="text-align:center;color:var(--zh-muted)">还没有动态</div>'}
          </div>
        </main>

        <aside class="zh-side">
          ${(() => {
            const n = state.site && state.site.modalNotice;
            if (!n || !n.enabled || !n.title) return '';
            const foldKey = 'wsec-notice-fold-' + (n.version || '1');
            const foldDefault = ls.get(foldKey, n.pinned ? '0' : '1') === '1';
            return `<div class="zh-side-card notice-card ${n.pinned ? 'pinned' : ''}">
              <div class="zh-side-title notice-side-title">
                ${n.pinned ? '<span class="chip soft-primary">置顶</span>' : '<span class="chip soft-primary">公告</span>'}
                <button class="fold-btn" type="button" data-fold title="展开 / 折叠">${n.pinned ? '▾' : '▸'}</button>
              </div>
              <div class="notice-side-body ${foldDefault ? 'folded' : ''}">
                <b style="display:block;margin-bottom:6px">${esc(n.title)}</b>
                <div class="prose notice-prose">${md(n.body)}</div>
              </div>
            </div>`;
          })()}
          <div class="zh-side-card">
            <div class="zh-side-title">贡献排行</div>
            <div class="zh-side-body">
              ${
                (ov.leaderboard || [])
                  .slice(0, 5)
                  .map(
                    (u2, i) =>
                      `<div class="zh-side-item"><span class="n">${i + 1}</span><a href="#/u/${
                        u2.id
                      }">${esc(u2.displayName)}</a><span class="v">${u2.reports} 篇</span></div>`
                  )
                  .join('') || '<span style="color:var(--zh-muted)">暂无</span>'
              }
            </div>
          </div>
        <div class="zh-side-card">
            <div class="zh-side-title">部门公告</div>
            <div class="zh-side-body">${esc(state.site.siteNotice || '欢迎使用 HJSEC 安全学习周报，记录每一次攻防。')}</div>
          </div>

          <div class="zh-side-card">
            <div class="zh-side-title">本周提醒</div>
            <div class="zh-side-body">
              ${
                me.thisWeekSubmittedCount > 0
                  ? `本周已提交 ${me.thisWeekSubmittedCount} 篇`
                  : me.thisWeekDrafts > 0
                  ? `还有 ${me.thisWeekDrafts} 篇草稿没提交`
                  : '本周还没写周报'
              }
              <div style="margin-top:8px"><a href="#/report/new">去写周报 →</a></div>
            </div>
          </div>

          <div class="zh-side-card">
            <div class="zh-side-title">热门技术方向</div>
            <div class="zh-side-body">
              ${
                groups
                  .map(
                    (g) => `<div class="zh-side-item"><span class="n">#</span><a href="#/reports?category=${encodeURIComponent(
                      g.name
                    )}">${esc(g.name)}</a><span class="v">${g.count}</span></div>`
                  )
                  .join('') || '<span style="color:var(--zh-muted)">暂无</span>'
              }
            </div>
          </div>

          </aside>
      </div>`;
  }

  function setTitle(t) {
    const el = $('#page-title');
    if (el) el.textContent = t;
    const site = (state.site && state.site.siteName) || 'HJSEC 安全学习周报';
    document.title = t + ' · ' + site;
  }

  function markNav(key) {
    document.querySelectorAll('[data-nav]').forEach((a) => {
      a.classList.toggle('active', a.dataset.nav === key);
    });
    const sb = $('#sidebar');
    if (sb) sb.classList.remove('open');
    const ov = $('#overlay');
    if (ov) ov.classList.remove('show');
  }

  async function refreshUnread() {
    try {
      const d = await api.get('/notifications');
      state.unread = d.unread || 0;
      const b = $('#nav-badge');
      if (b) {
        b.textContent = state.unread > 99 ? '99+' : String(state.unread);
        b.hidden = state.unread === 0;
      }
    } catch (e) {
      /* 静默 */
    }
    try {
      const m = await api.get('/messages/unread');
      const mb = $('#msg-badge');
      if (mb) {
        mb.textContent = m.unread > 99 ? '99+' : String(m.unread);
        mb.hidden = !m.unread;
      }
    } catch (e) {
      /* 静默 */
    }
  }

  async function loadWeekBase() {
    try {
      const d = await api.get('/week-base');
      if (d && d.start) state.weekBase = d;
    } catch (e) {
      state.weekBase = { start: '2026-09-14', num: 1 };
    }
  }

  /* ================= 路由 ================= */
  async function navigate() {
    if (!state.user) return;
    // 离开编辑器时退出全屏
    document.body.classList.remove('md-focus');
    const focusTip = document.querySelector('.md-focus-tip');
    if (focusTip) focusTip.remove();
    if (state.chatTimer) {
      clearInterval(state.chatTimer);
      state.chatTimer = null;
    }
    const raw = location.hash.slice(1) || '/dashboard';
    const [path, search] = raw.split('?');
    const query = new URLSearchParams(search || '');
    const parts = path.split('/').filter(Boolean);
    const view = $('#view');
    if (!view) return;

    try {
      const seg0 = parts[0] || 'dashboard';
      // 仪表盘用「铺满一屏 + 内部滚动」的布局
      view.classList.toggle('dash-view', seg0 === 'dashboard');


      if (seg0 === 'dashboard' || seg0 === 'feed') {
        markNav('dashboard');
        if (uiIsZhihu()) await viewFeedZhihu(view, query.get('f') || 'all');
        else await viewFeed(view, query.get('f') || 'all');
      } else if (seg0 === 'reports') {
        markNav('reports');
        await viewReports(view, query, false);
      } else if (seg0 === 'status') {
        markNav('status');
        await viewStatus(view);
      } else if (seg0 === 'leaderboard') {
        markNav('leaderboard');
        await viewLeaderboard(view);
      } else if (seg0 === 'members') {
        markNav('members');
        await viewMembers(view);
      } else if (seg0 === 'mine') {
        markNav('mine');
        await viewReports(view, query, true);
      } else if (seg0 === 'report') {
        if (parts[1] === 'new') {
          markNav('mine');
          await viewEditor(view, null, query.get('week'));
        } else if (parts[2] === 'edit') {
          markNav('mine');
          await viewEditor(view, parts[1]);
        } else {
          markNav('mine');
          await viewReportDetail(view, parts[1]);
        }
      } else if (seg0 === 'groups' || seg0 === 'group') {
        // 项目组功能已下线
        location.hash = '#/dashboard';
        return;
      } else if (seg0 === 'notifications') {
        markNav('');
        await viewNotifications(view);
      } else if (seg0 === 'forum' || seg0 === 'post' || seg0 === 'messages') {
        // 社区功能已关闭
        location.hash = '#/dashboard';
        return;
      } else if (seg0 === 'articles') {
        markNav('articles');
        await viewArticles(view);
      } else if (seg0 === 'u' && parts[1]) {
        markNav('');
        await viewProfile(view, parts[1]);
      } else if (seg0 === 'settings') {
        markNav('settings');
        await viewSettings(view);
      } else if (seg0 === 'admin') {
        markNav('admin');
        await viewAdmin(view, query);
      } else {
        view.innerHTML = emptyState('🧭', '页面不存在', '<a class="btn" href="#/dashboard">回到仪表盘</a>');
      }
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'auto' : 'auto' });
      const jump = state.jumpTo || '';
      state.jumpTo = '';
      if (jump === 'comments') {
        setTimeout(() => {
          const card = document.getElementById('comments') || document.getElementById('comments-card');
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 260);
      }
    } catch (e) {
      if (e.status === 401) return;
      view.innerHTML = emptyState('⚠️', e.message || '加载失败', '<a class="btn" href="#/dashboard">回到仪表盘</a>');
    }
  }

  /* ================= 仪表盘 ================= */
  /** 朋友圈式评论条：最多 2 条 + 查看全部 */
  function commentStrip(r) {
    const list = Array.isArray(r.recentComments) ? r.recentComments : [];
    const total = Number(r.comments) || 0;
    if (!list.length && !total) return '';
    const items = list
      .map(
        (c) =>
          `<div class="cmt-item"><b class="cmt-who">${esc(c.author)}</b><span class="cmt-sep">：</span><span class="cmt-txt">${esc(
            c.content
          )}</span></div>`
      )
      .join('');
    const more =
      total > list.length
        ? `<a class="cmt-more" href="#/report/${r.id}" data-jump="comments">查看全部 ${total} 条评论 ›</a>`
        : `<a class="cmt-more" href="#/report/${r.id}" data-jump="comments">写评论 ›</a>`;
    return `<div class="cmt-strip">${items}${more}</div>`;
  }

  function reportItemHtml(r) {
    const au = r.author || {};
    return `<div class="read-item"><a class="read-row" href="#/report/${r.id}">
      ${userAvatar({...au, id: au.id || (r.author||{}).id}, 'read-avatar clickable')}
      <div class="read-main">
        <div class="read-meta">
          <b class="read-author">${esc(au.displayName || au.username || '未知')}</b>
          <span class="read-dot">·</span>
          <span>第${weekNumber(r.weekStart)}周</span>
          <span class="read-dot">·</span>
          <span>${dateTimeShort(r.createdAt)}</span>
          ${r.status === 'draft' ? '<span class="chip soft-warn">草稿</span>' : ''}
          ${r.category ? `<span class="chip read-cat">${esc(r.category)}</span>` : ''}
        </div>
        <div class="read-title">${esc(r.title)}</div>
        ${(() => {
          const text = (r.summary && r.summary.length >= (r.excerpt || '').length)
            ? r.summary
            : (r.excerpt || r.summary || '');
          if (!text) return '';
          return `<div class="read-summary">
            <span class="read-summary-text">${esc(text)}</span>
            <span class="read-more">阅读全文 ></span>
          </div>`;
        })()}
        <div class="read-tags">
          ${(r.tags || []).slice(0, 4).map((t) => `<span class="read-tag">${esc(t)}</span>`).join('')}
        </div>
      </div>
      <div class="read-stats">
        <button type="button" class="read-stat read-like" data-like="${r.id}" title="点赞">♥ <span data-like-n="${r.id}">${r.likes}</span></button>
        <a class="read-stat read-cmt" href="#/report/${r.id}" data-jump="comments" title="查看评论">💬 ${r.comments}</a>
        <span class="read-stat read-chars">${fmtChars(r.chars)}</span>
        ${canEditReport(r) ? `<button type="button" class="card-edit" data-qe="${r.id}" title="快速编辑">✎</button>` : ''}
      </div>
    </a>${commentStrip(r)}</div>`;
  }

  /* ================= 弹窗公告 ================= */
  function maybeShowNotice(options = {}) {
    options = options || {};
    const force = options.force === true;
    const n = state.site && state.site.modalNotice;
    if (!n || !n.enabled || !n.title) return;
    const key = 'wsec-notice-' + (n.version || '1');
    if (!force && ls.get(key, '') === '1') return;

    const root = $('#modal-root');
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal notice-modal" role="dialog" aria-modal="true" aria-label="公告">
          <h3>${esc(n.title)}</h3>
          <div class="notice-body prose">${md(n.body || '')}</div>
          <div class="notice-act">
            <button class="link" id="notice-later">稍后</button>
            <button class="btn primary" id="notice-ok">知道了</button>
          </div>
        </div>
      </div>`;
    const close = (seen) => {
      if (seen && !force) ls.set(key, '1');
      root.innerHTML = '';
      if (seen && force && options.afterClose) options.afterClose();
    };
    $('#notice-ok').onclick = () => close(true);
    $('#notice-later').onclick = () => close(false);
    root.querySelector('.modal-backdrop').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) close(false);
    });
  }

  const FEED_FILTERS = [
    ['all', '全部'],
    ['report', '周报'],
    ['comment', '评论'],
    ['member', '成员']
  ];

  async function viewFeed(view, filter = 'all') {
    setTitle(filter === 'all' ? '首页' : '动态 · ' + (FEED_FILTERS.find((f) => f[0] === filter) || ['', '全部'])[1]);
    const [reports, members, ov, me, comments] = await Promise.all([
      api.get('/reports?scope=all&limit=10'),
      api.get('/members'),
      api.get('/reports/stats/overview'),
      api.get('/reports/stats/me'),
      api.get('/comments/recent?limit=12').catch(() => ({ items: [] }))
    ]);

    // 真实动态：周报提交 + 成员加入（时间倒序）
    const items = [
      ...(reports.items || []).map((r) => ({
        type: 'report',
        at: r.createdAt,
        actor: r.author,
        title: r.title,
        summary: r.summary,
        excerpt: r.excerpt,
        week: r.weekStart,
        category: r.category,
        chars: r.chars,
        id: r.id
      })),
      ...(comments.items || []).map((c) => ({
        type: 'comment',
        at: c.createdAt,
        actor: c.author,
        text: c.content,
        reportId: c.reportId,
        reportTitle: c.reportTitle,
        reportAuthor: c.reportAuthor,
        isReply: c.isReply,
        parentAuthor: c.parentAuthor
      })),
      ...(members.items || [])
        .filter((m) => m.createdAt)
        .map((m) => ({ type: 'member', at: m.createdAt, actor: m, title: '加入了安全部' }))
    ].sort((a, b) => (a.at < b.at ? 1 : -1));

    const groups = (ov.groupCounts || []).filter((g) => g.count > 0);
    const activeMembers = (members.items || []).slice().sort((a, b) => (b.reports || 0) - (a.reports || 0)).slice(0, 6);
    const shown = items.filter((it) => filter === 'all' || it.type === filter);

    view.innerHTML = `
      <div class="gh-home">
        <div>
          <div class="feed-head">
            <h2>动态</h2>
            <span class="chip ${me.thisWeekSubmittedCount > 0 ? 'soft-success' : me.thisWeekDrafts > 0 ? 'soft-warn' : ''}">
              ${
                me.thisWeekSubmittedCount > 0
                  ? `本周已提交 ${me.thisWeekSubmittedCount} 篇`
                  : me.thisWeekDrafts > 0
                  ? `草稿 ${me.thisWeekDrafts} 篇待提交`
                  : '本周还没提交'
              }
            </span>
            <div class="feed-filter">
              ${FEED_FILTERS.map(
                ([k, label]) =>
                  `<a class="btn sm ${filter === k ? 'active' : ''}" href="#/dashboard${k === 'all' ? '' : '?f=' + k}">${label}</a>`
              ).join('')}
              <a class="btn primary sm" href="#/report/new" style="margin-left:6px">＋ 写周报</a>
            </div>
          </div>

          <div id="feed-list">
            ${
              shown
                .map((it) => {
                  if (it.type === 'report')
                    return `<article class="feed-card">
                      <header class="feed-head-row">
                        ${userAvatar(it.actor, 'sm')}
                        <div class="fh-main">
                          <b>${esc((it.actor || {}).displayName || '成员')}</b>
                          <span class="act">submitted a weekly report</span>
                          <div style="font-size:11.5px;color:var(--text-3)">第 ${weekNumber(it.week)} 周 · ${dateTimeShort(it.at)}</div>
                        </div>
                        <time>${timeAgo(it.at)}</time>
                        <button type="button" class="gh-icon-btn" title="更多" aria-label="更多">···</button>
                      </header>
                      <div class="feed-body">
                        <a class="feed-title" href="#/report/${it.id}">${esc(it.title)}</a>
                        <div class="feed-box">
                          <p>${esc(it.summary || '（这篇周报没有填写摘要，点击查看完整内容）')}</p>
                          <a class="feed-more" href="#/report/${it.id}">查看完整周报 →</a>
                        </div>
                        <div class="feed-meta-row">
                          <span class="chip">第 ${weekNumber(it.week)} 周</span>
                          ${it.category ? `<span class="chip">${esc(it.category)}</span>` : ''}
                          <span>${fmtChars(it.chars)}</span>
                        </div>
                      </div>
                      <footer class="feed-foot-row">
                        <span>贡献者</span>
                        <span class="contrib-avatars">${userAvatar(it.actor, 'sm')}</span>
                        <span class="spacer"></span>
                        <a href="#/report/${it.id}">查看周报</a>
                      </footer>
                    </article>`;

                  if (it.type === 'comment')
                    return `<article class="feed-card">
                      <header class="feed-head-row">
                        ${userAvatar(it.actor, 'sm')}
                        <div class="fh-main">
                          <b>${esc((it.actor || {}).displayName || '成员')}</b>
                          <span class="act">${
                            it.isReply
                              ? `回复了 ${esc((it.parentAuthor || {}).displayName || '成员')} 的评论`
                              : it.reportAuthor
                                ? `评论了 ${esc(it.reportAuthor.displayName)} 的周报`
                                : '评论了一篇周报'
                          }</span>
                          <a href="#/report/${it.reportId}">《${esc(it.reportTitle || '周报')}》</a>
                        </div>
                        <time>${timeAgo(it.at)}</time>
                      </header>
                      <div class="feed-body">
                        <div class="feed-box">
                          <p>${esc(it.text || '')}</p>
                          <a class="feed-more" href="#/report/${it.reportId}">查看周报 →</a>
                        </div>
                      </div>
                    </article>`;

                  if (it.type === 'member')
                    return `<article class="feed-card">
                      <div class="feed-member">
                        ${userAvatar(it.actor, 'sm')}
                        <div>
                          <b>${esc(it.actor.displayName)}</b>
                          <span style="color:var(--text-2)">joined the Security Department</span>
                          <span style="color:var(--text-3)">· @${esc(it.actor.username)}</span>
                        </div>
                        <time>${timeAgo(it.at)}</time>
                      </div>
                    </article>`;

                  return '';
                })
                .join('') ||
              `<div class="feed-card"><div class="feed-empty">这里还没有动态</div></div>`
            }
          </div>
        </div>

        <aside class="gh-rail">
          <section class="rail-card">
            <div class="rail-head">${ICONS.bell} Latest announcements</div>
            <div class="rail-body">
              ${
                (state.site.modalNotice && state.site.modalNotice.enabled && state.site.modalNotice.title)
                  ? (() => {
                      const n = state.site.modalNotice;
                      const time = timeAgo(new Date(parseInt(n.version || Date.now(), 10)).toISOString());
                      const foldKey = 'wsec-notice-fold-' + (n.version || '1');
                      const foldDefault = ls.get(foldKey, n.pinned ? '0' : '1') === '1';
                      return `<div class="rail-item notice-item ${n.pinned ? 'pinned' : ''}">
                      <div class="rail-time">
                        ${n.pinned ? '<span class="chip soft-primary">置顶</span>' : '公告'}
                        · ${time}
                        <button class="fold-btn" type="button" data-fold title="展开 / 折叠">${n.pinned ? '▾' : '▸'}</button>
                      </div>
                      <div class="rail-title">${esc(n.title)}</div>
                      <div class="notice-rail-body ${foldDefault ? 'folded' : ''}">
                        <div class="prose notice-prose">${md(n.body)}</div>
                      </div>
                    </div>`;
                    })()
                  : `<div class="rail-item">
                      <div class="rail-time">${esc(state.site.siteName || 'HJSEC')} · 公告</div>
                      <div class="rail-title">${esc(state.site.siteNotice || '欢迎使用 HJSEC 安全学习周报')}</div>
                      <div class="rail-text">每周复盘一次技术学习，坚持记录就是最快的成长方式。</div>
                    </div>`
              }
              <div class="rail-item">
                <div class="rail-time">系统</div>
                <div class="rail-title">周报提醒已开启</div>
                <div class="rail-text">每周六 22:00 提醒未提交成员，周日 22:00 发送未提交通知。</div>
              </div>            </div>
          </section>

          <section class="rail-card">
            <div class="rail-head">${ICONS.users} Active members</div>
            <div class="rail-body">
              ${activeMembers
                .map(
                  (m) => `<div class="member-row">
                    ${userAvatar(m, 'sm')}
                    <span class="name"><a href="#/u/${m.id}">${esc(m.displayName)}</a></span>
                    <span class="count">${m.reports || 0} 篇</span>
                  </div>`
                )
                .join('') || '<div class="rail-empty">还没有成员</div>'}
            </div>
          </section>
        </aside>
      </div>`;
  }



  /* ================= 仪表盘 ================= */
  /* ================= 提交情况（最近 N 周谁交没交） ================= */
  async function viewStatus(view) {
    setTitle('提交情况');
    const d = await api.get('/reports/status?weeks=10');
    const baseStart = (state.weekBase && state.weekBase.start) || '';
    // 只展示学期开始之后的周次，避免把「基准周之前」的周显示成第 1 周
    const weeks = (d.weeks || []).filter((w) => !baseStart || w >= baseStart);
    if (!weeks.length) weeks.push(d.currentWeek);
    const cur = d.currentWeek;
    const items = d.items || [];
    const missing = items.filter((u) => u.byWeek[cur] !== 'submitted');
    const submitted = items.filter((u) => u.byWeek[cur] === 'submitted');
    const weekTitle = (w) => (w === cur ? '本周' : `第${weekNumber(w)}周`);

    view.innerHTML = `
      <div class="page-tabs">
        <a class="tab" href="#/members">成员</a>
        <a class="tab active" href="#/status">提交情况</a>
        <a class="tab" href="#/leaderboard">排行榜</a>
      </div>
      <div class="page-head">
        <div>
          <h2>提交情况</h2>
          <p>最近 ${weeks.length} 周 · 本周已交 ${submitted.length} / ${items.length} 人${missing.length ? ` · 未交 ${missing.length} 人` : ''}</p>
        </div>
        <div class="spacer"></div>
        <label class="chip" style="cursor:pointer">
          <input type="checkbox" id="st-only-missing" style="margin-right:6px" />只看本周未交
        </label>
        ${state.user.role === 'admin' ? '<button class="btn" id="st-exclude">排除成员</button>' : ''}
        <a class="btn" href="#/reports">周报总览</a>
      </div>

      <div class="hint" style="margin:-4px 0 14px;font-size:12px;color:var(--muted)">
        按周报所选「周次」统计；如果某人周一的周报其实记录的是上一周，可在卡片右上角 ✎ 快速编辑里把周次改到上一周。
        ${d.excluded && d.excluded.length ? `已排除 ${d.excluded.length} 人。` : ''}
      </div>

      ${
        missing.length
          ? `<div class="card pad" style="margin-bottom:16px">
               <div class="card-title">本周未提交 <span class="chip soft-warn">${missing.length} 人</span></div>
               <div class="taglist">
                 ${missing.map((u) => `<span class="chip">${esc(u.displayName)}</span>`).join('')}
               </div>
             </div>`
          : ''
      }

      <div class="card status-wrap">
        <table class="table status-table">
          <thead>
            <tr>
              <th>成员</th>
              ${weeks
                .map(
                  (w) =>
                    `<th class="${w === cur ? 'is-current' : ''}">${weekTitle(w)}<div class="st-sub">${w.slice(5)}</div></th>`
                )
                .join('')}
              <th>已交/周数</th>
            </tr>
          </thead>
          <tbody>
            ${
              items
                .map(
                  (u) => `<tr data-missing="${u.byWeek[cur] === 'submitted' ? '0' : '1'}">
                    <td>
                      <div class="u">${userAvatar(u, 'sm')}
                        <div>
                          <div style="font-weight:600">${esc(u.displayName)}</div>
                          <div class="st-sub">@${esc(u.username)}</div>
                        </div>
                      </div>
                    </td>
                    ${weeks
                      .map((w) => {
                        const v = u.byWeek[w];
                        const cls = v === 'submitted' ? 'ok' : v === 'draft' ? 'draft' : 'none';
                        const txt = v === 'submitted' ? '✓' : v === 'draft' ? '草' : '—';
                        const tip = v === 'submitted' ? '已提交' : v === 'draft' ? '只有草稿' : '未提交';
                        return `<td><span class="status-cell ${cls}" title="${tip}">${txt}</span></td>`;
                      })
                      .join('')}
                    <td class="st-sub">${weeks.filter((w) => u.byWeek[w] === 'submitted').length}/${weeks.length}</td>
                  </tr>`
                )
                .join('') ||
              `<tr><td colspan="${weeks.length + 2}"><div class="empty" style="padding:26px">还没有成员</div></td></tr>`
            }
          </tbody>
        </table>
      </div>`;

    const only = $('#st-only-missing');
    if (only) {
      only.onchange = () => {
        view.querySelectorAll('.status-table tbody tr').forEach((tr) => {
          tr.hidden = only.checked && tr.dataset.missing === '1';
        });
      };
    }

    const exBtn = $('#st-exclude');
    if (exBtn) {
      exBtn.onclick = async () => {
        try {
          const [usersData, exData] = await Promise.all([
            api.get('/admin/users?limit=100'),
            api.get('/admin/status-excluded')
          ]);
          const excluded = new Set(exData.ids || []);
          const root = $('#modal-root');
          root.innerHTML = `
            <div class="modal-backdrop">
              <div class="modal" role="dialog" aria-modal="true" style="max-width:480px">
                <h3>排除成员</h3>
                <p style="color:var(--muted);font-size:12.5px;margin:0 0 10px">
                  勾选的人不会出现在「提交情况」统计和未提交名单里（例如管理员、不要求写周报的成员）。
                </p>
                <div class="exclude-list">
                  ${(usersData.items || [])
                    .map(
                      (u) => `<label class="exclude-row">
                        <input type="checkbox" value="${u.id}" ${excluded.has(u.id) ? 'checked' : ''} />
                        <span>${esc(u.displayName)}<span class="st-sub"> @${esc(u.username)}</span></span>
                      </label>`
                    )
                    .join('')}
                </div>
                <div class="acts">
                  <button class="btn" data-act="cancel">取消</button>
                  <button class="btn primary" data-act="ok">保存</button>
                </div>
              </div>
            </div>`;
          const close = () => {
            root.innerHTML = '';
          };
          root.querySelector('[data-act="cancel"]').onclick = close;
          root.querySelector('.modal-backdrop').onclick = (e) => {
            if (e.target.classList.contains('modal-backdrop')) close();
          };
          root.querySelector('[data-act="ok"]').onclick = async () => {
            const ids = [...root.querySelectorAll('.exclude-row input:checked')].map((i) => Number(i.value));
            try {
              await api.put('/admin/status-excluded', { ids });
              close();
              toast('排除名单已保存', 'success');
              navigate();
            } catch (e) {
              toast(e.message, 'error');
            }
          };
        } catch (e) {
          toast(e.message, 'error');
        }
      };
    }
  }


  /* ================= 通用分页器 ================= */
  function pagerHtml({ page, pageSize, total }) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (total <= pageSize) {
      return `<div class="pager-info">共 ${total} 篇</div>`;
    }
    const cur = Math.min(Math.max(1, page), pages);
    const btn = (p, label, disabled) =>
      `<button type="button" class="pager-btn ${p === cur ? 'active' : ''}" data-page="${p}" ${disabled ? 'disabled' : ''}>${label}</button>`;

    // 页码：首页、当前±2、末页，中间省略
    const nums = new Set([1, pages]);
    for (let i = cur - 2; i <= cur + 2; i++) if (i >= 1 && i <= pages) nums.add(i);
    const sorted = [...nums].sort((a, b) => a - b);
    let seq = '';
    let prev = 0;
    for (const n of sorted) {
      if (prev && n - prev > 1) seq += '<span class="pager-gap">…</span>';
      seq += btn(n, n, false);
      prev = n;
    }

    return `<div class="pager">
      ${btn(cur - 1, '上一页', cur <= 1)}
      ${seq}
      ${btn(cur + 1, '下一页', cur >= pages)}
      <span class="pager-jump">
        第 <input class="input pager-input" id="pager-jump" type="number" min="1" max="${pages}" value="${cur}" /> / ${pages} 页
      </span>
      <span class="pager-info">共 ${total} 篇</span>
    </div>`;
  }

  /** 绑定分页器：跳转时保留现有筛选参数 */
  function bindPager(view, basePath, query) {
    const box = view.querySelector('.pager');
    if (!box) return;
    const go = (p) => {
      const params = new URLSearchParams();
      ['q', 'week', 'category', 'tag', 'f'].forEach((k) => {
        const v = query.get(k);
        if (v) params.set(k, v);
      });
      if (p > 1) params.set('page', String(p));
      const qs = params.toString();
      location.hash = `#/${basePath}${qs ? '?' + qs : ''}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    box.querySelectorAll('[data-page]').forEach((b) => {
      b.onclick = () => go(Number(b.dataset.page));
    });
    const jump = box.querySelector('#pager-jump');
    if (jump) {
      jump.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        const p = parseInt(jump.value, 10);
        if (Number.isInteger(p) && p >= 1) go(p);
      };
    }
  }

  async function viewReports(view, query, mine) {
    const heading = mine ? '我的周报' : '周报总览';
    setTitle(heading);
    const q = query.get('q') || '';
    const week = query.get('week') || '';
    const tag = query.get('tag') || '';
    const category = query.get('category') || '';
    const PAGE_SIZE = 20;
    const page = Math.max(1, parseInt(query.get('page'), 10) || 1);
    let url = `/reports?scope=${mine ? 'mine' : 'all'}&limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`;
    if (q) url += `&q=${encodeURIComponent(q)}`;
    if (week) url += `&week=${week}`;
    if (tag) url += `&tag=${encodeURIComponent(tag)}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;
    const [data, tagData, groupData] = await Promise.all([
      api.get(url),
      api.get('/reports/tags' + (week ? `?week=${encodeURIComponent(week)}` : '')),
      api.get('/report-groups').catch(() => ({ items: [] }))
    ]);
    const filterGroups = (groupData.items || []).map((g) => g.name);
    if (filterGroups.length) state.site.reportGroups = filterGroups;

    const weeks = lastWeeks(12);
    const weekOpts = weeks
      .map((w) => `<option value="${w}" ${w === week ? 'selected' : ''}>第${weekNumber(w)}周 (${weekRange(w)})</option>`)
      .join('');
    const tags = tagData.items || [];
    const tagOpts = tags
      .map(
        (t) =>
          `<option value="${esc(t.tag)}" ${t.tag === tag ? 'selected' : ''}>${esc(t.tag)}（${t.count}）</option>`
      )
      .join('');
    const hasFilter = !!(q || week || tag || category);
    const catOpts = (filterGroups.length ? filterGroups : reportGroups())
      .map((g) => `<option value="${esc(g)}" ${g === category ? 'selected' : ''}>${esc(g)}</option>`)
      .join('');
    const filterDesc = [
      week ? `第${weekNumber(week)}周` : '',
      category ? `分组「${category}」` : '',
      tag ? `标签「${tag}」` : '',
      q ? `搜索「${q}」` : ''
    ]
      .filter(Boolean)
      .join(' · ');

    view.innerHTML = `
      <div class="repo-head">
        <div class="repo-title">
          <b>${heading}</b>
          <span class="chip">${data.total} 篇</span>
        </div>
        <div class="repo-actions">
          ${hasFilter ? `<a class="btn sm" href="#/${mine ? 'mine' : 'reports'}">清除筛选</a>` : ''}
          ${mine ? '<a class="btn primary" href="#/report/new">＋ 写周报</a>' : ''}
        </div>
      </div>

      <div class="page-tabs">
        <a class="tab ${mine ? '' : 'active'}" href="#/reports">全部周报</a>
        <a class="tab ${mine ? 'active' : ''}" href="#/mine">我的周报</a>
      </div>

      <div class="read-toolbar">
        <div class="search-box">
          ${ICONS.search}
          <input class="input" id="rq" placeholder="搜索标题或正文…" value="${esc(q)}" />
        </div>
        <select class="select" id="rw" style="max-width:170px">
          <option value="">全部周次</option>
          ${weekOpts}
        </select>
        <select class="select" id="rc" style="max-width:130px">
          <option value="">全部方向</option>
          ${catOpts}
        </select>
        <select class="select" id="rt" style="max-width:150px">
          <option value="">全部标签</option>
          ${tagOpts}
        </select>
        ${filterDesc ? `<span class="hint" style="margin-left:auto">${esc(filterDesc)}</span>` : ''}
      </div>
      <div class="read-list">
        ${
          data.items.map(reportItemHtml).join('') ||
          emptyState('📄', mine ? '没有符合条件的周报' : '没有符合条件的周报，换个周次或标签试试')
        }
      </div>
      ${pagerHtml({ page, pageSize: PAGE_SIZE, total: data.total || 0 })}`;

    bindQuickEdit(view);
    bindPager(view, mine ? 'mine' : 'reports', query);

    const apply = () => {
      const params = new URLSearchParams();
      if ($('#rq').value.trim()) params.set('q', $('#rq').value.trim());
      if ($('#rw').value) params.set('week', $('#rw').value);
      if ($('#rc') && $('#rc').value) params.set('category', $('#rc').value);
      if ($('#rt').value) params.set('tag', $('#rt').value);
      const qs = params.toString();
      location.hash = `#/${mine ? 'mine' : 'reports'}${qs ? '?' + qs : ''}`;
    };
    $('#rw').onchange = apply;
    if ($('#rc')) $('#rc').onchange = apply;
    $('#rt').onchange = apply;
    $('#rq').onkeydown = (e) => {
      if (e.key === 'Enter') apply();
    };
  }

  /* ================= 成员列表（点卡片 / 头像进个人主页看周报） ================= */
  function memberCard(u) {
    const last = u.lastWeek ? `最近 第${weekNumber(u.lastWeek)}周` : '还没提交过';
    return `<a class="member-card" href="#/u/${u.id}" data-search="${esc(
      [u.displayName, u.username, u.studentId].filter(Boolean).join(' ')
    ).toLowerCase()}">
      ${userAvatar(u, 'xl')}
      <div class="mc-main">
        <div class="mc-name">${esc(u.displayName)}${
          u.role === 'admin' ? ' <span class="chip soft-primary">管理员</span>' : ''
        }</div>
        <div class="mc-sub">@${esc(u.username)}${u.studentId ? ` · ${esc(u.studentId)}` : ''}</div>
        ${u.bio ? `<div class="mc-bio">${esc(u.bio)}</div>` : ''}
        <div class="mc-stats">
          <span>📄 ${u.reports} 篇</span>
          <span>${fmtChars(u.chars)}</span>
          <span>${last}</span>
        </div>
      </div>
      <span class="mc-go">查看周报 →</span>
    </a>`;
  }

  /* ================= 成员周报字数排行榜 ================= */
  async function viewLeaderboard(view) {
    setTitle('字数排行榜');
    let range = ls.get('lb-range', 'all');
    if (!['week', 'month', 'all'].includes(range)) range = 'all';
    const rangeLabel = (r) => (r === 'week' ? '本周' : r === 'month' ? '近四周' : '累计');

    const rowHtml = (u) => `<a class="lb-row" href="#/u/${u.id}">
      <span class="lb-rank">${u.rank}</span>
      ${userAvatar(u, 'sm')}
      <div class="lb-main">
        <div class="lb-name">${esc(u.displayName)}
          <span class="lb-sub">@${esc(u.username)} · ${u.reports} 篇 · 平均 ${fmtChars(u.avgChars)}</span>
        </div>
        <div class="lb-bar"><i style="width:${Math.max(2, u.relative || 0)}%"></i></div>
      </div>
      <div class="lb-num">${fmtChars(u.chars)}<span class="lb-share">${u.share || 0}%</span></div>
    </a>`;

    const podHtml = (u, i) => `<a class="lb-pod p${i + 1}" href="#/u/${u.id}">
      <div class="lb-pod-medal">${['🥇', '🥈', '🥉'][i] || ''}</div>
      ${userAvatar(u, 'sm')}
      <div class="lb-pod-name">${esc(u.displayName)}</div>
      <div class="lb-pod-chars">${fmtChars(u.chars)}</div>
      <div class="lb-pod-sub">${u.reports} 篇 · ${u.weeks} 周</div>
    </a>`;

    const render = async () => {
      const d = await api.get(`/reports/leaderboard?range=${range}&limit=100`);
      const items = d.items || [];
      const me = d.me;
      const top = items.slice(0, 3);
      const rest = items.slice(3);

      view.innerHTML = `
        <div class="page-tabs">
          <a class="tab" href="#/members">成员</a>
          <a class="tab" href="#/status">提交情况</a>
          <a class="tab active" href="#/leaderboard">排行榜</a>
        </div>

        <div class="page-head">
          <div>
            <h2>周报字数排行榜</h2>
            <p>${rangeLabel(range)} · ${d.totalMembers} 人 · 共 ${d.totalReports} 篇 / ${fmtChars(d.totalChars)}</p>
          </div>
          <div class="spacer"></div>
          <div class="seg" id="lb-range">
            ${['week', 'month', 'all']
              .map(
                (r) =>
                  `<button type="button" class="seg-btn ${r === range ? 'active' : ''}" data-range="${r}">${rangeLabel(
                    r
                  )}</button>`
              )
              .join('')}
          </div>
        </div>

        ${
          me
            ? me.chars
              ? `<div class="lb-me">我的排名 <b>第 ${me.rank} 名</b><span>${fmtChars(me.chars)} · 本周 ${fmtChars(
                  me.weekChars
                )}</span></div>`
              : `<div class="lb-me">我还没有已提交的周报<span>写一篇就能上榜 · 本周 ${fmtChars(
                  me.weekChars
                )}</span></div>`
            : ''
        }

        ${top.length ? `<div class="lb-podium">${top.map((u, i) => podHtml(u, i)).join('')}</div>` : ''}

        <div class="card pad lb-list">
          ${
            rest.map(rowHtml).join('') ||
            (items.length
              ? '<div class="hint" style="text-align:center;padding:10px">前三名已在上面。</div>'
              : emptyState('📝', '还没有已提交的周报', '<a class="btn" href="#/report/new">去写周报</a>'))
          }
        </div>

        <div class="hint" style="margin-top:12px">
          只统计「已提交」的周报正文，按字符数计算（含中文、标点，不含空格换行处理以外的差异）；草稿不计入。
        </div>`;

      view.querySelectorAll('#lb-range [data-range]').forEach((b) => {
        b.onclick = () => {
          range = b.dataset.range;
          ls.set('lb-range', range);
          render().catch((e) => toast(e.message, 'error'));
        };
      });
    };

    await render();
  }

  async function viewMembers(view) {
    setTitle('成员');
    const d = await api.get('/members');
    const items = d.items || [];
    view.innerHTML = `
      <div class="repo-head">
        <div class="repo-title">
          <b>成员</b>
          <span class="chip">${items.length} 人</span>
        </div>
        <div class="repo-actions">
          <div class="search-box" style="max-width:260px">
            ${ICONS.search}
            <input class="input" id="mb-q" placeholder="搜索姓名 / 用户名 / 学号…" />
          </div>
        </div>
      </div>

      <div class="page-tabs">
        <a class="tab active" href="#/members">成员</a>
        <a class="tab" href="#/status">提交情况</a>
        <a class="tab" href="#/leaderboard">排行榜</a>
      </div>
      <div class="member-grid" id="mb-grid">
        ${items.map(memberCard).join('') || emptyState('👥', '还没有成员')}
      </div>`;

    const q = $('#mb-q');
    q.oninput = () => {
      const kw = q.value.trim().toLowerCase();
      document.querySelectorAll('#mb-grid .member-card').forEach((c) => {
        const hit = !kw || (c.dataset.search || '').includes(kw);
        c.style.display = hit ? '' : 'none';
      });
    };
  }

  /* ================= 个人主页（点任意头像进入） ================= */
  async function viewProfile(view, uid) {
    const d = await api.get(`/reports/by-user/${encodeURIComponent(uid)}?limit=20`);
    const u = d.user || {};
    const st = d.stats || {};
    setTitle(u.displayName || '个人主页');

    const meta = [
      u.studentId ? `学号 ${esc(u.studentId)}` : '',
      `@${esc(u.username || '')}`,
      u.role === 'admin' ? '管理员' : '',
      u.createdAt ? `加入于 ${dateTime(u.createdAt).slice(0, 10)}` : ''
    ]
      .filter(Boolean)
      .join(' · ');

    view.innerHTML = `
      <div style="margin-bottom:8px"><a href="#/reports" style="font-size:13px;color:var(--muted)">← 返回周报总览</a></div>

      <div class="card pad profile-card">
        <div class="profile-head">
          ${userAvatar(u, 'xl')}
          <div class="grow">
            <h2>${esc(u.displayName || '未知用户')}${
              d.isSelf ? ' <span class="chip soft-primary" style="vertical-align:middle">我</span>' : ''
            }</h2>
            <div class="profile-meta">${meta}</div>
            ${u.bio ? `<p class="profile-bio">${esc(u.bio)}</p>` : ''}
          </div>
        </div>
        <div class="profile-stats">
          <div class="profile-stat"><b>${st.reports || 0}</b><span>已提交周报</span></div>
          <div class="profile-stat"><b>${fmtChars(st.chars || 0)}</b><span>累计字数</span></div>
          <div class="profile-stat"><b>${st.weeks || 0}</b><span>覆盖周次</span></div>
          <div class="profile-stat"><b>${st.streak || 0}</b><span>连续提交（周）</span></div>
        </div>
      </div>

      <div class="card pad" style="margin-top:16px">
        <div class="card-title">全部周报 <span style="color:var(--muted);font-weight:500">（${d.total}）</span></div>
        <div class="list" id="profile-list">
          ${
            (d.items || []).map(reportItemHtml).join('') ||
            emptyState('📄', d.isSelf ? '你还没有写周报' : '这位同学还没有提交过周报')
          }
        </div>
        <div style="display:flex;justify-content:center;margin-top:14px">
          <button class="btn sm" id="load-more" ${
            d.total > (d.items || []).length ? '' : 'hidden'
          }>加载更多</button>
        </div>
      </div>`;

    bindQuickEdit(view);

    let offset = (d.items || []).length;
    const more = $('#load-more');
    if (more) {
      more.onclick = async () => {
        more.disabled = true;
        more.textContent = '加载中…';
        try {
          const next = await api.get(
            `/reports/by-user/${encodeURIComponent(uid)}?limit=20&offset=${offset}`
          );
          $('#profile-list').insertAdjacentHTML('beforeend', (next.items || []).map(reportItemHtml).join(''));
          offset += (next.items || []).length;
          bindQuickEdit(view);
          more.disabled = false;
          more.textContent = '加载更多';
          if (offset >= next.total) more.hidden = true;
        } catch (e) {
          toast(e.message, 'error');
          more.disabled = false;
          more.textContent = '加载更多';
        }
      };
    }
  }

  /* ================= 周报详情 ================= */
  async function viewReportDetail(view, id) {
    const { report: r } = await api.get('/reports/' + id);
    setTitle(r.title);

    const atts = (r.attachments || [])
      .map(
        (a) => `<a class="attach" href="/api/attachments/${a.id}" target="_blank" rel="noopener">
          📎 ${esc(a.filename)} <span style="color:var(--muted)">${fmtSize(a.size)}</span>
        </a>`
      )
      .join('');

    // 炫酷阅读：从渲染后的正文提取标题生成目录
    // 服务端已预渲染（src/md-render.js），直接复用；降级到本地渲染
    const htmlBody = r.html || md(r.content);
    // 目录只取 #/##/### 三级标题（h1/h2/h3），放在正文右侧
    const headings = [...htmlBody.matchAll(/<h([123]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)].map((m) => ({
      level: Number(m[1]),
      id: m[2],
      text: m[3].replace(/<[^>]+>/g, '').replace(/¶/g, '').trim()
    }));
    // 目录树：按 h1 > h2 > h3 层级嵌套，带树形连接线
    const buildTocTree = (list) => {
      const root = { children: [], level: 0 };
      const stack = [root];
      for (const h of list) {
        while (stack.length > 1 && stack[stack.length - 1].level >= h.level) stack.pop();
        const node = { ...h, children: [] };
        stack[stack.length - 1].children.push(node);
        stack.push(node);
      }
      const renderNode = (node, depth) => {
        const kids = node.children || [];
        return `<li class="toc-node lv${node.level}${kids.length ? ' has-children' : ''}">
          <a class="toc-link" data-toc="${node.id}"><span class="toc-dot"></span><span class="toc-text">${esc(node.text)}</span></a>
          ${kids.length ? `<ul class="toc-tree">${kids.map((k) => renderNode(k, depth + 1)).join('')}</ul>` : ''}
        </li>`;
      };
      return `<ul class="toc-tree toc-root">${root.children.map((n) => renderNode(n, 0)).join('')}</ul>`;
    };
    const toc =
      headings.length >= 2
        ? `<nav class="article-toc">
            <div class="toc-title"><span class="toc-title-icon">⌘</span>本文目录</div>
            ${buildTocTree(headings)}
          </nav>`
        : '';

    view.innerHTML = `
      <div style="margin-bottom:6px"><a href="#/reports" style="font-size:13px;color:var(--muted)">← 返回周报列表</a></div>
      <div class="read-progress"><div class="read-progress-bar" id="read-progress"></div></div>
      <div class="article-layout">
      <div class="card pad article-card">
        <div class="detail-head">
          <div class="detail-meta">
            ${userAvatar(r.author)}
            <span style="font-weight:600;color:var(--text)">${esc(r.author ? r.author.displayName : '未知')}</span>
            <span class="week-badge">第${weekNumber(r.weekStart)}周</span>
            <span>${weekRange(r.weekStart)}</span>
            ${r.category ? `<span class="chip soft-primary">${esc(r.category)}</span>` : ''}
            <span>·</span>
            <span>📝 ${fmtChars(r.chars)}</span>
            <span>·</span>
            <span>${dateTime(r.createdAt)}</span>
            ${r.status === 'draft' ? '<span class="chip soft-warn">草稿</span>' : ''}
          </div>
          <h1>${esc(r.title)} <span class="chip" style="vertical-align:middle;font-weight:500">#${r.id}</span></h1>
          ${
            r.tags && r.tags.length
              ? `<div class="taglist">${r.tags.map((t) => `<span class="chip soft-primary">#${esc(t)}</span>`).join('')}</div>`
              : ''
          }
        </div>

        <div class="prose article-prose">${htmlBody}</div>

        ${atts ? `<div class="attach-list">${atts}</div>` : ''}

        <div class="action-bar">
          <button class="btn ${r.liked ? 'liked' : ''}" id="like-btn">♥ <span id="like-n">${r.likes}</span></button>
          <span style="color:var(--muted);font-size:12.5px">${r.comments} 条评论</span>
          <div style="flex:1"></div>
          ${
            r.canEdit
              ? `<a class="btn sm" href="#/report/${r.id}/edit">编辑</a>
                 <button class="btn sm danger" id="del-btn">删除</button>`
              : ''
          }
        </div>
      </div>
      ${toc}
      </div>

      <div class="card pad comments" id="comments-card"><a id="comments"></a>
        <div class="card-title">评论 <span class="count-pill" id="c-count"></span></div>
        <div id="comment-list"><div class="empty" style="padding:20px">加载中…</div></div>
        <div class="comment-form">
          ${userAvatar(state.user, 'sm')}
          <div class="grow">
            <div id="reply-hint"></div>
            <textarea class="textarea" id="c-input" placeholder="写下你的建议或鼓励…（支持 @昵称）"></textarea>
            <div style="display:flex;justify-content:flex-end;margin-top:8px">
              <button class="btn primary sm" id="c-submit">发表评论</button>
            </div>
          </div>
        </div>
      </div>`;

    // 炫酷阅读交互：目录跳转 / 锚点 / 阅读进度条
    view.querySelectorAll('[data-toc], [data-anchor]').forEach((el) => {
      el.onclick = (e) => {
        e.preventDefault();
        const id = el.dataset.toc || el.dataset.anchor;
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          target.classList.add('flash-target');
          setTimeout(() => target.classList.remove('flash-target'), 1200);
        }
      };
    });
    const progress = $('#read-progress');
    const tocLinks = [...view.querySelectorAll('.toc-link')];
    if (progress || tocLinks.length) {
      const updateProgress = () => {
        if (progress) {
          const h = document.documentElement;
          const max = h.scrollHeight - h.clientHeight;
          const pct = max > 0 ? Math.min(100, Math.round((h.scrollTop / max) * 100)) : 100;
          progress.style.width = pct + '%';
        }
        // 目录滚动高亮：取最后一个已滚过顶部的标题
        if (tocLinks.length) {
          let current = tocLinks[0];
          for (const link of tocLinks) {
            const el = document.getElementById(link.dataset.toc);
            if (el && el.getBoundingClientRect().top <= 120) current = link;
          }
          tocLinks.forEach((l) => l.classList.toggle('active', l === current));
        }
      };
      window.addEventListener('scroll', updateProgress, { passive: true });
      updateProgress();
    }

    $('#like-btn').onclick = async () => {
      const res = await api.post(`/reports/${r.id}/like`);
      $('#like-n').textContent = res.likes;
      $('#like-btn').classList.toggle('liked', res.liked);
    };

    const delBtn = $('#del-btn');
    if (delBtn) {
      delBtn.onclick = async () => {
        const ok = await confirmDialog({
          title: '删除这篇周报？',
          message: '删除后不可恢复，评论与附件会一并清除。',
          okText: '删除',
          danger: true
        });
        if (!ok) return;
        await api.del('/reports/' + r.id);
        toast('已删除', 'success');
        location.hash = '#/mine';
      };
    }

    await loadComments('report', r.id, $('#comment-list'), $('#c-input'), $('#c-submit'), $('#reply-hint'));
  }

  /* ================= 通用评论区 ================= */
  function commentHtml(c, target) {
    const a = c.author || { displayName: '已注销用户' };
    return `<div class="comment" data-cid="${c.id}">
      ${userAvatar(a, 'sm')}
      <div class="cbody">
        <div class="chead">
          <span class="name">${esc(a.displayName)}</span>
          <span class="time">${timeAgo(c.createdAt)}</span>
        </div>
        <div class="ctext">${md(c.content)}</div>
        <div class="cacts">
          <button data-act="like" class="${c.liked ? 'liked' : ''}">♥ ${c.likes || ''}</button>
          <button data-act="reply">回复</button>
          ${(state.user && (c.author && c.author.id === state.user.id || state.user.role === 'admin')) ? '<button data-act="del">删除</button>' : ''}
        </div>
        ${
          c.children && c.children.length
            ? `<div class="replies">${c.children.map((ch) => commentHtml(ch, target)).join('')}</div>`
            : ''
        }
      </div>
    </div>`;
  }

  async function loadComments(targetType, targetId, listEl, inputEl, submitEl, hintEl) {
    const base = targetType === 'report' ? `/reports/${targetId}` : `/posts/${targetId}`;
    const render = async () => {
      const data = await api.get(base + '/comments');
      const cnt = document.getElementById('c-count');
      if (cnt) cnt.textContent = (data.items || []).length ? `${data.items.length} 条` : '';
      listEl.innerHTML =
        data.items.map((c) => commentHtml(c, targetType)).join('') ||
        emptyState('💬', '还没有评论，来说两句');
      bind();
    };

    const bind = () => {
      listEl.querySelectorAll('.comment').forEach((node) => {
        const cid = Number(node.dataset.cid);
        node.querySelectorAll(':scope > .cbody > .cacts button').forEach((btn) => {
          btn.onclick = async () => {
            const act = btn.dataset.act;
            if (act === 'like') {
              const res = await api.post(`/comments/${cid}/like`);
              btn.classList.toggle('liked', res.liked);
              btn.textContent = '♥ ' + (res.likes || '');
            } else if (act === 'reply') {
              state.pendingReply = { id: cid, name: node.querySelector('.name').textContent };
              hintEl.innerHTML = `<div class="reply-hint">回复 @${esc(state.pendingReply.name)} · <button class="btn sm ghost" id="cancel-reply" type="button">取消</button></div>`;
              $('#cancel-reply').onclick = () => {
                state.pendingReply = null;
                hintEl.innerHTML = '';
              };
              inputEl.focus();
              inputEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
            } else if (act === 'del') {
              const ok = await confirmDialog({ title: '删除这条评论？', message: '删除后不可恢复。', okText: '删除', danger: true });
              if (!ok) return;
              await api.del(`/comments/${cid}`);
              render();
            }
          };
        });
      });
    };

    submitEl.onclick = async () => {
      const content = inputEl.value.trim();
      if (!content) return toast('评论不能为空', 'error');
      submitEl.disabled = true;
      try {
        await api.post(base + '/comments', {
          content,
          parentId: state.pendingReply ? state.pendingReply.id : null
        });
        inputEl.value = '';
        state.pendingReply = null;
        hintEl.innerHTML = '';
        await render();
        toast('评论已发布', 'success');
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        submitEl.disabled = false;
      }
    };

    await render();
  }

  /* ================= 周报编辑器 ================= */
  async function viewEditor(view, id, presetWeek) {
    const isEdit = !!id;
    let report = null;
    if (isEdit) {
      const d = await api.get('/reports/' + id);
      report = d.report;
      if (!report.canEdit) {
        view.innerHTML = emptyState('🔒', '你无权编辑这篇周报');
        return;
      }
    }
    const mineList = await api.get('/reports?scope=mine&limit=120');
    const [groupData, tagData] = await Promise.all([
      api.get('/report-groups').catch(() => ({ items: [] })),
      api.get('/reports/tags').catch(() => ({ items: [] }))
    ]);
    const groupList = (groupData.items || []).map((g) => g.name);
    if (groupList.length) state.site.reportGroups = groupList;
    const tagPicks = (tagData.items || []).slice(0, 30).map((t) => t.tag);
    const weekCount = {};
    mineList.items.forEach((r) => {
      weekCount[r.weekStart] = (weekCount[r.weekStart] || 0) + 1;
    });

    setTitle(isEdit ? '编辑周报' : '写周报');
    // 从学期第 1 周到本周，全部列出；已提交的标记出来，点击直接去编辑
    const termStart = termStartDate();
    const curWeek = weekStartOfDate(new Date());
    const weeks = [];
    {
      let ws = termStart;
      let guard = 0;
      while (ws <= curWeek && guard < 200) {
        weeks.push(ws);
        const d = new Date(ws + 'T00:00:00');
        d.setDate(d.getDate() + 7);
        ws = dateStr(d);
        guard += 1;
      }
    }
    const current = (report && report.weekStart) || (presetWeek || curWeek);

    // 一周可以写多篇：这里只统计各周已有几篇，不做“已提交就跳转”的限制
    if (!weeks.length) {
      view.innerHTML = emptyState('🎉', '周次设置有误（起始周晚于本周），请联系管理员调整');
      return;
    }

    view.innerHTML = `
      <section class="editor-workspace" id="editor-workspace">
        <!-- 顶栏：标题 + 保存 -->
        <header class="ew-topbar">
          <div class="ew-title">
            <h2>${isEdit ? '编辑周报' : '写周报'}</h2>
            <span class="ew-week">${weekNumber(current)} 周</span>
          </div>
          <div class="ew-actions">
            <span class="ew-save-state" id="ew-save-state">Markdown 编辑中</span>
            <a class="btn ghost sm" href="#/mine">取消</a>
            <button class="btn sm" id="save-draft">存草稿</button>
            <button class="btn primary sm" id="save-submit">提交周报</button>
          </div>
        </header>

        <!-- 紧凑元信息：第一行标题/周次/分组，第二行总结/标签，高级设置折叠 -->
        <div class="ew-meta">
          <div class="ew-meta-row">
            <div class="ew-field ew-grow">
              <label for="f-title">标题</label>
              <input class="input" id="f-title" maxlength="80" placeholder="例如：把 Transformer 的注意力机制彻底搞懂了" value="${esc(report ? report.title : '')}" />
            </div>
            <div class="ew-field" style="min-width:150px">
              <label>${isEdit ? '周次' : '周报周期'}</label>
              ${
                isEdit
                  ? `<div class="ew-static">第${weekNumber(report.weekStart)}周 · ${weekRange(report.weekStart)}</div>`
                  : `<select class="select" id="ew-week-select">
                       ${weeks.map((w) => `<option value="${w}" ${w === current ? 'selected' : ''}>第${weekNumber(w)}周${w === curWeek ? ' · 本周' : ''}${(weekCount[w] || 0) ? ` · 已有${weekCount[w]}篇` : ''}</option>`).join('')}
                     </select>`
              }
            </div>
            <div class="ew-field" style="min-width:150px">
              <label for="f-cat">方向分组</label>
              <select class="select" id="f-cat">
                <option value="">不分组</option>
                ${groupList.map((g) => `<option value="${esc(g)}" ${report && report.category === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
                <option value="__new__">＋ 新建分组…</option>
              </select>
            </div>
          </div>
          <div class="ew-meta-row">
            <div class="ew-field ew-grow">
              <label for="f-summary">一句话总结</label>
              <input class="input" id="f-summary" maxlength="120" placeholder="用一句话概括这周的收获" value="${esc(report ? report.summary : '')}" />
            </div>
            <div class="ew-field ew-grow" id="tags-field">
              <label>标签</label>
              ${tagPickerHtml(tagPicks, report && report.tags ? report.tags : [], true)}
            </div>
          </div>
          <details class="ew-advanced">
            <summary>高级设置（日期 / 周次详情 / 附件）</summary>
            <div class="ew-advanced-body">
              ${
                isEdit
                  ? `<div class="ew-field"><label>周次</label><div class="chip soft-primary">第${weekNumber(report.weekStart)}周 · ${weekRange(report.weekStart)}</div></div>`
                  : `<div class="ew-field">
                       <label>周次快捷选择</label>
                       <div class="week-options" id="week-options">
                         ${weeks.map((w) => {
                           const n = weekCount[w] || 0;
                           return `<button type="button" class="week-opt ${w === current ? 'active' : ''} ${n ? 'taken' : ''}" data-week="${w}">
                             <div>第 ${weekNumber(w)} 周${w === curWeek ? ' · 本周' : ''}${n ? ` · 已有 ${n} 篇` : ''}</div><div class="d">${weekRange(w)}</div>
                           </button>`;
                         }).join('')}
                       </div>
                     </div>`
              }
              <div class="ew-field">
                <label for="week-date">任选日期（自动对齐到所在周）</label>
                <input type="date" class="input" id="week-date" style="max-width:200px" value="${current}" />
              </div>
              <div class="ew-field">
                <label>附件${isEdit ? '' : '（提交后可选）'}</label>
                ${isEdit ? '<div id="att-list" class="attach-list"></div>' : ''}
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                  <input type="file" id="att-input" multiple />
                  ${isEdit ? '<button class="btn sm" id="att-upload">上传</button>' : ''}
                  <span class="hint">支持 pdf / 图片 / 文档 / zip，单个不超过 10MB</span>
                </div>
              </div>
            </div>
          </details>
        </div>

        <!-- 精简工具栏：常用 9 项 + 帮助 + 右侧模式切换 -->
        <!-- Obsidian 风格编辑器头部 -->
        <div class="ob-head">
          <!-- 第一行：文件名 + 模式切换 | 导入/导出/全屏 -->
          <div class="ob-row ob-row-1">
            <div class="ob-file">
              <span class="ob-file-icon">&lt;/&gt;</span>
              <span class="ob-file-name" id="ob-file-name">weekly-report.md</span>
              <span class="ob-save-state" id="ew-save-state">未保存</span>
            </div>
            <div class="ob-actions">
              <button type="button" class="ob-btn" id="ob-import" title="导入 .md / .markdown 文件">📥 导入 Markdown</button>
              <button type="button" class="ob-btn" id="ob-export" title="将正文导出为 .md">📤 导出 Markdown</button>
              <button type="button" class="ob-btn ob-icon" id="ew-fullscreen" title="全屏编辑（Esc 退出）">⛶</button>
            </div>
          </div>

          <!-- 模式切换 + 灰色说明 -->
          <div class="ob-row ob-row-mode">
            <div class="ob-mode-switch" role="group" aria-label="编辑模式">
              <button type="button" class="ob-mode-btn active" data-ed-mode="markdown" title="Markdown 源码编辑">
                <span class="ob-mode-icon">&lt;/&gt;</span> Markdown
                <span class="ob-badge">推荐</span>
              </button>
              <button type="button" class="ob-mode-btn" data-ed-mode="rich" title="所见即所得富文本">富文本</button>
            </div>
            <div class="ob-view-switch" role="group" aria-label="视图模式">
              <button type="button" data-ws-mode="edit" class="active" title="编辑">编辑</button>
              <button type="button" data-ws-mode="preview" title="阅读预览（Ctrl+E）">阅读预览</button>
            </div>
            <p class="ob-hint ob-hint-inline" id="ob-mode-hint">强烈推荐用 Markdown 编写：代码块、表格、公式、Mermaid 都能正常渲染，也可直接导入 .md。Ctrl + E 进预览，再按一次回到源码。</p>
            <button type="button" class="ob-btn ob-help-btn" id="ew-help" title="Markdown 使用说明">
              <span class="ob-q">?</span> 使用说明
            </button>
          </div>

          <!-- 第三行：格式工具栏 -->
          <div class="ob-toolbar" role="toolbar" aria-label="Markdown 格式工具栏">
            <button type="button" data-md="h1" class="ob-tb" title="H1 一级标题">H1</button>
            <button type="button" data-md="h2" class="ob-tb" title="H2 二级标题">H2</button>
            <button type="button" data-md="bold" class="ob-tb" title="粗体（Ctrl+B）"><b>B</b></button>
            <button type="button" data-md="italic" class="ob-tb" title="斜体（Ctrl+I）"><i>I</i></button>
            <button type="button" data-md="list" class="ob-tb" title="无序列表">☰</button>
            <button type="button" data-md="code" class="ob-tb" title="代码块">&lt;/&gt;</button>
            <button type="button" data-md="link" class="ob-tb" title="插入链接（Ctrl+K）">🔗</button>
            <button type="button" data-md="img" class="ob-tb" title="插入图片">🖼</button>
            <button type="button" data-md="more" class="ob-tb" title="更多 Markdown 语法">⋯</button>
            <span class="ob-toolbar-hint">输入 # 创建标题，输入 - 创建列表，使用 \`\`\` 插入代码块</span>
          </div>
        </div>

        <!-- 工作区主体：编辑 / 分屏 / 阅读预览 -->
        <div class="ew-body" id="ew-body">
          <div class="ew-pane ew-editor-pane" id="ew-editor-pane">
            <div class="ob-empty-hint" id="ob-empty-hint">
              从这里开始编写周报……支持 Markdown 语法。按 <kbd>Ctrl</kbd>+<kbd>E</kbd> 进入预览，再按一次回到源码编辑。
              <div class="ob-empty-sub">输入 # 创建标题，输入 - 创建列表，使用 \`\`\` 创建代码块</div>
            </div>
            <textarea class="textarea" id="f-content" placeholder="">${esc(report ? report.content : '')}</textarea>
            <div class="ob-preview-hint" id="ob-preview-hint" hidden>正在显示 Markdown 渲染结果，按 <kbd>Ctrl</kbd>+<kbd>E</kbd> 返回编辑。</div>
          </div>
          <div class="ew-pane ew-preview-pane" id="ew-preview-pane" hidden>
            <div class="prose md-preview-body" id="md-preview-body"></div>
          </div>
        </div>
        <div class="ew-resize" id="ew-resize" title="拖动向下拉，放大编辑/预览区（双击复位）">
          <span class="ew-resize-tip" id="ew-resize-tip"></span>
        </div>
      </section>`;

    let weekStart = current;
    const contentEl = $('#f-content');
    let composerRef = null;
    const editor = window.RichMarkdownEditor(contentEl, {
      placeholder: '用 Markdown 记录本周的学习记录…支持 # 标题、**粗体**、``` 代码块、[[Obsidian 双链]] 等语法',
      uploadImage: uploadImageFile,
      onError: (m) => toast(m, 'error'),
      onNotice: (m) => toast(m, 'success'),
      onChange: () => {
        if (composerRef) composerRef.refreshHint();
      },
      onModeChange: (mode) => {
        if (mode === 'source') autoGrow(contentEl);
      }
    });
    composerRef = markdownComposer(contentEl, editor);
    bindMarkdownToolbar(contentEl, composerRef, editor);
    const ws = setupEditorWorkspace(contentEl, editor);
    // 富文本输入后会 flush 到 textarea；这里监听 input 同步预览（工作区内部已绑，富文本额外补一个）
    if (editor && editor.el) {
      const syncPreview = () => ws.render();
      editor.el.addEventListener('input', syncPreview);
    }
    bindObsidianHead(editor, composerRef, contentEl, ws);

    // 方向分组：支持在写周报时直接新建
    const catSel = $('#f-cat');
    if (catSel) {
      catSel.onchange = async () => {
        if (catSel.value !== '__new__') return;
        const name = await promptDialog({
          title: '新建方向分组',
          label: '分组名称',
          placeholder: '例如：算法、渗透测试、CTF 杂项',
          maxlength: 12,
          hint: '2-12 个字，建好后会出现在所有人的分组下拉里'
        });
        if (!name) {
          catSel.value = report && report.category ? report.category : '';
          return;
        }
        try {
          const { group } = await api.post('/report-groups', { name });
          state.site.reportGroups = [...new Set([...(state.site.reportGroups || []), group.name])];
          const opt = document.createElement('option');
          opt.value = group.name;
          opt.textContent = group.name;
          catSel.insertBefore(opt, catSel.querySelector('option[value="__new__"]'));
          catSel.value = group.name;
          toast('分组已创建', 'success');
        } catch (e) {
          toast(e.message, 'error');
          catSel.value = report && report.category ? report.category : '';
        }
      };
    }

    // 标签：既有标签点选，也能输入新标签
    const tagField = document.getElementById('tags-field');
    const tagPicker = bindTagPicker(tagField, (report && report.tags) || []);

    document.querySelectorAll('#week-options .week-opt').forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll('#week-options .week-opt').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        weekStart = b.dataset.week;
        const di = $('#week-date');
        if (di) di.value = weekStart;
      };
    });

    const dateInput = $('#week-date');
    if (dateInput) {
      dateInput.onchange = () => {
        const v = dateInput.value;
        if (!v) return;
        const ws = weekStartOfDate(new Date(v + 'T00:00:00'));
        weekStart = ws;
        dateInput.value = ws;
        document.querySelectorAll('#week-options .week-opt').forEach((x) => {
          x.classList.toggle('active', x.dataset.week === ws);
        });
      };
    }



    const ewWeekSel = $('#ew-week-select');
    if (ewWeekSel) {
      ewWeekSel.onchange = () => {
        weekStart = ewWeekSel.value;
        const di = $('#week-date');
        if (di) di.value = weekStart;
        const topWeek = document.querySelector('.ew-week');
        if (topWeek) topWeek.textContent = weekNumber(weekStart) + ' 周';
      };
    }

    const collect = (status) => ({
      weekStart,
      title: $('#f-title').value.trim(),
      summary: $('#f-summary').value.trim(),
      tags: tagPicker.get().join(','),
      category: $('#f-cat') ? $('#f-cat').value : '',
      content: editor.getValue(),
      status
    });

    const save = async (status) => {
      const payload = collect(status);
      if (payload.title.length < 2) return toast('请填写标题（至少 2 个字）', 'error');
      if (status === 'submitted' && payload.content.trim().length < 10)
        return toast('正文至少 10 个字才能提交', 'error');
      try {
        let saved;
        if (isEdit) saved = (await api.put('/reports/' + id, payload)).report;
        else saved = (await api.post('/reports', payload)).report;

        const fileInput = $('#att-input');
        if (fileInput && fileInput.files && fileInput.files.length) {
          const fd = new FormData();
          for (const f of fileInput.files) fd.append('files', f);
          await api.upload(`/reports/${saved.id}/attachments`, fd).catch((e) => toast('附件上传失败：' + e.message, 'error'));
        }
        toast(status === 'draft' ? '草稿已保存' : '周报已提交 🎉', 'success');
        location.hash = '#/report/' + saved.id;
      } catch (e) {
        toast(e.message, 'error');
      }
    };

    $('#save-draft').onclick = () => save('draft');
    $('#save-submit').onclick = () => save('submitted');

    if (isEdit) {
      const attWrap = $('#att-list');
      const loadAtts = async () => {
        const d = await api.get('/reports/' + id);
        const items = d.report.attachments || [];
        attWrap.innerHTML =
          items
            .map(
              (a) => `<span class="attach">📎 <a href="/api/attachments/${a.id}" target="_blank" rel="noopener">${esc(a.filename)}</a>
                <span class="x" data-aid="${a.id}" title="删除">×</span></span>`
            )
            .join('') || '<span style="color:var(--muted);font-size:12.5px">暂无附件</span>';
        attWrap.querySelectorAll('.x').forEach((x) => {
          x.onclick = async () => {
            const ok = await confirmDialog({ title: '删除该附件？', message: '删除后不可恢复。', okText: '删除', danger: true });
            if (!ok) return;
            await api.del(`/reports/${id}/attachments/${x.dataset.aid}`);
            loadAtts();
          };
        });
      };
      loadAtts();
      $('#att-upload').onclick = async () => {
        const fi = $('#att-input');
        if (!fi.files.length) return toast('请先选择文件', 'error');
        const fd = new FormData();
        for (const f of fi.files) fd.append('files', f);
        try {
          await api.upload(`/reports/${id}/attachments`, fd);
          fi.value = '';
          await loadAtts();
          toast('上传成功', 'success');
        } catch (e) {
          toast(e.message, 'error');
        }
      };
    }
  }

  /* ================= 私信 ================= */
  async function pickUserModal() {
    return new Promise((resolve) => {
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal" style="max-width:420px">
            <h3>发起私信</h3>
            <div class="field"><input class="input" id="u-search" placeholder="搜索用户名 / 姓名…" /></div>
            <div id="u-list" style="max-height:260px;overflow-y:auto"></div>
            <div class="acts"><button class="btn" data-act="cancel">取消</button></div>
          </div>
        </div>`;
      const close = (v) => {
        root.innerHTML = '';
        resolve(v);
      };
      const render = async (q) => {
        const d = await api.get('/users?q=' + encodeURIComponent(q || ''));
        const list = d.items.filter((u) => u.id !== state.user.id);
        $('#u-list').innerHTML =
          list
            .map(
              (u) => `<div class="setting-row" data-uid="${u.id}" style="cursor:pointer;padding:10px 0">
                ${userAvatar(u, 'sm')}
                <div><b style="font-size:13px">${esc(u.displayName)}</b>
                <div style="font-size:11.5px;color:var(--muted)">@${esc(u.username)}</div></div>
              </div>`
            )
            .join('') || '<div class="empty" style="padding:20px">没有找到用户</div>';
        root.querySelectorAll('[data-uid]').forEach((r) => {
          r.onclick = () => close(Number(r.dataset.uid));
        });
      };
      $('#u-search').oninput = (e) => render(e.target.value.trim());
      root.querySelector('[data-act="cancel"]').onclick = () => close(null);
      render('');
    });
  }

  async function viewMessages(view, peerId) {
    setTitle('私信');
    const conv = await api.get('/messages/conversations');
    const list = conv.items;
    let activeId = peerId ? Number(peerId) : list[0] ? list[0].peer.id : null;

    let peer = null;
    let items = [];
    if (activeId) {
      const t = await api.get('/messages/' + activeId);
      peer = t.peer;
      items = t.items;
    }

    const bubble = (m) => `
      <div class="bubble-row ${m.fromMe ? 'mine' : ''}">
        ${m.fromMe ? '' : userAvatar(peer, 'sm')}
        <div class="bubble">
          <div class="btext">${md(m.content)}</div>
          <div class="btime">${dateTime(m.createdAt)}</div>
        </div>
      </div>`;

    view.innerHTML = `
      <div class="page-head">
        <div><h2>私信</h2><p>和组内同学一对一沟通</p></div>
        <div class="spacer"></div>
        <button class="btn" id="new-msg">＋ 发起私信</button>
      </div>
      <div class="msg-wrap">
        <aside class="card msg-list">
          ${
            list.length
              ? list
                  .map(
                    (c) => `<a class="msg-item ${activeId === c.peer.id ? 'active' : ''}" href="#/messages/${c.peer.id}">
                      ${userAvatar(c.peer, 'sm')}
                      <div class="minfo">
                        <div class="mtop"><span class="mname">${esc(c.peer.displayName)}</span>
                          <span class="mtime">${timeAgo(c.lastAt)}</span></div>
                        <div class="mlast">${c.lastFromMe ? '<span style="color:var(--muted)">我：</span>' : ''}${esc(c.lastMessage)}</div>
                      </div>
                      ${c.unread ? `<span class="nav-badge" style="position:static">${c.unread}</span>` : ''}
                    </a>`
                  )
                  .join('')
              : emptyState('✉️', '还没有私信，点右上角发起')
          }
        </aside>

        <section class="card chat">
          ${
            activeId && peer
              ? `<div class="chat-head">
                   ${userAvatar(peer)}
                   <div>
                     <div style="font-weight:600">${esc(peer.displayName)}</div>
                     <div style="font-size:11.5px;color:var(--muted)">@${esc(peer.username)}${peer.studentId ? ' · 学号 ' + esc(peer.studentId) : ''}</div>
                   </div>
                 </div>
                 <div class="chat-body" id="chat-body">
                   ${items.map(bubble).join('') || '<div class="empty" style="padding:40px">开始你们的对话吧</div>'}
                 </div>
                 <div class="chat-input">
                   <textarea class="textarea" id="msg-input" placeholder="输入消息，Enter 发送 / Shift+Enter 换行"></textarea>
                   <button class="btn primary" id="msg-send">发送</button>
                 </div>`
              : `<div class="empty" style="padding:80px 20px"><span class="icon">💬</span>选择左侧会话，或发起一段新的私信</div>`
          }
        </section>
      </div>`;

    $('#new-msg').onclick = async () => {
      const uid2 = await pickUserModal();
      if (uid2) location.hash = '#/messages/' + uid2;
    };

    if (!activeId || !peer) return;

    const body = $('#chat-body');
    body.scrollTop = body.scrollHeight;

    const reload = async (force = false) => {
      try {
        const t = await api.get('/messages/' + activeId);
        const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 60;
        body.innerHTML = t.items.map(bubble).join('') || '<div class="empty" style="padding:40px">开始你们的对话吧</div>';
        if (nearBottom || force) body.scrollTop = body.scrollHeight;
        refreshUnread();
      } catch (e) {
        /* 忽略轮询错误 */
      }
    };

    const send = async () => {
      const input = $('#msg-input');
      const content = input.value.trim();
      if (!content) return;
      try {
        await api.post('/messages/' + activeId, { content });
        input.value = '';
        await reload(true);
      } catch (e) {
        toast(e.message, 'error');
      }
    };

    $('#msg-send').onclick = send;
    $('#msg-input').onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    };
    $('#msg-input').focus();

    // 5 秒轮询新消息（离开页面时由 navigate 清理）
    state.chatTimer = setInterval(reload, 5000);
  }

  /* ================= 论坛列表 ================= */
  async function viewForum(view, query) {
    setTitle('论坛');
    const cat = query.get('cat') || '';
    const sort = query.get('sort') || 'new';
    const q = query.get('q') || '';
    let url = `/posts?limit=20&sort=${sort}`;
    if (cat) url += `&category=${cat}`;
    if (q) url += `&q=${encodeURIComponent(q)}`;
    const data = await api.get(url);

    const tabs = [
      ['', '全部'],
      ['ask', '提问求助'],
      ['share', '经验分享'],
      ['checkin', '学习打卡'],
      ['chat', '闲聊灌水']
    ];

    view.innerHTML = `
      <div class="page-head">
        <div><h2>论坛</h2><p>提问、分享、打卡，和同伴一起成长</p></div>
        <div class="spacer"></div>
        <a class="btn primary" href="#/post/new">＋ 发布帖子</a>
      </div>

      <div class="toolbar">
        <div class="tabs">
          ${tabs
            .map(
              ([k, label]) =>
                `<button class="tab ${cat === k ? 'active' : ''}" data-cat="${k}">${label}${
                  k ? `<span class="n">${data.counts[k] || 0}</span>` : ''
                }</button>`
            )
            .join('')}
        </div>
        <div class="search-box">${ICONS.search}<input class="input" id="pq" placeholder="搜索帖子…" value="${esc(q)}" /></div>
        <select class="select" id="psort" style="max-width:130px">
          <option value="new" ${sort === 'new' ? 'selected' : ''}>最新发布</option>
          <option value="hot" ${sort === 'hot' ? 'selected' : ''}>最多浏览</option>
          <option value="unanswered" ${sort === 'unanswered' ? 'selected' : ''}>等待回复</option>
        </select>
      </div>

      <div class="card">
        ${
          data.items
            .map(
              (p) => `<a class="post-row" href="#/post/${p.id}">
                ${userAvatar(p.author)}
                <div class="body">
                  <h3>
                    ${p.isPinned ? '<span class="chip soft-danger">置顶</span>' : ''}
                    <span style="background:${(CATS[p.category] || {}).bg || '#eee'};color:${(CATS[p.category] || {}).color || '#333'};padding:1px 7px;border-radius:5px;font-size:11.5px;font-weight:600">${esc((CATS[p.category] || {}).label || p.category)}</span>
                    <span>${esc(p.title)}</span>
                    ${p.isLocked ? '<span class="chip">已锁定</span>' : ''}
                  </h3>
                  <div class="meta">
                    <span>${esc(p.author ? p.author.displayName : '未知')}</span>
                    <span>· ${timeAgo(p.createdAt)}</span>
                  </div>
                </div>
                <div class="counts">
                  <span class="count-pill">♥ ${p.likes}</span>
                  <span class="count-pill">💬 ${p.comments}</span>
                  <span class="count-pill" style="opacity:.7">👁 ${p.views}</span>
                </div>
              </a>`
            )
            .join('') || emptyState('💬', '这里还很安静，来发第一帖吧')
        }
      </div>`;

    const go = (patch) => {
      const params = new URLSearchParams({ cat, sort, q });
      Object.entries(patch).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
      location.hash = '#/forum?' + params.toString();
    };
    document.querySelectorAll('.tab').forEach((t) => {
      t.onclick = () => go({ cat: t.dataset.cat });
    });
    $('#psort').onchange = (e) => go({ sort: e.target.value });
    $('#pq').onkeydown = (e) => {
      if (e.key === 'Enter') go({ q: e.target.value.trim() });
    };
  }

  /* ================= 发帖 ================= */
  async function viewPostEditor(view, id) {
    const isEdit = !!id;
    let post = null;
    if (isEdit) {
      const d = await api.get('/posts/' + id);
      post = d.post;
      if (!post.canEdit) {
        view.innerHTML = emptyState('🔒', '你无权编辑这个帖子');
        return;
      }
    }
    setTitle(isEdit ? '编辑帖子' : '发布帖子');
    let category = post ? post.category : 'ask';

    view.innerHTML = `
      <div class="page-head">
        <div><h2>${isEdit ? '编辑帖子' : '发布帖子'}</h2><p>支持 Markdown：可插入图片、导入 .md 文件，发布后随时回来二次编辑</p></div>
        <div class="spacer"></div>
        <a class="btn ghost" href="${isEdit ? '#/post/' + post.id : '#/forum'}">取消</a>
        <button class="btn primary" id="p-submit">${isEdit ? '保存修改' : '发布'}</button>
      </div>
      <div class="card pad">
        <div class="field">
          <label>板块</label>
          <div class="tabs" style="display:inline-flex">
            ${Object.entries(CATS)
              .map(
                ([k, v]) =>
                  `<button class="tab ${k === category ? 'active' : ''}" data-pcat="${k}">${v.label}</button>`
              )
              .join('')}
          </div>
        </div>
        <div class="field">
          <label for="p-title">标题</label>
          <input class="input" id="p-title" maxlength="80" placeholder="一句话说清你的问题 / 分享主题" value="${esc(post ? post.title : '')}" />
        </div>
      </div>
      <div class="editor-grid" style="margin-top:16px">
        <div class="card pad">
          <div class="md-toolbar">
            <button type="button" data-md="h1">H1</button><button type="button" data-md="h2">H2</button><button type="button" data-md="h3">H3</button><button type="button" data-md="h4">H4</button>
            <button type="button" data-md="bold"><b>B</b></button>
            <button type="button" data-md="italic"><i>I</i></button>
            <button type="button" data-md="list">• 列表</button>
            <button type="button" data-md="quote">❝ 引用</button>
            <button type="button" data-md="table">▦ 表格</button>
            <button type="button" data-md="code">&lt;/&gt;</button>
            <button type="button" data-md="img">🖼 插入图片</button>
            <button type="button" data-md="import">📄 导入 MD / 图片</button>
            <button type="button" data-md="focus">⛶ 全屏</button>
          </div>
          <textarea class="textarea" id="p-content" placeholder="背景、你尝试过什么、期望得到什么帮助…">${esc(post ? post.content : '')}</textarea>
          <div class="hint">可以用 @用户名 提醒同事；默认所见即所得，点「源码」看 / 改 Markdown；图片支持粘贴 / 拖拽上传</div>
        </div>
      </div>`;

    document.querySelectorAll('[data-pcat]').forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll('[data-pcat]').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        category = b.dataset.pcat;
      };
    });

    const contentEl = $('#p-content');
    let composerRef = null;
    const editor = window.RichMarkdownEditor(contentEl, {
      placeholder: '背景、你尝试过什么、期望得到什么帮助…',
      uploadImage: uploadImageFile,
      onError: (m) => toast(m, 'error'),
      onNotice: (m) => toast(m, 'success'),
      onChange: () => {
        if (composerRef) composerRef.refreshHint();
      },
      onModeChange: (mode) => {
        if (mode === 'source') autoGrow(contentEl);
      }
    });
    composerRef = markdownComposer(contentEl, editor);
    bindMarkdownToolbar(contentEl, composerRef, editor);

    $('#p-submit').onclick = async () => {
      const title = $('#p-title').value.trim();
      const content = editor.getValue().trim();
      if (title.length < 4) return toast('标题至少 4 个字', 'error');
      if (content.length < 5) return toast('正文至少 5 个字', 'error');
      try {
        const payload = { title, content, category };
        const { post: saved } = isEdit
          ? await api.put('/posts/' + id, payload)
          : await api.post('/posts', payload);
        toast(isEdit ? '修改已保存' : '发布成功', 'success');
        location.hash = '#/post/' + saved.id;
      } catch (e) {
        toast(e.message, 'error');
      }
    };
  }

  /* ================= 帖子详情 ================= */
  async function viewPostDetail(view, id) {
    const { post: p } = await api.get('/posts/' + id);
    setTitle(p.title);
    const cat = CATS[p.category] || { label: p.category, bg: '#eee', color: '#333' };

    view.innerHTML = `
      <div style="margin-bottom:6px"><a href="#/forum" style="font-size:13px;color:var(--muted)">← 返回论坛</a></div>
      <div class="card pad">
        <div class="detail-head">
          <div class="detail-meta">
            <span style="background:${cat.bg};color:${cat.color};padding:2px 8px;border-radius:5px;font-size:11.5px;font-weight:600">${esc(cat.label)}</span>
            ${p.isPinned ? '<span class="chip soft-danger">置顶</span>' : ''}
            ${p.isLocked ? '<span class="chip">已锁定</span>' : ''}
            <span>👁 ${p.views}</span>
          </div>
          <h1>${esc(p.title)}</h1>
          <div class="detail-meta">
            ${userAvatar(p.author, 'sm')}
            <span style="font-weight:600;color:var(--text)">${esc(p.author ? p.author.displayName : '未知')}</span>
            <span>${dateTime(p.createdAt)}</span>
          </div>
        </div>
        <div class="prose">${md(p.content)}</div>
        <div class="action-bar">
          <button class="btn ${p.liked ? 'liked' : ''}" id="plike">♥ <span id="plike-n">${p.likes}</span></button>
          <div style="flex:1"></div>
          ${
            state.user.role === 'admin'
              ? `<button class="btn sm" id="pin-btn">${p.isPinned ? '取消置顶' : '置顶'}</button>
                 <button class="btn sm" id="lock-btn">${p.isLocked ? '解锁' : '锁定'}</button>`
              : ''
          }
          ${p.canEdit ? `<a class="btn sm" href="#/post/${p.id}/edit">编辑</a>
                 <button class="btn sm danger" id="pdel">删除</button>` : ''}
        </div>
      </div>

      <div class="card pad comments">
        <div class="card-title">全部回复 <span class="chip">${p.comments}</span></div>
        <div id="comment-list"><div class="empty" style="padding:20px">加载中…</div></div>
        ${
          p.isLocked
            ? '<div class="empty" style="padding:16px">该帖已被锁定，暂时无法回复</div>'
            : `<div class="comment-form">
                 ${userAvatar(state.user, 'sm')}
                 <div class="grow">
                   <div id="reply-hint"></div>
                   <textarea class="textarea" id="c-input" placeholder="友善交流，写下你的看法…（支持 @昵称）"></textarea>
                   <div style="display:flex;justify-content:flex-end;margin-top:8px">
                     <button class="btn primary sm" id="c-submit">回复</button>
                   </div>
                 </div>
               </div>`
        }
      </div>`;

    $('#plike').onclick = async () => {
      const res = await api.post(`/posts/${p.id}/like`);
      $('#plike-n').textContent = res.likes;
      $('#plike').classList.toggle('liked', res.liked);
    };

    const pinBtn = $('#pin-btn');
    if (pinBtn) {
      pinBtn.onclick = async () => {
        await api.post(`/posts/${p.id}/moderate`, { isPinned: !p.isPinned });
        toast('已更新', 'success');
        navigate();
      };
      $('#lock-btn').onclick = async () => {
        await api.post(`/posts/${p.id}/moderate`, { isLocked: !p.isLocked });
        toast('已更新', 'success');
        navigate();
      };
    }

    const pdel = $('#pdel');
    if (pdel) {
      pdel.onclick = async () => {
        const ok = await confirmDialog({ title: '删除该帖子？', message: '帖子及其所有回复都会被删除。', okText: '删除', danger: true });
        if (!ok) return;
        await api.del('/posts/' + p.id);
        toast('已删除', 'success');
        location.hash = '#/forum';
      };
    }

    const listEl = $('#comment-list');
    await loadComments('post', p.id, listEl, $('#c-input'), $('#c-submit'), $('#reply-hint'));
  }

  /* ================= 通知 ================= */
  async function viewNotifications(view) {
    setTitle('通知');
    const data = await api.get('/notifications');
    const typeText = { comment: '评论', reply: '回复', like: '点赞', mention: '提及' };
    const items = data.items || [];

    view.innerHTML = `
      <div class="repo-head">
        <div class="repo-title"><b>通知</b><span class="chip">${data.unread} 条未读</span></div>
        <div class="repo-actions">
          <button class="btn sm" id="read-all">全部标为已读</button>
        </div>
      </div>

      <div class="page-tabs">
        <a class="tab active" href="#/notifications">全部通知</a>
        <a class="tab" href="#/dashboard">回首页</a>
      </div>

      <div class="Box">
        <div class="Box-header">最近 ${items.length} 条</div>
        ${
          items
            .map(
              (n) => `<a class="Box-row ${n.isRead ? '' : 'notif-unread'}" href="#/${
                n.targetType === 'post' ? 'post' : 'report'
              }/${n.targetId || ''}">
                <span class="issue-state ${n.isRead ? 'draft' : ''}" style="${n.isRead ? '' : 'background:var(--primary)'}">${
                n.isRead ? '' : '•'
              }</span>
                <div class="issue-main">
                  <div class="issue-title" style="font-weight:500;font-size:13.5px">
                    ${userAvatar(n.actor, 'sm')}
                    <b style="font-weight:600">${esc(n.actor ? n.actor.displayName : '系统')}</b>
                    <span style="color:var(--text-2)">${esc(n.message || typeText[n.type] || '有新动态')}</span>
                  </div>
                  <div class="issue-meta">
                    <span class="chip">${esc(typeText[n.type] || n.type)}</span>
                    <span>${timeAgo(n.createdAt)}</span>
                  </div>
                </div>
                <span class="issue-stats">查看 →</span>
              </a>`
            )
            .join('') || emptyState('🔔', '暂时没有通知')
        }
      </div>`;

    const readAll = $('#read-all');
    if (readAll) {
      readAll.onclick = async () => {
        await api.post('/notifications/read-all');
        await refreshUnread();
        navigate();
      };
    }
  }

  /* ================= 文章管理（管理员：快速编辑所有人的周报） ================= */
  async function viewArticles(view) {
    setTitle('文章管理');
    if (!state.user || state.user.role !== 'admin') {
      view.innerHTML = emptyState('🔒', '需要管理员权限');
      return;
    }
    const data = await api.get('/admin/reports?limit=100');
    view.innerHTML = `
      <div class="page-head">
        <div>
          <h2>文章管理</h2>
          <p>共 ${data.total} 篇周报，可直接快速编辑标题 / 简介 / 分组 / 标签</p>
        </div>
        <div class="spacer"></div>
        <button class="btn" id="repair-escapes" title="把旧内容行首的 \\# \\- 等转义去掉，让标题和列表重新渲染">修复旧内容转义</button>
        <a class="btn" href="#/admin">管理后台</a>
      </div>
      <div class="card">
        <table class="table">
          <thead><tr><th>标题</th><th>作者</th><th>周次</th><th>字数</th><th>提交时间</th><th></th></tr></thead>
          <tbody>
            ${
              data.items
                .map(
                  (r) => `<tr>
                    <td><a href="#/report/${r.id}">${esc(r.title)}</a>
                      ${r.status === 'draft' ? ' <span class="chip soft-warn">草稿</span>' : ''}</td>
                    <td>${esc(r.author.displayName)}<div style="font-size:11.5px;color:var(--muted)">@${esc(r.author.username)}</div></td>
                    <td style="white-space:nowrap">第${weekNumber(r.weekStart)}周<div style="font-size:11.5px;color:var(--muted)">${weekRange(r.weekStart)}</div></td>
                    <td>${fmtChars(r.chars)}</td>
                    <td style="color:var(--muted);white-space:nowrap">${timeAgo(r.createdAt)}</td>
                    <td style="text-align:right;white-space:nowrap">
                      <button class="btn sm" data-qe="${r.id}">快速编辑</button>
                      <button class="btn sm danger" data-del-article="${r.id}" data-title="${esc(r.title)}">删除</button>
                    </td>
                  </tr>`
                )
                .join('') || `<tr><td colspan="6"><div class="empty" style="padding:26px">还没有周报</div></td></tr>`
            }
          </tbody>
        </table>
      </div>`;

    bindQuickEdit(view);

    const repairBtn = view.querySelector('#repair-escapes');
    if (repairBtn) {
      repairBtn.onclick = async () => {
        const ok = await confirmDialog({
          title: '修复旧内容的转义？',
          message:
            '会扫描所有周报，把行首被转义的 \\#、\\-、\\> 等还原（正文其它内容不动），让标题和列表重新渲染。',
          okText: '开始修复'
        });
        if (!ok) return;
        try {
          const r = await api.post('/admin/repair-escapes');
          toast(`已扫描 ${r.scanned} 篇，修复 ${r.fixed} 篇`, 'success');
          navigate();
        } catch (e) {
          toast(e.message, 'error');
        }
      };
    }

    view.querySelectorAll('[data-del-article]').forEach((btn) => {
      btn.onclick = async () => {
        const ok = await confirmDialog({
          title: '删除《' + btn.dataset.title + '》？',
          message: '该周报的评论、点赞与附件会一并删除，且不可恢复。',
          okText: '删除',
          danger: true
        });
        if (!ok) return;
        try {
          await api.del('/reports/' + btn.dataset.delArticle);
          toast('已删除', 'success');
          navigate();
        } catch (e) {
          toast(e.message, 'error');
        }
      };
    });
  }

  /* ================= 设置 ================= */
  async function viewSettings(view) {
    setTitle('个人设置');
    const u = state.user;
    const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];

    view.innerHTML = `
      <div class="repo-head">
        <div class="repo-title"><b>个人设置</b></div>
        <div class="repo-actions">
          <a class="btn sm" href="#/mine">我的周报</a>
        </div>
      </div>

      <div class="Box">
        <div class="Box-header">个人资料</div>
        <div class="settings-body">
          <div class="avatar-uploader">
            <div id="avatar-preview">${userAvatar(u, 'xl')}</div>
            <div class="avatar-actions">
              <div style="font-weight:600">${esc(u.displayName)} <span style="color:var(--text-3);font-weight:400">@${esc(u.username)}</span></div>
              <div style="font-size:12px;color:var(--text-3);margin:2px 0 8px">学号 ${esc(u.studentId || '—')} · 加入于 ${dateTime(u.createdAt).slice(0, 10)}</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn sm" id="pick-avatar" type="button">${u.avatarUrl ? '更换头像' : '上传头像'}</button>
                <button class="btn sm ghost" id="clear-avatar" type="button" ${u.avatarUrl ? '' : 'hidden'}>移除</button>
              </div>
              <div class="hint" style="margin-top:6px">png / jpg / webp，自动裁成方形</div>
            </div>
          </div>
          <input type="file" id="avatar-file" accept="image/png,image/jpeg,image/webp" hidden />

          <div class="settings-field">
            <label for="s-name">姓名</label>
            <input class="input" id="s-name" maxlength="24" value="${esc(u.displayName)}" />
          </div>
          <div class="settings-field">
            <label for="s-bio">个人简介</label>
            <textarea class="textarea" id="s-bio" maxlength="200" style="min-height:64px">${esc(u.bio || '')}</textarea>
            <div class="hint">最多 200 字，会展示在你的主页</div>
          </div>
          <div class="settings-field">
            <label>头像底色</label>
            <div class="color-picker">
              ${colors.map((c) => `<span class="color-dot ${c === u.avatarColor ? 'active' : ''}" data-color="${c}" style="background:${c}"></span>`).join('')}
            </div>
            <div class="hint">没有上传头像时，用底色 + 姓名首字显示</div>
          </div>
          <button class="btn primary" id="save-profile">保存资料</button>
        </div>
      </div>

      <div class="Box" style="margin-top:16px">
        <div class="Box-header">安全</div>
        <div class="settings-body">
          <div class="settings-grid2">
            <div class="settings-field"><label for="p-old">当前密码</label>
              <input class="input" id="p-old" type="password" autocomplete="current-password" /></div>
            <div class="settings-field"><label for="p-new">新密码</label>
              <input class="input" id="p-new" type="password" autocomplete="new-password" /></div>
          </div>
          <div class="hint" style="margin-bottom:12px">修改后其它设备会被强制下线</div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn" id="save-pwd">更新密码</button>
            <button class="btn ghost" id="logout" style="margin-left:auto;color:var(--danger)">退出登录</button>
          </div>
        </div>
      </div>

      <div class="Box" style="margin-top:16px">
        <div class="Box-header">外观</div>
        <div class="settings-body">
          <div class="setting-row" style="padding:0 0 12px">
            <div class="meta"><b>深色模式</b><span>夜间阅读更护眼，选择会记住</span></div>
            <button class="btn sm" id="theme-switch">${themeNow() === 'dark' ? '切换到浅色' : '切换到深色'}</button>
          </div>
          <div class="setting-row" style="padding:12px 0 0;border-top:1px solid var(--border-muted)">
            <div class="meta"><b>主题色</b><span>影响按钮与链接颜色</span></div>
            <div class="color-picker" id="accent-picker">
              ${ACCENTS.map(
                (a) =>
                  `<span class="color-dot ${ls.get('wrs-accent', 'blue') === a.id ? 'active' : ''}" data-accent="${a.id}" title="${esc(a.name)}" style="background:${a.primary}"></span>`
              ).join('')}
            </div>
          </div>
          <div class="setting-row" style="padding:12px 0 0;border-top:1px solid var(--border-muted);flex-direction:column;align-items:flex-start;gap:8px">
            <div class="meta"><b>周报阅读主题</b><span>影响周报正文的代码块、引用与标题配色</span></div>
            <div class="md-theme-picker" id="md-theme-picker">
              ${[
                ['default', '默认', '跟随界面风格'],
                ['nature', '自然', '森林绿，沉稳温和'],
                ['hacker', '极客', '暗色，终端质感'],
                ['cyberpunk', '霓虹', '紫黑撞色'],
                ['developer', '开发', '简洁灰调'],
                ['minimal', '极简', '黑白克制']
              ]
                .map(
                  ([k, name, desc]) =>
                    `<button type="button" class="md-theme-chip ${ls.get('wrs-md-theme', 'default') === k ? 'active' : ''}" data-md="${k}" title="${desc}">${name}</button>`
                )
                .join('')}
            </div>
            <div class="hint">周报详情页可点代码块右上角「复制」直接复制代码</div>
          </div>
        </div>
      </div>

      <div class="app-version-line">
        <span class="app-version-badge">v${esc(state.version || '—')}</span>
        <span>HJSEC 安全学习周报 · Cupertino Design System</span>
      </div>

      ${
        state.user.role === 'admin'
          ? `<div class="hint" style="margin-top:16px">
               管理员功能（用户管理 / 站点设置 / 周报提醒 / 日志）在
               <a href="#/admin">管理后台</a> → <a href="#/admin?tab=settings">系统设置</a>
             </div>`
          : ''
      }`;

    // ---- 头像上传（本地裁剪 → 上传）----
    const avatarFile = $('#avatar-file');
    const pickAvatar = $('#pick-avatar');
    if (pickAvatar && avatarFile) {
      pickAvatar.onclick = () => avatarFile.click();
      avatarFile.onchange = async () => {
        const file = avatarFile.files && avatarFile.files[0];
        if (!file) return;
        if (!/^image\//.test(file.type)) {
          avatarFile.value = '';
          return toast('请选择图片文件', 'error');
        }
        if (file.size > 12 * 1024 * 1024) {
          avatarFile.value = '';
          return toast('图片不能超过 12MB', 'error');
        }
        pickAvatar.disabled = true;
        const oldText = pickAvatar.textContent;
        pickAvatar.textContent = '上传中…';
        try {
          const blob = await squareAvatarBlob(file, 512);
          if (!blob) throw new Error('图片处理失败，请换一张试试');
          const fd = new FormData();
          fd.append('avatar', blob, 'avatar.jpg');
          const res = await api.upload('/users/avatar', fd);
          state.user = res.user;
          toast('头像已更新', 'success');
          renderShell();
          markNav('settings');
          navigate();
        } catch (e) {
          toast(e.message, 'error');
          pickAvatar.disabled = false;
          pickAvatar.textContent = oldText;
        } finally {
          avatarFile.value = '';
        }
      };
    }

    const clearAvatar = $('#clear-avatar');
    if (clearAvatar) {
      clearAvatar.onclick = async () => {
        try {
          const res = await api.del('/users/avatar');
          state.user = res.user;
          toast('已移除头像', 'success');
          renderShell();
          markNav('settings');
          navigate();
        } catch (e) {
          toast(e.message, 'error');
        }
      };
    }

    let pickedColor = u.avatarColor;
    document.querySelectorAll('.color-dot').forEach((d) => {
      d.onclick = () => {
        document.querySelectorAll('.color-dot').forEach((x) => x.classList.remove('active'));
        d.classList.add('active');
        pickedColor = d.dataset.color;
        $('#avatar-preview').innerHTML = avatar(
          { displayName: $('#s-name').value || u.displayName, avatarColor: pickedColor, avatarUrl: u.avatarUrl },
          'xl'
        );
      };
    });

    $('#save-profile').onclick = async () => {
      try {
        const res = await api.patch('/auth/profile', {
          displayName: $('#s-name').value.trim(),
          bio: $('#s-bio').value.trim(),
          avatarColor: pickedColor
        });
        state.user = res.user;
        toast('资料已更新', 'success');
        renderShell();
        markNav('settings');
        navigate();
      } catch (e) {
        toast(e.message, 'error');
      }
    };

    $('#save-pwd').onclick = async () => {
      try {
        await api.post('/auth/password', { oldPassword: $('#p-old').value, newPassword: $('#p-new').value });
        toast('密码已更新', 'success');
        $('#p-old').value = '';
        $('#p-new').value = '';
      } catch (e) {
        toast(e.message, 'error');
      }
    };

    $('#logout').onclick = async () => {
      await api.post('/auth/logout');
      state.user = null;
      location.hash = '';
      renderAuth('login');
    };

    $('#theme-switch').onclick = (e) => {
      const next = themeNow() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      e.target.textContent = next === 'dark' ? '切换到浅色' : '切换到深色';
    };

    document.querySelectorAll('[data-accent]').forEach((d) => {
      d.onclick = () => {
        applyAccent(d.dataset.accent);
        document.querySelectorAll('[data-accent]').forEach((x) => x.classList.remove('active'));
        d.classList.add('active');
      };
    });

    document.querySelectorAll('[data-md]').forEach((b) => {
      b.onclick = () => {
        applyMdTheme(b.dataset.md);
        document.querySelectorAll('[data-md]').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      };
    });
  }

  /* ================= 管理后台 ================= */
  /* ================= 管理员：编辑任意用户资料 ================= */
  function openAdminUserEditor(u) {
    const root = $('#modal-root');
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal wide" role="dialog" aria-modal="true">
          <h3>编辑用户资料</h3>
          <div class="avatar-uploader" style="margin:12px 0 4px">
            <div id="ue-avatar">${userAvatar(u, 'xl')}</div>
            <div class="avatar-actions">
              <div style="font-weight:600">${esc(u.displayName)} <span style="color:var(--muted);font-weight:400">@${esc(u.username)}</span></div>
              <div style="display:flex;gap:8px;margin-top:8px">
                <button class="btn sm" type="button" id="ue-pick">${u.avatarUrl ? '更换头像' : '上传头像'}</button>
                <button class="btn sm ghost" type="button" id="ue-clear">移除头像</button>
                <button class="btn sm ghost" type="button" id="ue-pixel">设为像素头像</button>
              </div>
              <div class="hint" style="margin-top:6px">管理员可直接替换该用户的头像，用户端立即生效</div>
            </div>
          </div>
          <input type="file" id="ue-file" accept="image/png,image/jpeg,image/webp" hidden />
          <div class="row">
            <div class="field"><label for="ue-name">姓名</label><input class="input" id="ue-name" maxlength="24" value="${esc(u.displayName || '')}" /></div>
            <div class="field"><label for="ue-username">用户名</label><input class="input" id="ue-username" maxlength="20" value="${esc(u.username || '')}" /></div>
          </div>
          <div class="row">
            <div class="field"><label for="ue-email">邮箱</label><input class="input" id="ue-email" type="email" value="${esc(u.email || '')}" /></div>
            <div class="field"><label for="ue-sid">学号</label><input class="input" id="ue-sid" maxlength="20" value="${esc(u.studentId || '')}" /></div>
          </div>
          <div class="field"><label for="ue-bio">个人简介</label><textarea class="textarea" id="ue-bio" maxlength="200" style="min-height:64px">${esc(u.bio || '')}</textarea></div>
          <div class="acts">
            <button class="btn" type="button" data-act="cancel">取消</button>
            <button class="btn primary" type="button" data-act="ok">保存</button>
          </div>
        </div>
      </div>`;

    const close = () => {
      root.innerHTML = '';
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    root.querySelector('[data-act="cancel"]').onclick = close;
    root.querySelector('.modal-backdrop').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) close();
    });

    const file = root.querySelector('#ue-file');
    const pick = root.querySelector('#ue-pick');
    pick.onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) {
        file.value = '';
        return toast('请选择图片文件', 'error');
      }
      if (f.size > 12 * 1024 * 1024) {
        file.value = '';
        return toast('图片不能超过 12MB', 'error');
      }
      pick.disabled = true;
      pick.textContent = '上传中…';
      try {
        const blob = await squareAvatarBlob(f, 512);
        if (!blob) throw new Error('图片处理失败，请换一张试试');
        const fd = new FormData();
        fd.append('avatar', blob, 'avatar.jpg');
        await api.upload('/admin/users/' + u.id + '/avatar', fd);
        toast('头像已更新', 'success');
        close();
        navigate();
      } catch (e) {
        toast(e.message, 'error');
        pick.disabled = false;
        pick.textContent = '上传头像';
      } finally {
        file.value = '';
      }
    };

    root.querySelector('#ue-pixel').onclick = async () => {
      try {
        await api.del('/admin/users/' + u.id + '/avatar');
        toast('已设为像素头像', 'success');
        close();
        navigate();
      } catch (e) {
        toast(e.message, 'error');
      }
    };

    root.querySelector('#ue-clear').onclick = async () => {
      try {
        await api.del('/admin/users/' + u.id + '/avatar');
        toast('已移除头像', 'success');
        close();
        navigate();
      } catch (e) {
        toast(e.message, 'error');
      }
    };

    root.querySelector('[data-act="ok"]').onclick = async () => {
      const btn = root.querySelector('[data-act="ok"]');
      btn.disabled = true;
      btn.textContent = '保存中…';
      try {
        await api.patch('/admin/users/' + u.id, {
          displayName: root.querySelector('#ue-name').value.trim(),
          username: root.querySelector('#ue-username').value.trim(),
          email: root.querySelector('#ue-email').value.trim(),
          studentId: root.querySelector('#ue-sid').value.trim(),
          bio: root.querySelector('#ue-bio').value
        });
        toast('资料已保存', 'success');
        close();
        navigate();
      } catch (e) {
        toast(e.message, 'error');
        btn.disabled = false;
        btn.textContent = '保存';
      }
    };
  }

  /* ================= 管理后台：审计日志 ================= */
  const ACTION_LABELS = {
    login: '登录',
    login_failed: '登录失败',
    logout: '退出登录',
    register: '注册',
    profile_update: '修改资料',
    password_change: '修改密码',
    password_forgot: '申请重置密码',
    password_reset: '重置密码',
    comment_create: '发表评论',
    report_create: '写周报',
    report_update: '修改周报',
    report_delete: '删除周报',
    avatar_set: '更换头像',
    avatar_clear: '移除头像',
    admin_user_update: '管理员改用户',
    admin_password_reset: '管理员重置密码',
    admin_user_avatar_set: '管理员传头像',
    admin_user_avatar_clear: '管理员删头像',
    admin_settings_update: '修改系统设置',
    admin_week_base: '修改周次',
    admin_report_delete: '管理员删周报',
    mail_send: '发送邮件',
    mail_failed: '邮件失败',
    reminder_send: '发送周报提醒',
    admin_mail_broadcast: '管理员群发邮件',
    admin_smtp_update: '修改邮件设置',
    admin_smtp_test: '测试 SMTP 连接',
    admin_mail_theme: '切换邮件主题',
    admin_mail_preview: '发送模板预览',
    admin_reminder_config: '修改提醒设置'
  };

  function logKind(action) {
    if (/failed$/.test(action)) return { cls: 'danger', icon: '⚠', label: ACTION_LABELS[action] || action };
    if (/^admin_/.test(action)) return { cls: 'admin', icon: '🛡', label: ACTION_LABELS[action] || action };
    if (/^mail_/.test(action)) return { cls: 'mail', icon: '✉', label: ACTION_LABELS[action] || action };
    if (/reminder/.test(action)) return { cls: 'admin', icon: '⏰', label: ACTION_LABELS[action] || action };
    if (/^report_|^comment_/.test(action)) return { cls: 'content', icon: '📝', label: ACTION_LABELS[action] || action };
    if (/^avatar_|^profile_|^password_/.test(action))
      return { cls: 'profile', icon: '👤', label: ACTION_LABELS[action] || action };
    return { cls: 'auth', icon: '🔑', label: ACTION_LABELS[action] || action };
  }

  function logRow(it) {
    const k = logKind(it.action);
    const d = new Date(it.createdAt);
    const p2 = (n) => String(n).padStart(2, '0');
    const stamp = `${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(
      d.getSeconds()
    )}`;
    const failed = /failed$/.test(it.action);
    const isSystem = !it.actor || it.actor === 'system';
    return `<tr class="log-row log-${k.cls}">
      <td class="log-time">${stamp}</td>
      <td class="log-ip" title="${esc(it.userAgent || '')}">${esc(it.ip || '—')}</td>
      <td class="log-user">${
        isSystem
          ? '<span class="log-system">System</span>'
          : `<a href="#/u/${it.actorId || ''}">@${esc(it.actor)}</a>`
      }</td>
      <td class="log-info"><span class="log-chip">${k.icon} ${esc(k.label)}</span><span class="log-detail" title="${esc(
      it.detail || ''
    )}">${/^mail_/.test(it.action) && it.detail ? '：' : ' '}${esc(it.detail || '')}</span></td>
      <td class="log-status">${
        failed ? '<span class="chip soft-danger">Failed</span>' : '<span class="chip soft-success">Success</span>'
      }</td>
    </tr>`;
  }

  async function viewAdmin(view, query) {
    setTitle('管理后台');
    const tab = query.get('tab') || 'overview';
    // 系统日志红点：只统计「上次查看之后新增」的日志，查看后消失
    let logsBadge = 0;
    try {
      const lastLogs = await api.get('/admin/logs?limit=50');
      const seenId = Number(ls.get('wrs-logs-seen', '0')) || 0;
      const items = lastLogs.items || [];
      const maxId = items.length ? Number(items[0].id) : 0;
      if (maxId > seenId) logsBadge = items.filter((it) => Number(it.id) > seenId).length;
      // 打开了日志页 = 已读，清零（本次渲染导航时红点就消失）
      if (tab === 'logs') {
        if (maxId > seenId) ls.set('wrs-logs-seen', String(maxId));
        logsBadge = 0;
      }
    } catch (e) {
      logsBadge = 0;
    }

    // gzctf 风格：左侧固定导航 + 右侧内容区
    const navItems = [
      ['overview', '概览', ICONS.dashboard, ''],
      ['users', '用户管理', ICONS.users, ''],
      ['reports', '周报管理', ICONS.file, ''],
      ['logs', '系统日志', ICONS.shield, logsBadge ? `<span class="as-badge">${logsBadge}</span>` : ''],
      ['reminders', '周报提醒', ICONS.bell, ''],
      ['mail', '邮件群发', ICONS.mail, ''],
      ['smtp', '邮件设置', ICONS.settings, ''],
      ['settings', '系统设置', ICONS.settings, '']
    ];

    // 两种皮肤都用横向导航：知乎保持简洁 tab 栏，GitHub 用带品牌的 topbar
    const navHtml = uiIsZhihu()
      ? `<div class="admin-tabs" role="tablist" aria-label="管理后台功能">
          ${navItems
            .map(
              ([k, label, icon, badge]) => `
            <button class="admin-tab ${tab === k ? 'active' : ''}" data-t="${k}" role="tab" aria-selected="${tab === k}">
              ${icon}<span>${label}</span>${badge}
            </button>`
            )
            .join('')}
        </div>`
      : `<header class="admin-topbar">
          <div class="admin-topbar-head">
            <div class="admin-topbar-mark">${ICONS.shield}</div>
            <div>
              <div class="admin-topbar-title">管理后台</div>
              <div class="admin-topbar-sub">ADMIN CONSOLE</div>
            </div>
          </div>
          <nav class="admin-topbar-nav" role="tablist" aria-label="管理后台功能">
            ${navItems
              .map(
                ([k, label, icon, badge]) => `
              <button class="admin-nav-item ${tab === k ? 'active' : ''}" data-t="${k}" role="tab" aria-selected="${tab === k}">
                <span class="ani-icon">${icon}</span>
                <span class="ani-label">${label}</span>
                ${badge}
              </button>`
              )
              .join('')}
          </nav>
          <a class="admin-topbar-back" href="#/dashboard">返回站点 →</a>
        </header>`;

    view.innerHTML = `
      <div class="admin-shell admin-shell-h">
        ${navHtml}
        <section class="admin-main" id="admin-body"></section>
      </div>`;

    document.querySelectorAll('[data-t]').forEach((b) => {
      b.onclick = () => (location.hash = '#/admin?tab=' + b.dataset.t);
    });

    const body = $('#admin-body');

    if (tab === 'users') {
      const uq = query.get('q') || '';
      const data = await api.get(
        '/admin/users?limit=100' + (uq ? '&q=' + encodeURIComponent(uq) : '')
      );
      body.innerHTML = `
        <div class="Box">
          <div class="Box-header">
            用户
            <span class="count-pill">${data.total} 人</span>
            <div class="search-box" style="margin-left:auto;max-width:260px">
              ${ICONS.search}
              <input class="input" id="au-q" placeholder="搜索用户名 / 姓名 / 邮箱…" value="${esc(uq)}" />
            </div>
          </div>
          <table class="table">
            <thead><tr><th>用户</th><th>学号</th><th>邮箱</th><th>周报</th><th>字数</th><th>角色</th><th>状态</th><th></th></tr></thead>
            <tbody>
              ${data.items
                .map(
                  (u) => `<tr>
                    <td><div class="u">${userAvatar(u, 'sm')}<div><div style="font-weight:600">${esc(u.displayName)}</div><div style="font-size:11.5px;color:var(--muted)">@${esc(u.username)}</div></div></div></td>
                    <td style="font-variant-numeric:tabular-nums">${esc(u.studentId || '—')}</td>
                    <td style="color:var(--text-2)">${esc(u.email)}</td>
                    <td>${u.reports}</td>
                    <td>${fmtChars(u.chars)}</td>
                    <td>${u.role === 'admin' ? '<span class="chip soft-primary">管理员</span>' : '成员'}</td>
                    <td>${u.status === 'active' ? '<span class="chip soft-success">正常</span>' : '<span class="chip soft-danger">已停用</span>'}</td>
                    <td style="text-align:right;white-space:nowrap">
                      <button class="btn sm ghost" data-role="${u.id}" data-cur="${u.role}">${u.role === 'admin' ? '降为成员' : '设为管理员'}</button>
                      <button class="btn sm ghost" data-status="${u.id}" data-cur="${u.status}">${u.status === 'active' ? '停用' : '启用'}</button>
                      <button class="btn sm ghost" data-edit="${u.id}">编辑资料</button>
                      <button class="btn sm ghost" data-avatar="${u.id}" data-uname="${esc(u.username)}">像素头像</button>
                      <button class="btn sm ghost" data-reset="${u.id}">重置密码</button>
                    </td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      const auq = $('#au-q');
      if (auq) {
        auq.onkeydown = (e) => {
          if (e.key !== 'Enter') return;
          const v = auq.value.trim();
          location.hash = '#/admin?tab=users' + (v ? '&q=' + encodeURIComponent(v) : '');
        };
      }

      body.querySelectorAll('[data-role]').forEach((b) => {
        b.onclick = async () => {
          try {
            await api.patch('/admin/users/' + b.dataset.role, { role: b.dataset.cur === 'admin' ? 'user' : 'admin' });
            toast('已更新', 'success');
            navigate();
          } catch (e) {
            toast(e.message, 'error');
          }
        };
      });
      body.querySelectorAll('[data-status]').forEach((b) => {
        b.onclick = async () => {
          try {
            await api.patch('/admin/users/' + b.dataset.status, {
              status: b.dataset.cur === 'active' ? 'disabled' : 'active'
            });
            toast('已更新', 'success');
            navigate();
          } catch (e) {
            toast(e.message, 'error');
          }
        };
      });
      body.querySelectorAll('[data-edit]').forEach((b) => {
        b.onclick = () => {
          const u = data.items.find((x) => String(x.id) === String(b.dataset.edit));
          if (u) openAdminUserEditor(u);
        };
      });
      body.querySelectorAll('[data-avatar]').forEach((b) => {
        b.onclick = async () => {
          const uid = b.dataset.avatar;
          const uname = b.dataset.uname;
          const ok = await confirmDialog({
            title: '设置为 GitHub 像素头像？',
            message: `将移除 @${uname} 当前上传的头像，改用按用户名生成的像素图案。成员仍可自行重新上传。`,
            okText: '设置'
          });
          if (!ok) return;
          try {
            await api.del('/admin/users/' + uid + '/avatar');
            toast('已设置为像素头像', 'success');
            navigate();
          } catch (e) {
            toast(e.message, 'error');
          }
        };
      });
      body.querySelectorAll('[data-reset]').forEach((b) => {
        b.onclick = async () => {
          const pwd = window.prompt('输入新密码（至少 6 位）：');
          if (!pwd) return;
          try {
            await api.post(`/admin/users/${b.dataset.reset}/reset-password`, { password: pwd });
            toast('密码已重置', 'success');
          } catch (e) {
            toast(e.message, 'error');
          }
        };
      });
      return;
    }

    if (tab === 'logs') {
      const q = query.get('q') || '';
      const action = query.get('action') || '';
      const range = query.get('range') || 'all';
      const build = (offset) => {
        let u = `/admin/logs?limit=50&offset=${offset}&range=${encodeURIComponent(range)}`;
        if (q) u += '&q=' + encodeURIComponent(q);
        if (action) u += '&action=' + encodeURIComponent(action);
        return u;
      };
      const data = await api.get(build(0));
      const st = data.stats || {};
      const rangeOpts = [
        ['all', '全部时间'],
        ['today', '今天'],
        ['7d', '近 7 天'],
        ['30d', '近 30 天']
      ]
        .map(([v, t]) => `<option value="${v}" ${range === v ? 'selected' : ''}>${t}</option>`)
        .join('');

      body.innerHTML = `
        <div class="log-stats">
          <div class="log-stat"><b>${st.today || 0}</b><span>今日事件</span></div>
          <div class="log-stat"><b>${st.actors || 0}</b><span>今日活跃账号</span></div>
          <div class="log-stat"><b>${st.mail || 0}</b><span>今日发信</span></div>
          <div class="log-stat danger"><b>${st.failed || 0}</b><span>今日失败（登录/发信）</span></div>
        </div>

        <div class="log-filters">
          <div class="search-box">
            ${ICONS.search}
            <input class="input" id="lg-q" placeholder="搜索操作者 / 详情 / IP…" value="${esc(q)}" />
          </div>
          <select class="select" id="lg-a" style="max-width:230px">
            <option value="">全部动作</option>
            ${(data.actions || [])
              .map(
                (a) =>
                  `<option value="${esc(a.action)}" ${a.action === action ? 'selected' : ''}>${esc(
                    ACTION_LABELS[a.action] || a.action
                  )}（${a.count}）</option>`
              )
              .join('')}
          </select>
          <select class="select" id="lg-r" style="max-width:140px">${rangeOpts}</select>
          <div class="spacer"></div>
          <span class="log-total">共 ${data.total} 条 · 保留 90 天</span>
        </div>

        <div class="log-card">
          <table class="log-table">
            <thead>
              <tr><th style="width:150px">时间</th><th style="width:130px">IP</th><th style="width:130px">用户</th><th>信息</th><th style="width:80px">状态</th></tr>
            </thead>
            <tbody id="lg-list">
              ${
                (data.items || []).map(logRow).join('') ||
                '<tr><td colspan="5"><div class="empty" style="padding:30px">没有符合条件的日志</div></td></tr>'
              }
            </tbody>
          </table>
        </div>
        <div class="log-more">
          <button class="btn sm" id="lg-more" ${data.total > (data.items || []).length ? '' : 'hidden'}>加载更多</button>
        </div>`;

      const go = () => {
        const params = new URLSearchParams();
        const qq = $('#lg-q').value.trim();
        const aa = $('#lg-a').value;
        const rr = $('#lg-r').value;
        if (qq) params.set('q', qq);
        if (aa) params.set('action', aa);
        if (rr && rr !== 'all') params.set('range', rr);
        const qs = params.toString();
        location.hash = `#/admin?tab=logs${qs ? '&' + qs : ''}`;
      };
      $('#lg-a').onchange = go;
      $('#lg-r').onchange = go;
      $('#lg-q').onkeydown = (e) => {
        if (e.key === 'Enter') go();
      };

      let offset = (data.items || []).length;
      const more = $('#lg-more');
      if (more) {
        more.onclick = async () => {
          more.disabled = true;
          more.textContent = '加载中…';
          try {
            const next = await api.get(build(offset));
            $('#lg-list').insertAdjacentHTML('beforeend', (next.items || []).map(logRow).join(''));
            offset += (next.items || []).length;
            more.disabled = false;
            more.textContent = '加载更多';
            if (offset >= next.total) more.hidden = true;
          } catch (e) {
            toast(e.message, 'error');
            more.disabled = false;
            more.textContent = '加载更多';
          }
        };
      }
      return;
    }

    if (tab === 'reports') {
      const data = await api.get('/admin/reports?limit=100');
      body.innerHTML = `
        <div class="Box">
          <div class="Box-header">周报管理 <span class="count-pill">${data.total} 篇</span></div>
          <table class="table">
            <thead><tr><th>标题</th><th>作者</th><th>周次</th><th>字数</th><th>提交时间</th><th></th></tr></thead>
            <tbody>
              ${
                data.items
                  .map(
                    (r) => `<tr>
                      <td><a href="#/report/${r.id}">${esc(r.title)}</a>
                        ${r.status === 'draft' ? ' <span class="chip soft-warn">草稿</span>' : ''}</td>
                      <td>${esc(r.author.displayName)}<div style="font-size:11.5px;color:var(--muted)">@${esc(r.author.username)}</div></td>
                      <td style="white-space:nowrap">第${weekNumber(r.weekStart)}周<div style="font-size:11.5px;color:var(--muted)">${weekRange(r.weekStart)}</div></td>
                      <td>${fmtChars(r.chars)}</td>
                      <td style="color:var(--muted);white-space:nowrap">${timeAgo(r.createdAt)}</td>
                      <td style="text-align:right"><button class="btn sm danger" data-del-report="${r.id}" data-title="${esc(r.title)}">删除</button></td>
                    </tr>`
                  )
                  .join('') || `<tr><td colspan="6"><div class="empty" style="padding:26px">暂无周报</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
        <div style="margin-top:12px;font-size:12px;color:var(--muted)">共 ${data.total} 篇周报。删除会同时清除该篇的评论、点赞与附件文件，不可恢复。</div>`;

      body.querySelectorAll('[data-del-report]').forEach((b) => {
        b.onclick = async () => {
          const ok = await confirmDialog({
            title: '删除周报《' + b.dataset.title + '》？',
            message: '该周报的评论、点赞与附件文件会一并删除，且不可恢复。',
            okText: '确认删除',
            danger: true
          });
          if (!ok) return;
          try {
            await api.del('/admin/reports/' + b.dataset.delReport);
            toast('已删除', 'success');
            navigate();
          } catch (e) {
            toast(e.message, 'error');
          }
        };
      });
      return;
    }

    if (tab === 'posts') {
      const data = await api.get('/admin/posts?limit=100');
      body.innerHTML = `
        <div class="Box">
          <div class="Box-header">帖子管理 <span class="count-pill">${data.total} 条</span></div>
          <table class="table">
            <thead><tr><th>标题</th><th>作者</th><th>浏览</th><th>时间</th><th></th></tr></thead>
            <tbody>
              ${data.items
                .map(
                  (p) => `<tr>
                    <td><a href="#/post/${p.id}">${esc(p.title)}</a> ${p.isPinned ? '<span class="chip soft-danger">置顶</span>' : ''}</td>
                    <td>${esc(p.author.displayName)}</td>
                    <td>${p.views}</td>
                    <td style="color:var(--muted)">${timeAgo(p.createdAt)}</td>
                    <td style="text-align:right"><button class="btn sm danger" data-del="${p.id}">删除</button></td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;
      body.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = async () => {
          const ok = await confirmDialog({ title: '删除该帖子？', message: '此操作不可恢复。', okText: '删除', danger: true });
          if (!ok) return;
          await api.del('/posts/' + b.dataset.del);
          toast('已删除', 'success');
          navigate();
        };
      });
      return;
    }

    if (tab === 'reminders') {
      const cfg = await api.get('/admin/reminders');
      const ids = cfg.ids || [];
      body.innerHTML = `
        ${
          cfg.mailMode === 'console'
            ? `<div class="card pad" style="margin-bottom:16px;border-color:#fbbf24;background:#fffbeb">
                 <b style="color:#b45309">⚠ 邮件未配置</b>
                 <div style="font-size:12.5px;color:var(--text-2);margin-top:4px">
                   现在发信只会写日志、不会真的投递。去
                   <a href="#/admin?tab=smtp" style="font-weight:600">邮件设置</a>
                   填 SMTP 并点「测试连接」即可启用。
                 </div>
               </div>`
            : ''
        }
        <div class="card pad" style="margin-bottom:16px">
          <div class="card-title">周报提醒</div>
          <div class="setting-row">
            <div class="meta"><b>启用定时提醒</b><span>周六到点提醒没写的人，周日再到点发「未提交」通知</span></div>
            <input type="checkbox" id="rm-on" ${cfg.enabled ? 'checked' : ''} style="width:18px;height:18px" />
          </div>
          <div class="row" style="max-width:520px">
            <div class="field"><label for="rm-sat">周六提醒时间</label><input class="input" id="rm-sat" type="time" value="${esc(cfg.satTime)}" /></div>
            <div class="field"><label for="rm-sun">周日未提交通知时间</label><input class="input" id="rm-sun" type="time" value="${esc(cfg.sunTime)}" /></div>
          </div>
          <div class="field">
            <label>发送对象</label>
            <div style="display:flex;gap:18px;margin:6px 0 10px;font-size:13px">
              <label style="cursor:pointer"><input type="radio" name="rm-mode" value="all" ${
                cfg.mode === 'all' ? 'checked' : ''
              } style="margin-right:6px" />全部成员</label>
              <label style="cursor:pointer"><input type="radio" name="rm-mode" value="selected" ${
                cfg.mode === 'selected' ? 'checked' : ''
              } style="margin-right:6px" />只发给指定成员</label>
            </div>
            <div class="member-picker" id="rm-members" ${cfg.mode === 'selected' ? '' : 'hidden'}>
              ${(cfg.members || [])
                .map(
                  (m) =>
                    `<label class="pick"><input type="checkbox" value="${m.id}" ${
                      ids.includes(m.id) ? 'checked' : ''
                    } /><span>${esc(m.displayName)}</span><em>@${esc(m.username)}</em></label>`
                )
                .join('')}
            </div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
            <button class="btn primary" id="rm-save">保存设置</button>
            <button class="btn" id="rm-send-sat">立即发送周六提醒</button>
            <button class="btn" id="rm-send-sun">立即发送周日未提交通知</button>
          </div>
          <div class="hint" style="margin-top:10px">
            最近一次：周六 ${esc(cfg.lastSat || '—')} · 周日 ${esc(cfg.lastSun || '—')}
            ｜本周是第 ${cfg.weekNumber} 周（${esc(cfg.weekStart)}）
          </div>
        </div>

        <div class="card pad">
          <div class="card-title">本周未提交 <span class="chip soft-warn">${(cfg.pending || []).length} 人</span></div>
          <div class="taglist">
            ${
              (cfg.pending || []).map((u) => `<a class="chip" href="#/u/${u.id}">${esc(u.displayName)}</a>`).join('') ||
              '<span style="color:var(--muted)">全员已提交 🎉</span>'
            }
          </div>
          <div class="hint" style="margin-top:10px">名单按「本周已提交」实时计算；发送对象不是「全部成员」时，只发其中被勾选的人。</div>
        </div>`;

      const membersBox = $('#rm-members');
      document.querySelectorAll('input[name="rm-mode"]').forEach((r) => {
        r.onchange = () => {
          membersBox.hidden = document.querySelector('input[name="rm-mode"]:checked').value !== 'selected';
        };
      });

      const collect = () => ({
        enabled: $('#rm-on').checked,
        satTime: $('#rm-sat').value || '22:00',
        sunTime: $('#rm-sun').value || '22:00',
        mode: document.querySelector('input[name="rm-mode"]:checked').value,
        ids: [...membersBox.querySelectorAll('input[type="checkbox"]:checked')].map((x) => Number(x.value))
      });

      $('#rm-save').onclick = async () => {
        try {
          await api.put('/admin/reminders', collect());
          toast('提醒设置已保存', 'success');
          navigate();
        } catch (e) {
          toast(e.message, 'error');
        }
      };

      const sendNow = async (stage) => {
        const label = stage === 'sat' ? '周六提醒' : '周日未提交通知';
        const ok = await confirmDialog({
          title: `立即发送${label}？`,
          message: '会立刻给「本周未提交」的人发邮件（手动发送不影响定时任务的下次执行）。',
          okText: '发送'
        });
        if (!ok) return;
        try {
          const r = await api.post('/admin/reminders/send', { stage });
          const modeTip = r.mailMode === 'console' ? '（console 模式：只写日志，未真发）' : '';
          toast(`${label}：命中 ${r.targets} 人，成功 ${r.sent}，失败 ${r.failed}${modeTip}`, 'success');
          navigate();
        } catch (e) {
          toast(e.message, 'error');
        }
      };
      $('#rm-send-sat').onclick = () => sendNow('sat');
      $('#rm-send-sun').onclick = () => sendNow('sun');
      return;
    }

    if (tab === 'smtp') {
      const cfg = await api.get('/admin/smtp');
      body.innerHTML = `
        <div class="Box">
          <div class="Box-header">
            邮件设置（SMTP）
            ${cfg.configured ? '<span class="chip soft-success">已配置</span>' : '<span class="chip soft-warn">未配置</span>'}
          </div>
          <div style="padding:16px">
            <div class="hint" style="margin-bottom:14px">
              填好下面四项后点「测试连接」，通过后系统所有邮件（验证码 / 评论通知 / 周报提醒 / 群发）都会真实发出。
              不需要改任何启动参数。
            </div>

            <div class="gh-field-row">
              <div class="gh-field"><label for="sm-host">SMTP 服务器</label>
                <input class="input" id="sm-host" placeholder="smtp.qq.com" value="${esc(cfg.host || '')}" /></div>
              <div class="gh-field" style="max-width:140px"><label for="sm-port">端口</label>
                <input class="input" id="sm-port" placeholder="465" value="${esc(String(cfg.port || 465))}" /></div>
            </div>

            <div class="gh-field-row">
              <div class="gh-field"><label for="sm-user">用户名（邮箱地址）</label>
                <input class="input" id="sm-user" placeholder="noreply@example.com" value="${esc(cfg.user || '')}" /></div>
              <div class="gh-field"><label for="sm-pass">密码 / 授权码</label>
                <input class="input" id="sm-pass" type="password" placeholder="${cfg.pass ? '已设置，留空表示不修改' : '填写 SMTP 授权码'}" value="" /></div>
            </div>

            <div class="gh-field"><label for="sm-from">发件人显示</label>
              <input class="input" id="sm-from" placeholder="HJSEC 安全学习周报 &lt;noreply@example.com&gt;" value="${esc(cfg.from || '')}" /></div>

            <div class="gh-field"><label for="sm-siteurl">站点地址（邮件里的链接用）</label>
              <input class="input" id="sm-siteurl" placeholder="https://example.com" value="${esc(cfg.siteUrl || 'https://example.com')}" /></div>

            <div class="gh-field">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px">
                <input type="checkbox" id="sm-secure" ${cfg.secure ? 'checked' : ''} />
                SSL/TLS（465 端口勾选；587 端口不勾）
              </label>
            </div>

            <div class="gh-field">
              <label for="sm-custom-html">自定义邮件 HTML 模板（可选）</label>
              <textarea class="textarea" id="sm-custom-html" style="min-height:150px;font-family:var(--mono);font-size:12px" placeholder="留空则用内置主题。填写完整 HTML，并用 {{content}} 标记正文插入位置。&#10;可用变量：{{content}} {{site}} {{site_url}} {{year}} {{title}}">${esc(cfg.customHtml || '')}</textarea>
              <div class="hint">填写后，在下方「邮件主题」里选择「自定义 HTML」并设为固定主题即可生效。未配置或缺少 {{content}} 时自动回退 Nature 主题。</div>
            </div>

            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <button class="btn primary" id="sm-save">保存</button>
              <button class="btn" id="sm-test">测试连接</button>
              <span class="hint" id="sm-result"></span>
            </div>

            <div class="hint" style="margin-top:14px">
              常用配置：QQ 邮箱 <code>smtp.qq.com:465</code> · 163 <code>smtp.163.com:465</code> ·
              Resend <code>smtp.resend.com:465</code>（用户 <code>resend</code>）
            </div>
          </div>
        </div>

        <div class="Box" style="margin-top:16px">
          <div class="Box-header">邮件主题 <span class="chip" id="mt-mode-chip">随机</span>
            <span class="hint" style="margin-left:8px;font-weight:400">5 套视觉模板 · 由服务端随机挑选</span>
          </div>
          <div style="padding:16px">
            <div class="gh-field" style="margin:0 0 14px">
              <label>主题模式</label>
              <div class="seg" id="mt-mode">
                <button type="button" class="seg-btn" data-mode="random">随机主题</button>
                <button type="button" class="seg-btn" data-mode="fixed">固定主题</button>
              </div>
              <div class="hint" style="margin-top:6px">
                随机模式：每封邮件从勾选的主题里抽一套（同一次发送只抽一次）；固定模式：始终使用「默认」那一套。
              </div>
            </div>

            <div class="theme-grid" id="mt-grid"></div>

            <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:18px">
              <div class="gh-field" style="margin:0;min-width:220px">
                <label for="mt-kind">通知类型</label>
                <select class="select" id="mt-kind"></select>
              </div>
              <button class="btn" id="mt-refresh">刷新预览</button>
              <div class="gh-field" style="margin:0;min-width:200px">
                <label for="mt-to">测试收件邮箱</label>
                <input class="input" id="mt-to" placeholder="留空用你自己的邮箱" />
              </div>
              <button class="btn primary" id="mt-send">发送测试邮件</button>
              <span class="hint" id="mt-result"></span>
            </div>
            <div class="hint" style="margin-top:8px">
              预览与真实发送走同一条渲染路径；点主题卡片的「预览」单看那一套，保持「随机」则每次刷新随机一套。
            </div>
            <div class="mail-preview-wrap">
              <iframe id="mt-preview" class="mail-preview" title="邮件预览"></iframe>
            </div>

            <div class="mt-recent" id="mt-recent"></div>
          </div>
        </div>
        </div>`;

      const collect = () => ({
        host: $('#sm-host').value.trim(),
        port: Number($('#sm-port').value) || 465,
        secure: $('#sm-secure').checked,
        user: $('#sm-user').value.trim(),
        pass: $('#sm-pass').value,
        from: $('#sm-from').value.trim(),
        siteUrl: $('#sm-siteurl').value.trim(),
        customHtml: $('#sm-custom-html') ? $('#sm-custom-html').value : undefined
      });

      $('#sm-save').onclick = async () => {
        try {
          const r = await api.put('/admin/smtp', collect());
          $('#sm-result').textContent = r.configured ? '已保存，配置完整' : '已保存，但配置不完整';
          toast('邮件设置已保存', 'success');
        } catch (e) {
          toast(e.message, 'error');
        }
      };

      // ---- 邮件主题（多主题 + 随机选择） ----
      let mtState = { mode: 'random', enabled: [], defaultTheme: 'nature', all: [], kinds: [], recent: [] };
      let previewTheme = 'random';

      const collectEnabled = () =>
        Array.from(document.querySelectorAll('#mt-grid [data-enable]:checked')).map((c) => c.dataset.enable);

      const renderMode = () => {
        const chip = $('#mt-mode-chip');
        if (chip) chip.textContent = mtState.mode === 'fixed' ? '固定主题' : '随机主题';
        document.querySelectorAll('#mt-mode [data-mode]').forEach((b) => {
          b.classList.toggle('active', b.dataset.mode === mtState.mode);
        });
      };

      const renderKinds = () => {
        const sel = $('#mt-kind');
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = (mtState.kinds || [])
          .map((k) => `<option value="${esc(k.key)}">${esc(k.label)}</option>`)
          .join('');
        if (cur && (mtState.kinds || []).some((k) => k.key === cur)) sel.value = cur;
      };

      const renderThemeGrid = () => {
        const grid = $('#mt-grid');
        if (!grid) return;
        grid.innerHTML = (mtState.all || [])
          .map((t) => {
            const on = (mtState.enabled || []).includes(t.key);
            const isDefault = t.key === mtState.defaultTheme;
            const swatch = (t.palette && t.palette.primary) || '#999';
            return `<div class="theme-card ${on ? 'on' : ''} ${isDefault ? 'is-default' : ''}" data-theme="${esc(t.key)}">
              <label class="theme-check" title="参与随机">
                <input type="checkbox" data-enable="${esc(t.key)}" ${on ? 'checked' : ''} />
              </label>
              <span class="theme-swatch" style="background:${esc(swatch)}"></span>
              <div class="theme-meta">
                <div class="theme-name">${esc(t.name)}${isDefault ? ' <span class="chip soft-primary">默认</span>' : ''}</div>
                <div class="theme-desc">${esc(t.desc || '')}</div>
              </div>
              <div class="theme-actions">
                <button type="button" class="mini" data-preview="${esc(t.key)}">预览</button>
                <button type="button" class="mini" data-default="${esc(t.key)}">${isDefault ? '已默认' : '设为默认'}</button>
              </div>
            </div>`;
          })
          .join('');

        grid.querySelectorAll('[data-enable]').forEach((cb) => {
          cb.onchange = () => {
            const enabled = collectEnabled();
            if (!enabled.length) {
              toast('至少保留一套启用的主题', 'error');
              cb.checked = true;
              return;
            }
            saveThemes({ enabled });
          };
        });

        grid.querySelectorAll('[data-preview]').forEach((b) => {
          b.onclick = () => {
            previewTheme = b.dataset.preview;
            grid.querySelectorAll('[data-preview]').forEach((x) => x.classList.toggle('active', x === b));
            loadPreview();
          };
        });

        grid.querySelectorAll('[data-default]').forEach((b) => {
          b.onclick = () => saveThemes({ defaultTheme: b.dataset.default });
        });
      };

      const renderRecent = () => {
        const el = $('#mt-recent');
        if (!el) return;
        const items = mtState.recent || [];
        if (!items.length) {
          el.innerHTML = '<div class="mt-recent-head">最近邮件主题</div><div class="hint">还没有发送记录。</div>';
          return;
        }
        el.innerHTML = `<div class="mt-recent-head">最近邮件主题</div>
          <div class="mt-recent-list">
            ${items
              .map((r) => {
                const to = String(r.to_email || '').replace(/^(.).*(@.*)$/, '$1***$2');
                const when = String(r.created_at || '').slice(0, 16).replace('T', ' ');
                return `<div class="mt-recent-row">
                  <span class="mt-dot ${r.ok ? 'ok' : 'bad'}"></span>
                  <b>${esc(r.theme || '未记录')}</b>
                  <span class="mt-type">${esc(r.type || '')}</span>
                  <span class="mt-to">${esc(to)}</span>
                  <span class="mt-when">${esc(when)}</span>
                </div>`;
              })
              .join('')}
          </div>`;
      };

      const saveThemes = async (patch) => {
        try {
          const r = await api.put('/admin/mail/themes', patch);
          mtState = { ...mtState, ...r };
          renderMode();
          renderThemeGrid();
          renderRecent();
          toast('邮件主题设置已保存', 'success');
        } catch (e) {
          toast(e.message, 'error');
          await loadThemes();
        }
      };

      const loadThemes = async () => {
        try {
          mtState = await api.get('/admin/mail/themes');
        } catch (e) {
          /* 读不到就保持默认展示 */
        }
        renderMode();
        renderThemeGrid();
        renderKinds();
        renderRecent();
      };

      const loadPreview = () => {
        const frame = $('#mt-preview');
        const kind = $('#mt-kind');
        if (!frame) return;
        frame.src = `/api/admin/mail/preview?theme=${encodeURIComponent(previewTheme)}&kind=${encodeURIComponent(
          (kind && kind.value) || 'reminderSat'
        )}&t=${Date.now()}`;
      };

      await loadThemes();
      loadPreview();

      document.querySelectorAll('#mt-mode [data-mode]').forEach((b) => {
        b.onclick = () => saveThemes({ mode: b.dataset.mode });
      });
      $('#mt-kind').onchange = loadPreview;
      $('#mt-refresh').onclick = loadPreview;

      $('#mt-send').onclick = async () => {
        const btn = $('#mt-send');
        const out = $('#mt-result');
        btn.disabled = true;
        btn.textContent = '发送中…';
        out.textContent = '';
        try {
          const r = await api.post('/admin/mail/preview/send', {
            kind: $('#mt-kind').value,
            theme: previewTheme,
            to: $('#mt-to').value.trim()
          });
          out.textContent = `已发送到 ${r.to}（主题 ${r.themeName || r.theme}）`;
          toast('测试邮件已发送', 'success');
          loadThemes();
        } catch (e) {
          out.textContent = e.message;
          toast(e.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = '发送测试邮件';
        }
      };

      $('#sm-test').onclick = async () => {
        const btn = $('#sm-test');
        const out = $('#sm-result');
        btn.disabled = true;
        btn.textContent = '测试中…';
        out.textContent = '';
        try {
          // 先保存再测
          await api.put('/admin/smtp', collect());
          const r = await api.post('/admin/smtp/test', {});
          if (r.ok) {
            out.innerHTML = `<span style="color:var(--success)">✓ 连接成功</span> ${esc(r.host)}:${r.port} · ${esc(r.user)}`;
            toast('SMTP 连接成功', 'success');
          } else {
            out.innerHTML = `<span style="color:var(--danger)">✗ ${esc(r.error || '连接失败')}</span>`;
            toast('连接失败：' + (r.error || ''), 'error');
          }
        } catch (e) {
          out.innerHTML = `<span style="color:var(--danger)">✗ ${esc(e.message)}</span>`;
        } finally {
          btn.disabled = false;
          btn.textContent = '测试连接';
        }
      };
      return;
    }

    if (tab === 'mail') {
      const rec = await api.get('/admin/mail/recipients');
      const members = rec.items || [];
      body.innerHTML = `
        <div class="Box">
          <div class="Box-header">邮件群发 <span class="chip">手动活动 / 通知</span></div>
          <div style="padding:16px">
            <div class="gh-field"><label for="mail-subject">邮件主题</label>
              <input class="input" id="mail-subject" maxlength="120" placeholder="例如：本周技术分享会报名开启" /></div>
            <div class="gh-field"><label for="mail-format">格式</label>
              <div style="display:flex;gap:16px;font-size:13px">
                <label style="cursor:pointer"><input type="radio" name="mail-fmt" value="text" checked style="margin-right:5px" />纯文本</label>
                <label style="cursor:pointer"><input type="radio" name="mail-fmt" value="html" style="margin-right:5px" />HTML</label>
              </div>
              <div class="hint">HTML 格式可以直接写邮件正文 HTML；纯文本按行分段发送</div>
            </div>
            <div class="gh-field"><label for="mail-body">邮件内容</label>
              <textarea class="textarea" id="mail-body" style="min-height:180px" placeholder="输入邮件正文"></textarea></div>
            <div class="gh-field"><label>收件人</label>
              <div style="display:flex;gap:16px;font-size:13px;margin-bottom:8px">
                <label style="cursor:pointer"><input type="radio" name="mail-rc" value="all" checked style="margin-right:5px" />全部成员（${members.length} 人）</label>
                <label style="cursor:pointer"><input type="radio" name="mail-rc" value="selected" style="margin-right:5px" />指定成员</label>
              </div>
              <div class="member-picker" id="mail-members" hidden>
                ${members.map((m) => `<label class="pick"><input type="checkbox" value="${m.id}" /><span>${esc(m.displayName)}</span><em>@${esc(m.username)}</em></label>`).join('')}
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="btn primary" id="mail-send">发送邮件</button>
              <span class="hint" id="mail-result"></span>
            </div>
            <div class="hint" style="margin-top:10px">发送记录写入审计日志（admin_mail_broadcast）</div>
          </div>
        </div>`;

      const picker = $('#mail-members');
      document.querySelectorAll('input[name="mail-rc"]').forEach((r) => {
        r.onchange = () => { picker.hidden = document.querySelector('input[name="mail-rc"]:checked').value !== 'selected'; };
      });

      $('#mail-send').onclick = async () => {
        const btn = $('#mail-send');
        const fmt = document.querySelector('input[name="mail-fmt"]:checked').value;
        const rc = document.querySelector('input[name="mail-rc"]:checked').value;
        const ids = rc === 'selected'
          ? [...picker.querySelectorAll('input:checked')].map((x) => Number(x.value))
          : [];
        const ok = await confirmDialog({
          title: '发送邮件？',
          message: `主题：${$('#mail-subject').value.trim()}\n收件人：${rc === 'all' ? '全部成员' : ids.length + ' 人'}\n格式：${fmt.toUpperCase()}`,
          okText: '发送'
        });
        if (!ok) return;
        btn.disabled = true;
        btn.textContent = '发送中…';
        try {
          const r = await api.post('/admin/mail/send', {
            subject: $('#mail-subject').value.trim(),
            body: $('#mail-body').value,
            format: fmt,
            recipients: rc,
            ids
          });
          $('#mail-result').textContent = `成功 ${r.sent} / 失败 ${r.failed}`;
          toast(`群发完成：${r.targets} 人，成功 ${r.sent}，失败 ${r.failed}`, 'success');
          btn.disabled = false;
          btn.textContent = '发送邮件';
        } catch (e) {
          toast(e.message, 'error');
          btn.disabled = false;
          btn.textContent = '发送邮件';
        }
      };
      return;
    }

    if (tab === 'settings') {
      const cfg = await api.get('/admin/settings');
      body.innerHTML = `
        <div class="Box" style="margin-bottom:16px">
          <div class="Box-header">平台品牌</div>
          <div class="row" style="max-width:680px">
            <div class="field"><label for="sname">平台名称</label>
              <input class="input" id="sname" maxlength="20" value="${esc(cfg.siteName)}" />
              <div class="hint">显示在浏览器标题、顶栏与邮件中</div></div>
            <div class="field"><label for="s-tagline">平台标语</label>
              <input class="input" id="s-tagline" maxlength="60" value="${esc(cfg.siteTagline || '')}" placeholder="记录每一次学习，见证每一步成长" />
              <div class="hint">登录页与首页顶栏的一句介绍</div></div>
          </div>
          <div class="field" style="max-width:680px"><label for="s-desc">平台简介</label>
            <textarea class="textarea" id="s-desc" maxlength="200" style="min-height:60px" placeholder="一句话介绍这个平台（可选）">${esc(cfg.siteDescription || '')}</textarea></div>
          <div class="row" style="max-width:680px">
            <div class="field"><label for="s-icp">ICP 备案号（可选）</label>
              <input class="input" id="s-icp" maxlength="60" value="${esc(cfg.siteIcp || '')}" placeholder="桂ICP备xxxxxxxx号" /></div>
            <div class="field"><label>平台 Logo</label>
              <div style="display:flex;gap:8px;align-items:center">
                <div id="settings-logo-preview">${brandMark('', 34)}</div>
                <button class="btn sm" type="button" id="settings-logo-pick">上传 Logo</button>
                <button class="btn sm ghost" type="button" id="settings-logo-clear">恢复默认</button>
              </div>
              <div class="hint">png / jpg / webp，≤2MB，建议正方形；在「邮件设置」下方也可管理</div></div>
          </div>
        </div>

        <div class="Box" style="margin-bottom:16px">
          <div class="Box-header">界面与公告</div>
          <div class="row" style="max-width:680px">
            <div class="field"><label for="s-ui">界面风格</label>
              <select class="select" id="s-ui">
                <option value="zhihu" ${(cfg.uiStyle || 'zhihu') === 'zhihu' ? 'selected' : ''}>知乎风格（信息流）</option>
                <option value="github" ${cfg.uiStyle === 'github' ? 'selected' : ''}>GitHub 风格（侧边栏）</option>
              </select>
              <div class="hint">保存后立即切换，可随时切回</div>
            </div>
            <div class="field"><label for="s-avatar-provider">默认头像样式（未上传头像的成员）</label>
              <select class="select" id="s-avatar-provider">
                <option value="letter" ${(cfg.defaultAvatarProvider || 'letter') === 'letter' ? 'selected' : ''}>首字 + 底色</option>
                <option value="github" ${cfg.defaultAvatarProvider === 'github' ? 'selected' : ''}>GitHub 像素头像（按用户名生成）</option>
              </select>
            </div>
          </div>
          <div class="field" style="max-width:680px;margin-bottom:12px">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px">
              <input type="checkbox" id="s-ui-lock" ${cfg.uiLocked ? 'checked' : ''} />
              锁定界面风格（所有成员使用当前风格，顶栏切换按钮隐藏）
            </label>
          </div>
          <div class="field" style="max-width:680px"><label for="s-notice">登录页公告</label>
            <textarea class="textarea" id="snotice" maxlength="200" style="min-height:70px" placeholder="留空则不显示">${esc(cfg.siteNotice)}</textarea></div>
          <div class="setting-row" style="max-width:680px">
            <div class="meta"><b>评论邮件通知</b><span>有人评论周报时给作者发一封邮件；同一人 1 分钟内在同一篇下最多发 3 封</span></div>
            <input type="checkbox" id="s-comment-mail" ${cfg.commentMail ? 'checked' : ''} style="width:18px;height:18px" />
          </div>
        </div>

        <div class="Box" style="margin-bottom:16px">
          <div class="Box-header">用户策略</div>
          <div class="row" style="max-width:680px">
            <div class="field"><label for="sreg">开放注册</label>
              <select class="select" id="sreg">
                <option value="1" ${cfg.allowRegister ? 'selected' : ''}>允许注册</option>
                <option value="0" ${cfg.allowRegister ? '' : 'selected'}>关闭注册（仅管理员添加）</option>
              </select>
            </div>
            <div class="field"><label for="s-auto-activate">注册激活方式</label>
              <select class="select" id="s-auto-activate">
                <option value="1" ${cfg.registerAutoActivate !== false ? 'selected' : ''}>自动激活（无需邮箱验证）</option>
                <option value="0" ${cfg.registerAutoActivate === false ? 'selected' : ''}>邮箱验证激活（填对邮箱验证码即可用）</option>
              </select>
              <div class="hint">邮箱验证激活需要开启下方邮箱功能；激活后是否要管理员审核由下一项决定</div>
            </div>
            <div class="field"><label for="s-need-review">管理员审核</label>
              <select class="select" id="s-need-review">
                <option value="0" ${cfg.registerNeedReview !== true ? 'selected' : ''}>不需要（注册完成即可登录）</option>
                <option value="1" ${cfg.registerNeedReview === true ? 'selected' : ''}>需要（注册后待审核，管理员激活后才能登录）</option>
              </select>
              <div class="hint">独立于激活方式：自动激活也可以要求管理员审核</div>
            </div>
            <div class="field"><label for="s-email-enabled">邮箱功能</label>
              <select class="select" id="s-email-enabled">
                <option value="1" ${cfg.emailEnabled !== false ? 'selected' : ''}>开启（注册验证 / 找回密码 / 通知）</option>
                <option value="0" ${cfg.emailEnabled === false ? 'selected' : ''}>关闭（无 SMTP 场景）</option>
              </select>
              <div class="hint">关闭后：注册跳过邮箱验证；忘记密码提示联系管理员</div>
            </div>
          </div>
          <div class="row" style="max-width:680px">
            <div class="field"><label for="s-domain-mode">邮箱域名限制</label>
              <select class="select" id="s-domain-mode">
                <option value="off" ${(cfg.registerDomainMode || 'off') === 'off' ? 'selected' : ''}>不限制</option>
                <option value="allow" ${cfg.registerDomainMode === 'allow' ? 'selected' : ''}>白名单（仅允许以下域名）</option>
                <option value="deny" ${cfg.registerDomainMode === 'deny' ? 'selected' : ''}>黑名单（禁止以下域名）</option>
              </select>
            </div>
            <div class="field"><label for="s-domains">域名列表</label>
              <input class="input" id="s-domains" value="${esc(cfg.registerEmailDomains || '')}" placeholder="example.com, example.com" />
              <div class="hint">多个域名用逗号分隔，支持 @域名 或 .域名（含子域）</div>
            </div>
          </div>
          <div style="padding:0 16px 16px"><button class="btn primary sm" id="s-save">保存全部设置</button></div>
        </div>

        <div class="Box" style="margin-bottom:16px">
          <div class="Box-header">弹窗公告</div>
          <div style="padding:16px">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:12px">
              <input type="checkbox" id="nm-on" ${cfg.modalNotice && cfg.modalNotice.enabled ? 'checked' : ''} />
              启用弹窗（成员进入系统时弹一次，点「知道了」后同版本不再弹）
            </label>
            <div class="gh-field"><label for="nm-title">标题</label>
              <input class="input" id="nm-title" maxlength="60" value="${esc((cfg.modalNotice && cfg.modalNotice.title) || '')}" placeholder="例如：本周技术分享会报名开启" /></div>
            <div class="gh-field"><label for="nm-body">内容（支持 Markdown）</label>
              <textarea class="textarea" id="nm-body" maxlength="800" style="min-height:90px" placeholder="支持 **加粗**、## 标题、- 列表、> 引用、\`代码\`">${esc((cfg.modalNotice && cfg.modalNotice.body) || '')}</textarea></div>
            <div class="gh-field" style="margin-bottom:12px">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:4px">
                <input type="checkbox" id="nm-pin" ${cfg.modalNotice && cfg.modalNotice.pinned ? 'checked' : ''} />
                置顶（公告展开显示在首页右栏顶部）
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-size:13px">
                <input type="checkbox" id="nm-fold" ${cfg.modalNotice && cfg.modalNotice.pinned ? '' : 'checked'} />
                默认折叠（未置顶时收起为一行标题，点击展开）
              </label>
            </div>
            <button class="btn primary sm" id="nm-save">保存公告</button>
            <div class="hint" style="margin-top:8px">保存后版本号自动更新，成员下次进入会重新看到一次。</div>
          </div>
        </div>

        <div class="Box" style="margin-bottom:16px">
          <div class="Box-header">站点 Logo</div>
          <div class="avatar-uploader">
            <div id="logo-preview">${brandMark('', 48)}</div>
            <div class="avatar-actions">
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn sm" type="button" id="logo-pick">上传 Logo</button>
                <button class="btn sm ghost" type="button" id="logo-clear">恢复默认</button>
              </div>
              <div class="hint" style="margin-top:6px">png / jpg / webp，≤ 2MB，建议正方形（推荐 256×256）</div>
            </div>
          </div>
          <input type="file" id="logo-file" accept="image/png,image/jpeg,image/webp" hidden />
        </div>

        <div class="Box">
          <div class="Box-header">周次设置</div>
          <div class="row" style="max-width:520px">
            <div class="field"><label for="wb-start">起始周（周一日期）</label><input type="date" class="input" id="wb-start" value="${esc(cfg.weekBase.start)}" /></div>
            <div class="field"><label for="wb-num">该周记为第几周</label><input type="number" class="input" id="wb-num" min="1" max="60" value="${esc(String(cfg.weekBase.num))}" /></div>
          </div>
          <div style="padding:0 16px 16px"><button class="btn primary sm" id="wb-save">保存周次</button>
          <div class="hint" style="margin-top:8px">例如起始周 2026-09-14 记为第 1 周，则 11-23 是第 11 周（默认值可在 appsettings.json 的 week 段改）。</div>
        </div>`;

      $('#s-save').onclick = async () => {
        try {
          const res = await api.put('/admin/settings', {
            siteName: $('#sname').value.trim(),
            siteTagline: $('#s-tagline') ? $('#s-tagline').value.trim() : undefined,
            siteDescription: $('#s-desc') ? $('#s-desc').value.trim() : undefined,
            siteIcp: $('#s-icp') ? $('#s-icp').value.trim() : undefined,
            siteNotice: $('#snotice').value.trim(),
            allowRegister: $('#sreg').value === '1',
            registerAutoActivate: $('#s-auto-activate') ? $('#s-auto-activate').value === '1' : undefined,
            registerNeedReview: $('#s-need-review') ? $('#s-need-review').value === '1' : undefined,
            emailEnabled: $('#s-email-enabled') ? $('#s-email-enabled').value === '1' : undefined,
            registerDomainMode: $('#s-domain-mode') ? $('#s-domain-mode').value : undefined,
            registerEmailDomains: $('#s-domains') ? $('#s-domains').value.trim() : undefined,
            commentMail: $('#s-comment-mail').checked,
            uiStyle: $('#s-ui') ? $('#s-ui').value : undefined,
            uiLocked: $('#s-ui-lock') ? $('#s-ui-lock').checked : undefined,
            defaultAvatarProvider: $('#s-avatar-provider') ? $('#s-avatar-provider').value : undefined
          });
          state.site = Object.assign({}, state.site, res, { siteName: res.siteName, siteNotice: res.siteNotice, allowRegister: res.allowRegister });
          toast('站点设置已保存', 'success');
          if (res.uiStyle) {
            applyUiStyle();
            renderShell();
            markNav('admin');
            navigate();
          }
        } catch (e) {
          toast(e.message, 'error');
        }
      };

      const nmSave = $('#nm-save');
      if (nmSave) {
        nmSave.onclick = async () => {
          try {
            await api.put('/admin/settings', {
              modalNotice: {
                enabled: $('#nm-on').checked,
                title: $('#nm-title').value.trim(),
                body: $('#nm-body').value,
                pinned: $('#nm-pin').checked
              }
            });
            const fresh = await api.get('/site');
            state.site = Object.assign({}, state.site, fresh);
            toast('弹窗公告已保存', 'success');
            // 停留在当前页，弹出预览确认效果
            setTimeout(() => maybeShowNotice({ force: true, afterClose: () => navigate() }), 350);
          } catch (e) {
            toast(e.message, 'error');
          }
        };
      }

      const logoFile = $('#logo-file');
      if (logoFile) {
        const pickers = [$('#logo-pick'), $('#settings-logo-pick')].filter(Boolean);
        pickers.forEach((p) => { p.onclick = () => logoFile.click(); });
        logoFile.onchange = async () => {
          const f = logoFile.files && logoFile.files[0];
          if (!f) return;
          const fd = new FormData();
          fd.append('logo', f, f.name || 'logo.png');
          try {
            const res = await api.upload('/admin/logo', fd);
            state.site = Object.assign({}, state.site, res.site);
            toast('Logo 已更新', 'success');
            renderShell();
            markNav('admin');
            navigate();
          } catch (e) {
            toast(e.message, 'error');
          } finally {
            logoFile.value = '';
          }
        };
        const clears = [$('#logo-clear'), $('#settings-logo-clear')].filter(Boolean);
        clears.forEach((btn) => { btn.onclick = async () => {
          try {
            const res = await api.del('/admin/logo');
            state.site = Object.assign({}, state.site, res.site);
            toast('已恢复默认 Logo', 'success');
            renderShell();
            markNav('admin');
            navigate();
          } catch (e) {
            toast(e.message, 'error');
          }
        }; });
      }

      $('#wb-save').onclick = async () => {
        try {
          const res = await api.put('/admin/week-base', { start: $('#wb-start').value, num: $('#wb-num').value });
          state.weekBase = { start: res.start, num: res.num };
          toast('周次设置已保存', 'success');
        } catch (e) {
          toast(e.message, 'error');
        }
      };
      return;
    }

    const s = await api.get('/admin/stats');
    const max = Math.max(1, ...s.weekTrend.map((t) => t.count));
    body.innerHTML = `
      <div class="stat-grid">
        <div class="stat"><div class="label">注册用户</div><div class="value">${s.users}<small>人</small></div><div class="foot">${s.activeUsers} 个正常状态</div></div>
        <div class="stat"><div class="label">本周提交</div><div class="value">${s.weekReports}<small>篇</small></div><div class="foot">累计 ${s.reports} 篇</div></div>
        <div class="stat"><div class="label">帖子 / 评论</div><div class="value">${s.posts}<small>/${s.comments}</small></div><div class="foot">社区互动总量</div></div>
        <div class="stat"><div class="label">累计字数</div><div class="value">${fmtChars(s.totalChars)}</div><div class="foot">全体成员合计</div></div>
      </div>
      <div class="Box" style="margin-top:16px">
        <div class="Box-header">近 8 周提交趋势</div>
        <div class="trend">
          ${s.weekTrend
            .map(
              (t) => `<div class="col">
                <div style="font-size:11.5px;color:var(--text-2)">${t.count}</div>
                <div class="bar2" style="height:${Math.max(4, (t.count / max) * 78)}%"></div>
                <div class="lb">${fmtShort(t.week)}</div>
              </div>`
            )
            .join('')}
        </div>
      </div>

      <div class="card pad log-entry" style="margin-top:16px">
        <div class="log-entry-icon">📋</div>
        <div class="grow">
          <div style="font-weight:650">系统日志</div>
          <div style="font-size:12.5px;color:var(--muted)">
            登录、登录失败、评论、发信、资料变更、管理操作都在这里 · 今日 ${logsBadge} 条
          </div>
        </div>
        <a class="btn primary" href="#/admin?tab=logs">查看日志 →</a>
      </div>`;
  }

  /* ================= 启动 ================= */
  async function boot() {
    applyAccent(ls.get('wrs-accent', 'blue'));
    // 先用上次的皮肤渲染，避免首屏闪一下另一套
    document.documentElement.dataset.ui = ls.get('wsec-ui', 'zhihu');
    applyUiStyle();
    window.__onUnauthorized = () => {
      if (!state.user) return;
      state.user = null;
      renderAuth('login');
    };
    // 代码块「复制」按钮（Markdown 周报正文）
    // 列表内点赞：不跳转，就地更新计数
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest && e.target.closest('[data-like]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.dataset.like;
    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';
    try {
      const res = await api.post(`/reports/${id}/like`);
      const n = btn.querySelector('[data-like-n]');
      if (n) n.textContent = res.likes;
      btn.classList.toggle('liked', !!res.liked);
    } catch (err) {
      /* 静默失败：不打断浏览 */
    } finally {
      setTimeout(() => { btn.dataset.busy = ''; }, 400);
    }
  }, true);

  document.addEventListener('click', (e) => {
    const j = e.target.closest && e.target.closest('[data-jump]');
    if (j) state.jumpTo = j.dataset.jump;
  }, true);
  document.addEventListener('click', (e) => {
      const cb = e.target && e.target.closest ? e.target.closest('.code-copy') : null;
      if (!cb) return;
      const block = cb.closest('.code-block');
      const code = block && block.querySelector('code');
      if (!code) return;
      // 有行号结构时只取 .code-txt 的正文，避免复制进行号和 $ 提示符
      const lines = block.querySelectorAll('.code-txt');
      const text = lines.length
        ? [...lines].map((l) => l.textContent.replace(/^\$ /, '')).join('\n')
        : code.textContent;
      const done = () => {
        cb.textContent = '已复制';
        setTimeout(() => (cb.textContent = '复制'), 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
      } else {
        fallbackCopy(text, done);
      }
    });
    // Markdown：图片点击放大 / 代码折叠 / 锚点复制
    document.addEventListener('click', (e) => {
      if (!e.target || !e.target.closest) return;
      const img = e.target.closest('.prose img');
      if (img) {
        img.classList.toggle('md-zoomed');
        return;
      }
      const foldBtn = e.target.closest('[data-code-fold]');
      if (foldBtn) {
        const block = foldBtn.closest('.code-block');
        const body = block && block.querySelector('.code-fold-body');
        if (body) {
          body.hidden = !body.hidden;
          foldBtn.textContent = body.hidden ? '展开' : '收起';
        }
        return;
      }
      const anchor = e.target.closest('.h-anchor');
      if (anchor) {
        const id = anchor.dataset.anchor;
        const url = location.href.split('#')[0] + '#' + id;
        const done = () => toast('标题链接已复制', 'success');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
        } else fallbackCopy(url, done);
      }
    });
    document.addEventListener('click', (e) => {
      const fb = e.target && e.target.closest ? e.target.closest('[data-fold]') : null;
      if (!fb) return;
      const card = fb.closest('.notice-card, .rail-item');
      const bodyEl = card && card.querySelector('.notice-side-body, .notice-rail-body');
      if (!bodyEl) return;
      bodyEl.classList.toggle('folded');
      fb.textContent = bodyEl.classList.contains('folded') ? '▸' : '▾';
      const version = (state.site && state.site.modalNotice && state.site.modalNotice.version) || '1';
      ls.set('wsec-notice-fold-' + version, bodyEl.classList.contains('folded') ? '1' : '0');
    });
    window.addEventListener('hashchange', () => {
      if (state.user) navigate();
    });
    // 头像点击 → 个人主页（捕获阶段拦下，避免卡片/评论自身的链接先跳走）
    document.addEventListener(
      'click',
      (e) => {
        const av = e.target && e.target.closest ? e.target.closest('.avatar[data-uid]') : null;
        if (!av || av.closest('.avatar-uploader') || av.closest('.user-menu')) return;
        const uid = Number(av.dataset.uid) || 0;
        if (!uid) return;
        e.preventDefault();
        e.stopPropagation();
        location.hash = '#/u/' + uid;
      },
      true
    );

    try {
      const { user } = await api.get('/auth/me');
      state.user = user;
    } catch (e) {
      state.user = null;
    }
    try {
      state.site = await api.get('/site');
    } catch (e) {
      /* 用默认值 */
    }
    // 版本号（顶部/设置页/登录页展示）
    try {
      const h = await api.get('/health');
      state.version = (h && h.version) || '';
      document.documentElement.dataset.appVersion = state.version;
      fillVersion();
    } catch (e) {
      state.version = '';
    }

    if (!state.user) {
      renderAuth('login');
      return;
    }
    await loadWeekBase();
    renderShell();
    await navigate();
    refreshUnread();
    setTimeout(maybeShowNotice, 400);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();