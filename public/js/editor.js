/* 富文本编辑器（Markdown 存储）
 * - 默认所见即所得（contenteditable），保存时序列化回 Markdown
 * - 工具条「富文本 / 源码」可切换，源码模式还是原来的 textarea
 * - 粘帖：图片自动上传、富文本 HTML 经白名单清洗后插入、纯文本按字面量插入
 * - 序列化只覆盖本站渲染器支持的 Markdown 子集（标题/粗斜体/删除线/列表/引用/代码/链接/图片）
 */
(function () {
  'use strict';

  const IMG_PATH = /^\/api\/(?:uploads|attachments)\/\d+$/;
  const SAFE_HREF = /^https?:\/\//i;

  /* ============================ HTML → Markdown ============================ */
  function escapeText(str) {
    let s = String(str == null ? '' : str);
    // 行内特殊字符一律转义，渲染器支持 \X
    s = s.replace(/[\\*_~`\[\]]/g, (c) => '\\' + c);
    // 行首可能被当成块语法的情况
    s = s.replace(/^(\s*)(#{1,6}\s|>|\+|-|\d+\.\s)/, (m, pre, mark) => pre + '\\' + mark);
    return s;
  }

  function attr(node, name) {
    return node && node.getAttribute ? node.getAttribute(name) || '' : '';
  }

  /** 把节点内部序列化成行内 Markdown */
  function inlineMd(node, skipTag) {
    let out = '';
    for (const child of node.childNodes || []) {
      if (child.nodeType === 3) {
        out += escapeText(child.nodeValue);
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (skipTag && skipTag === tag) continue;
      switch (tag) {
        case 'br':
          out += '\n';
          break;
        case 'strong':
        case 'b':
          out += `**${inlineMd(child)}**`;
          break;
        case 'em':
        case 'i':
          out += `*${inlineMd(child)}*`;
          break;
        case 'del':
        case 's':
        case 'strike':
          out += `~~${inlineMd(child)}~~`;
          break;
        case 'code':
          out += '`' + child.textContent.replace(/`/g, "'") + '`';
          break;
        case 'a': {
          const href = attr(child, 'href');
          const text = inlineMd(child) || escapeText(href);
          out += SAFE_HREF.test(href) ? `[${text}](${href})` : text;
          break;
        }
        case 'img': {
          const src = attr(child, 'src');
          if (IMG_PATH.test(src)) {
            const alt = attr(child, 'alt').replace(/[[\]\n]/g, '').slice(0, 80);
            out += `![${alt}](${src})`;
          }
          break;
        }
        case 'hr':
          out += '\n\n---\n\n';
          break;
        case 'mark':
          out += `==${inlineMd(child)}==`;
          break;
        case 'span': {
          const cls = child.classList || { contains: () => false };
          // 未上传的本地图片占位符：原样还原 Markdown，交给上层补传
          if (cls.contains('md-img-missing')) {
            const src = attr(child, 'data-src');
            out += attr(child, 'data-wiki') === '1' && src ? `![[${src}]]` : child.textContent;
          } else if (cls.contains('wiki-link')) {
            // [[笔记]] / [[笔记|别名]] / [[笔记#小节]]
            const note = attr(child, 'data-note') || child.textContent;
            const label = child.textContent.replace(/\s*\u203a\s*/g, '#');
            out += label && label !== note ? `[[${note}|${label}]]` : `[[${note}]]`;
          } else if (cls.contains('task-box')) {
            out += ''; // 任务框由 listMd 统一还原成 - [ ] / - [x]
          } else {
            out += inlineMd(child);
          }
          break;
        }
        default:
          out += inlineMd(child, skipTag);
      }
    }
    return out;
  }

  function listMd(listEl, depth, ordered) {
    const lines = [];
    let idx = ordered ? Number(listEl.getAttribute('start')) || 1 : 1;
    for (const li of listEl.children || []) {
      if (li.tagName.toLowerCase() !== 'li') continue;
      const pad = '  '.repeat(depth);
      const marker = ordered ? `${idx++}. ` : '- ';
      const text = inlineMd(li, 'ul')
        .replace(/\n{2,}/g, '\n')
        .trim();
      const box = li.querySelector('.task-box');
      if (box) {
        const done = box.classList.contains('done');
        lines.push(pad + (ordered ? `${idx - 1}. ` : '- ') + `[${done ? 'x' : ' '}] ` + text);
        continue;
      }
      lines.push(pad + marker + text);
      for (const sub of li.children || []) {
        const t = sub.tagName.toLowerCase();
        if (t === 'ul' || t === 'ol') lines.push(listMd(sub, depth + 1, t === 'ol'));
      }
    }
    return lines.join('\n');
  }

  /** 把编辑区顶层节点序列化成 Markdown 块 */
  function blocksMd(root) {
    const lines = [];
    for (const child of root.childNodes || []) {
      if (child.nodeType === 3) {
        const t = child.nodeValue.replace(/\u00a0/g, ' ').trim();
        if (t) lines.push(escapeText(t));
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        lines.push('#'.repeat(Number(tag[1])) + ' ' + inlineMd(child).trim());
        continue;
      }
      if (tag === 'ul' || tag === 'ol') {
        const l = listMd(child, 0, tag === 'ol');
        if (l) lines.push(l);
        continue;
      }
      if (tag === 'blockquote') {
        const inner = blocksMd(child).split('\n').filter((x) => x.trim() !== '' || false);
        lines.push(inner.map((x) => (x ? `> ${x}` : '>')).join('\n'));
        continue;
      }
      if (tag === 'pre') {
        const codeEl = child.querySelector('code');
        const code = (codeEl ? codeEl.textContent : child.textContent).replace(/\n+$/, '');
        lines.push('```\n' + code + '\n```');
        continue;
      }
      if (tag === 'table') {
        const rows = [...child.querySelectorAll('tr')].map((tr) =>
          [...tr.children].map((cell) => inlineMd(cell).replace(/\n+/g, ' ').trim())
        );
        if (rows.length) {
          const cols = Math.max(...rows.map((r) => r.length));
          const pad = (r) => {
            const copy = r.slice();
            while (copy.length < cols) copy.push('');
            return copy;
          };
          const head = pad(rows[0]);
          const sep = head.map(() => '---');
          const body = rows.slice(1).map((r) => pad(r));
          const cell = (c) => String(c).replace(/\|/g, '\\|');
          lines.push(
            [head, sep, ...body].map((r) => '| ' + r.map(cell).join(' | ') + ' |').join('\n')
          );
        }
        continue;
      }
      if (tag === 'hr') {
        lines.push('---');
        continue;
      }
      if (tag === 'img') {
        const md = inlineMd({ childNodes: [child] });
        if (md) lines.push(md);
        continue;
      }
      if (tag === 'div' && child.classList && child.classList.contains('callout')) {
        const m = (child.className || '').match(/callout-([a-z0-9-]+)/);
        const type = m ? m[1] : 'note';
        const titleEl = child.querySelector('.callout-title');
        const bodyEl = child.querySelector('.callout-body');
        const title = titleEl ? inlineMd(titleEl).trim() : '';
        const body = bodyEl ? blocksMd(bodyEl) : '';
        const head = `> [!${type}]${title ? ' ' + title : ''}`;
        const bodyLines = body ? body.split('\n').map((x) => (x.trim() ? `> ${x}` : '>')) : [];
        lines.push([head, ...bodyLines].join('\n'));
        continue;
      }
      if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
        // div 里若还套着块级元素（含表格容器），递归展开
        if (child.querySelector('p,div,ul,ol,blockquote,pre,h1,h2,h3,h4,h5,h6,table')) {
          const inner = blocksMd(child);
          if (inner) lines.push(inner);
          continue;
        }
        const t = inlineMd(child).replace(/\n+$/, '');
        if (t.trim()) lines.push(t);
        continue;
      }
      const t = inlineMd(child).trim();
      if (t) lines.push(t);
    }
    return lines.filter((x) => x !== '').join('\n\n');
  }

  function htmlToMarkdown(root) {
    return blocksMd(root).replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
  }

  /* ============================ 粘帖内容清洗 ============================ */
  const ALLOWED_TAGS = new Set([
    'P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'STRONG', 'B', 'EM', 'I', 'DEL', 'S', 'STRIKE', 'CODE', 'PRE',
    'BLOCKQUOTE', 'UL', 'OL', 'LI', 'A', 'IMG', 'HR', 'SPAN',
    'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD'
  ]);

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** 只保留白名单标签/属性，丢弃脚本、样式、事件属性与外链图片 */
  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const out = doc.createElement('div');
    const walk = (src, dst) => {
      for (const node of src.childNodes) {
        if (node.nodeType === 3) {
          dst.appendChild(doc.createTextNode(node.nodeValue));
          continue;
        }
        if (node.nodeType !== 1) continue;
        let tag = node.tagName.toUpperCase();
        if (tag === 'STYLE' || tag === 'SCRIPT' || tag === 'META' || tag === 'LINK') continue;
        if (tag === 'B') tag = 'STRONG';
        if (tag === 'I') tag = 'EM';
        if (tag === 'S' || tag === 'STRIKE') tag = 'DEL';
        if (!ALLOWED_TAGS.has(tag)) {
          walk(node, dst);
          continue;
        }
        if (tag === 'IMG') {
          const src2 = node.getAttribute('src') || '';
          if (!IMG_PATH.test(src2)) continue;
          const img = doc.createElement('img');
          img.setAttribute('src', src2);
          img.setAttribute('alt', (node.getAttribute('alt') || '').slice(0, 120));
          dst.appendChild(img);
          continue;
        }
        const el = doc.createElement(tag.toLowerCase());
        if (tag === 'A') {
          const href = node.getAttribute('href') || '';
          if (!SAFE_HREF.test(href)) {
            walk(node, dst);
            continue;
          }
          el.setAttribute('href', href);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer nofollow');
        }
        walk(node, el);
        dst.appendChild(el);
      }
    };
    walk(doc.body, out);
    return out.innerHTML;
  }

  /* ============================ 编辑器 ============================ */
  /** 粗判一段纯文本是不是 Markdown（用来决定粘贴后是否直接渲染） */
  function looksLikeMarkdown(text) {
    const t = String(text || '');
    if (!t.trim()) return false;
    if (/```/.test(t)) return true;
    if (/^\s{0,3}#{1,6}\s+\S/m.test(t)) return true;
    if (/^\s*!\[[^\]]*\]\([^)]*\)/m.test(t)) return true;
    if (/\n\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*(\n|$)/.test(t)) return true;
    let hits = 0;
    for (const line of t.split(/\r?\n/)) {
      if (/^\s*[-*+]\s+\S/.test(line) || /^\s*\d+\.\s+\S/.test(line) || /^\s*>\s?\S/.test(line)) hits += 1;
    }
    return hits >= 2;
  }

  function saveRange(root) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    return root.contains(r.commonAncestorContainer) ? r.cloneRange() : null;
  }

  function restoreRange(range) {
    if (!range) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function placeCaretEnd(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  function RichMarkdownEditor(ta, opts) {
    opts = opts || {};
    const md = window.mdToHtml;
    const getValue = () => (state.mode === 'rich' ? htmlToMarkdown(rich) : ta.value);

    // 默认推荐 Markdown 源码模式（所见即所得可通过工具栏切换）
    const state = { mode: 'source' };

    const rich = document.createElement('div');
    rich.className = 'md-rich prose';
    rich.contentEditable = 'true';
    rich.spellcheck = false;
    rich.setAttribute('role', 'textbox');
    rich.setAttribute('aria-multiline', 'true');
    rich.setAttribute('data-placeholder', opts.placeholder || '在这里写正文…');
    ta.insertAdjacentElement('beforebegin', rich);

    let timer = null;
    const flush = () => {
      if (state.mode !== 'rich') return;
      ta.value = htmlToMarkdown(rich);
      if (opts.onChange) opts.onChange(ta.value);
    };
    const scheduleFlush = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 180);
    };

    rich.addEventListener('input', scheduleFlush);
    rich.addEventListener('blur', flush);

    /* ---- 工具条：富文本 / 源码 ---- */
    const card = ta.closest('.card') || ta.parentElement;
    // 兼容新版工作台 .ew-toolbar 与旧版 .md-toolbar
    const ws = ta.closest('#editor-workspace');
    const toolbar = (ws && ws.querySelector('.ew-toolbar')) || (card && card.querySelector('.md-toolbar')) || null;
    let richBtn = null;
    let srcBtn = null;
    if (toolbar) {
      const wrap = document.createElement('span');
      wrap.className = 'md-mode-switch';
      wrap.innerHTML =
        '<button type="button" data-ed="rich" title="所见即所得">富文本</button>' +
        '<button type="button" data-ed="source" title="查看/编辑 Markdown 源码">源码</button>';
      toolbar.appendChild(wrap);
      richBtn = wrap.querySelector('[data-ed="rich"]');
      srcBtn = wrap.querySelector('[data-ed="source"]');
      richBtn.onclick = () => setMode('rich');
      srcBtn.onclick = () => setMode('source');
    }

    function paintMode() {
      const isRich = state.mode === 'rich';
      rich.hidden = !isRich;
      ta.hidden = isRich;
      if (richBtn) richBtn.classList.toggle('active', isRich);
      if (srcBtn) srcBtn.classList.toggle('active', !isRich);
      if (opts.onModeChange) opts.onModeChange(state.mode);
    }

    function setMode(mode) {
      if (mode === state.mode) return;
      if (mode === 'source') {
        // 富文本 → 源码：先把 DOM 序列化回 Markdown
        if (timer) clearTimeout(timer);
        ta.value = htmlToMarkdown(rich);
      } else {
        rich.innerHTML = md(ta.value);
      }
      state.mode = mode;
      paintMode();
      if (mode === 'rich') placeCaretEnd(rich);
      else ta.focus();
    }

    /* ---- 插入能力 ---- */
    function insertImageItem(item) {
      const html = `<img src="${escHtml(item.url)}" alt="${escHtml(
        String(item.filename || '图片').replace(/[\[\]\n]/g, '').slice(0, 80)
      )}">`;
      if (state.mode === 'rich') {
        rich.focus();
        document.execCommand('insertHTML', false, html);
        flush();
      } else {
        ta.value += (ta.value && !/\n$/.test(ta.value) ? '\n' : '') + `![图片](${item.url})\n`;
      }
    }

    function insertMarkdownText(mdText) {
      if (state.mode === 'rich') {
        rich.focus();
        document.execCommand('insertHTML', false, md(mdText));
        flush();
      } else {
        ta.value += mdText;
      }
    }

    function setValue(markdown) {
      ta.value = markdown == null ? '' : String(markdown);
      rich.innerHTML = md(ta.value);
      if (opts.onChange) opts.onChange(ta.value);
      // 通知外部（导入、清空等）：触发 input 事件让空提示/预览/图片提示同步刷新
      try {
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) { /* 忽略 */ }
    }

    /* ---- 工具条命令 ---- */
    function formatBlock(tag) {
      const cur = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
      document.execCommand('formatBlock', false, cur === tag ? 'p' : tag);
    }

    function exec(act) {
      if (state.mode !== 'rich') return false;
      rich.focus();
      switch (act) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
          formatBlock(act);
          break;
        case 'bold':
          document.execCommand('bold');
          break;
        case 'italic':
          document.execCommand('italic');
          break;
        case 'list':
          document.execCommand('insertUnorderedList');
          break;
        case 'quote':
          formatBlock('blockquote');
          break;
        case 'code': {
          const sel = window.getSelection();
          const text = sel ? sel.toString() : '';
          if (text) document.execCommand('insertHTML', false, `<code>${escHtml(text)}</code>`);
          else document.execCommand('insertHTML', false, '<code></code>');
          break;
        }
        case 'tpl':
          setValue(window.__MD_TEMPLATE || '');
          placeCaretEnd(rich);
          break;
        case 'table':
          document.execCommand(
            'insertHTML',
            false,
            '<table><thead><tr><th>列 1</th><th>列 2</th></tr></thead>' +
              '<tbody><tr><td>内容</td><td>内容</td></tr></tbody></table><p><br></p>'
          );
          break;
        default:
          return false;
      }
      scheduleFlush();
      return true;
    }

    /* ---- 粘帖 ---- */
    rich.addEventListener('paste', async (e) => {
      const dt = e.clipboardData;
      if (!dt) return;
      const files = [...(dt.files || [])].filter((f) => /^image\//.test(f.type || ''));
      if (files.length) {
        e.preventDefault();
        let range = saveRange(rich);
        for (const f of files) {
          try {
            const item = await opts.uploadImage(f);
            restoreRange(range);
            insertImageItem(item);
            range = saveRange(rich);
          } catch (err) {
            if (opts.onError) opts.onError(err.message || '图片上传失败');
          }
        }
        return;
      }
      const html = dt.getData('text/html');
      if (html) {
        e.preventDefault();
        const safe = sanitizeHtml(html);
        document.execCommand('insertHTML', false, safe);
        scheduleFlush();
        return;
      }
      const text = dt.getData('text/plain');
      if (text) {
        e.preventDefault();
        // 粘进来的是 Markdown 源码就直接渲染，避免整篇变成字面量
        if (looksLikeMarkdown(text)) {
          document.execCommand('insertHTML', false, md(text));
        } else {
          document.execCommand('insertText', false, text);
        }
        scheduleFlush();
      }
    });

    paintMode();
    if (String(ta.value || '').trim()) rich.innerHTML = md(ta.value);

    /* ---- 旧内容里遗留的转义（之前把 Markdown 当纯文本粘进来会变成 \#、\-）---- */
    const legacy = document.createElement('div');
    legacy.className = 'md-img-hint md-unescape-hint';
    legacy.hidden = true;
    rich.insertAdjacentElement('afterend', legacy);

    const escapedHits = () => {
      const v = String(ta.value || '');
      const re = /^\s*\\+(#{1,6}\s|[-*>+]\s|\d+\.\s)/gm;
      return (v.match(re) || []).length;
    };
    const checkLegacy = () => {
      const n = escapedHits();
      if (n < 2) {
        legacy.hidden = true;
        return;
      }
      legacy.hidden = false;
      legacy.innerHTML =
        `<span>检测到 ${n} 处被转义的行首标记（\`\\#\`、\`\\-\`），内容不会渲染成标题/列表</span>` +
        `<button type="button" class="btn sm" id="md-unescape">还原并重新渲染</button>`;
      const btn = legacy.querySelector('#md-unescape');
      if (btn) {
        btn.onclick = () => {
          const fixed = String(ta.value || '').replace(/^(\s*)\\+(#{1,6}\s|[-*>+]\s|\d+\.\s)/gm, '$1$2');
          setValue(fixed);
          legacy.hidden = true;
          if (opts.onNotice) opts.onNotice('已还原转义并重新渲染');
        };
      }
    };
    if (toolbar) {
      if (richBtn) richBtn.addEventListener('click', checkLegacy);
      if (srcBtn) srcBtn.addEventListener('click', checkLegacy);
    }
    ta.addEventListener('input', checkLegacy);
    checkLegacy();

    return {
      el: rich,
      get mode() {
        return state.mode;
      },
      setMode,
      getValue,
      setValue,
      insertImageItem,
      insertMarkdownText,
      exec,
      flush,
      focus: () => (state.mode === 'rich' ? rich.focus() : ta.focus())
    };
  }

  window.htmlToMarkdown = htmlToMarkdown;
  window.sanitizeHtml = sanitizeHtml;
  window.RichMarkdownEditor = RichMarkdownEditor;
})();

/* ============================================================
 * Vim 层（编辑器内）：Esc 进 normal，i/a 回 insert
 * 支持 h j k l 0 $ w b x dd gg G i a I A o O
 * 纯前端实现，不依赖任何库；只接管 #f-content / .md-rich 文本域
 * ============================================================ */
(function () {
  'use strict';
  if (window.__hjsecVim) return;
  window.__hjsecVim = true;

  var MODE_INSERT = 'insert';
  var MODE_NORMAL = 'normal';
  var mode = MODE_INSERT;
  // 默认关闭；Ctrl+Alt+V 切换，用 localStorage 记忆
  var ENABLED = false;
  try { ENABLED = localStorage.getItem('wrs-vim-editor') === '1'; } catch (e) {}
  window.__hjsecVimEnabled = ENABLED;

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      ENABLED = !ENABLED;
      window.__hjsecVimEnabled = ENABLED;
      try { localStorage.setItem('wrs-vim-editor', ENABLED ? '1' : '0'); } catch (err) {}
      mode = MODE_INSERT;
      var st = document.getElementById('vim-status');
      if (st) { st.textContent = ENABLED ? '-- INSERT --' : '-- VIM OFF --'; st.dataset.mode = ENABLED ? 'insert' : 'off'; }
      return;
    }
  }, true);
  var pending = '';           // 前缀键（g / d）
  var pendingTimer = null;

  function target(el) {
    if (!el) return null;
    if (el.tagName !== 'TEXTAREA') return null;
    if (el.id === 'f-content') return el;
    if (el.classList && el.classList.contains('md-rich')) return el;
    return null;
  }

  function badge(ta) {
    var box = document.getElementById('vim-status');
    if (!box) {
      box = document.createElement('div');
      box.id = 'vim-status';
      box.className = 'vim-status';
      document.body.appendChild(box);
    }
    var host = ta.closest('#editor-workspace') || document.body;
    if (box.parentElement !== host) host.appendChild(box);
    box.textContent = mode === MODE_NORMAL ? '-- NORMAL --' : (ENABLED ? '-- INSERT --' : '-- VIM OFF (Ctrl+Alt+V) --');
    box.dataset.mode = mode;
    box.classList.toggle('is-normal', mode === MODE_NORMAL);
    return box;
  }

  function setMode(next, ta) {
    mode = next;
    if (ta) badge(ta);
  }

  function lineStart(v, i) { var k = v.lastIndexOf('\n', i - 1); return k < 0 ? 0 : k + 1; }
  function lineEnd(v, i) { var k = v.indexOf('\n', i); return k < 0 ? v.length : k; }

  function moveTo(ta, pos) {
    ta.selectionStart = ta.selectionEnd = Math.max(0, Math.min(ta.value.length, pos));
  }

  function vimMove(ta, key, count) {
    var v = ta.value, i = ta.selectionStart, n = count || 1;
    for (var c = 0; c < n; c++) {
      if (key === 'h') i = Math.max(lineStart(v, i), i - 1);
      else if (key === 'l') i = Math.min(lineEnd(v, i), i + 1);
      else if (key === 'j') {
        var col = i - lineStart(v, i), e = lineEnd(v, i);
        if (e >= v.length) break;
        var ns = e + 1, ne = lineEnd(v, ns);
        i = Math.min(ns + col, ne);
      } else if (key === 'k') {
        var col2 = i - lineStart(v, i), s = lineStart(v, i);
        if (s === 0) break;
        var ps = lineStart(v, s - 1), pe = s - 1;
        i = Math.min(ps + col2, pe);
      } else if (key === '0') i = lineStart(v, i);
      else if (key === '$') i = lineEnd(v, i);
      else if (key === 'w') { var m = v.slice(i).match(/^[^\w\u4e00-\u9fa5]*[\w\u4e00-\u9fa5]+/); i = i + (m ? m[0].length : 1); }
      else if (key === 'b') { var pre = v.slice(0, i).replace(/[\w\u4e00-\u9fa5]+$/, ''); var m2 = pre.match(/[\w\u4e00-\u9fa5]+$/); i = m2 ? pre.length - m2[0].length : Math.max(0, i - 1); }
    }
    moveTo(ta, i);
  }

  function fireInput(ta) {
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function replaceRange(ta, start, end, text) {
    var v = ta.value;
    ta.value = v.slice(0, start) + text + v.slice(end);
    moveTo(ta, start + text.length);
    fireInput(ta);
  }

  document.addEventListener('keydown', function (e) {
    if (!ENABLED) return;
    var ta = target(e.target);
    if (!ta) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Esc：进 normal
    if (e.key === 'Escape') {
      if (mode !== MODE_NORMAL) { e.preventDefault(); setMode(MODE_NORMAL, ta); }
      return;
    }

    if (mode === MODE_INSERT) {
      // 插入模式下不拦任何键，仅提示条跟随
      if (e.key.length === 1) badge(ta);
      return;
    }

    var k = e.key;
    var n = Number(String(pending).match(/^\d+/)) || 1;
    var digitPrefix = /^[1-9]$/.test(k) || (k === '0' && /^\d+$/.test(pending));
    if (digitPrefix) { pending += k; return; }
    var count = Number((pending.match(/\d+/) || [])[0]) || 1;
    var letter = pending.replace(/\d+/g, '');
    var seq = letter + k;

    // 两键序列：gg / dd
    if (letter === 'g') { pending = ''; if (k === 'g') vimMove(ta, 'gg'); return; }
    if (letter === 'd') {
      pending = '';
      if (k === 'd') {
        var v = ta.value, s = lineStart(v, ta.selectionStart), en = lineEnd(v, ta.selectionStart);
        var cut = v.slice(en) || '';
        replaceRange(ta, s, Math.min(v.length, en + 1), '');
        if (!cut) moveTo(ta, s);
      }
      return;
    }
    if (k === 'g' || k === 'd') { pending = k; clearTimeout(pendingTimer); pendingTimer = setTimeout(function () { pending = ''; }, 700); return; }

    // 进入插入模式的几种方式
    if (k === 'i') { e.preventDefault(); setMode(MODE_INSERT, ta); return; }
    if (k === 'a') { e.preventDefault(); moveTo(ta, Math.min(ta.value.length, ta.selectionStart + 1)); setMode(MODE_INSERT, ta); return; }
    if (k === 'I') { e.preventDefault(); moveTo(ta, lineStart(ta.value, ta.selectionStart)); setMode(MODE_INSERT, ta); return; }
    if (k === 'A') { e.preventDefault(); moveTo(ta, lineEnd(ta.value, ta.selectionStart)); setMode(MODE_INSERT, ta); return; }
    if (k === 'o') {
      e.preventDefault();
      var ve = lineEnd(ta.value, ta.selectionStart);
      replaceRange(ta, ve, ve, '\n');
      setMode(MODE_INSERT, ta);
      return;
    }
    if (k === 'O') {
      e.preventDefault();
      var vs = lineStart(ta.value, ta.selectionStart);
      replaceRange(ta, vs, vs, '\n');
      moveTo(ta, vs);
      setMode(MODE_INSERT, ta);
      return;
    }

    // 删除当前字符
    if (k === 'x') {
      e.preventDefault();
      var p = ta.selectionStart;
      if (p < ta.value.length) replaceRange(ta, p, p + count, '');
      return;
    }

    // G：文末
    if (k === 'G') { e.preventDefault(); moveTo(ta, ta.value.length); return; }

    // 移动键
    if ('hjkl0$wb'.indexOf(k) >= 0) {
      e.preventDefault();
      if (k === 'g') return;
      vimMove(ta, k, count);
      return;
    }
  }, true);

  // 焦点进入编辑器时刷新提示
  document.addEventListener('focusin', function (e) {
    var ta = target(e.target);
    if (ta) { setMode(mode, ta); }
  });
})();

/* ============================================================
 * Vim 阅读模式：不在输入框时，j/k 滚动、d/u 半页、g/G 首尾
 * 仅在周报详情 / 列表等阅读页生效，输入框内不拦
 * ============================================================ */
(function () {
  'use strict';
  if (window.__hjsecVimRead) return;
  window.__hjsecVimRead = true;

  function inField(el) {
    if (!el) return false;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
  }

  function scroller() {
    var el = document.querySelector('.prose') || document.querySelector('.read-list') || document.querySelector('.gh-main');
    while (el && el !== document.body) {
      var cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4) return el;
      el = el.parentElement;
    }
    return window;
  }
  function by(dy) {
    var s = scroller();
    if (s === window) window.scrollBy({ top: dy, behavior: 'smooth' });
    else s.scrollBy({ top: dy, behavior: 'smooth' });
  }
  function to(y) {
    var s = scroller();
    if (s === window) window.scrollTo({ top: y, behavior: 'smooth' });
    else s.scrollTo({ top: y, behavior: 'smooth' });
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (inField(e.target)) return;
    if (!document.querySelector('.prose, .read-list, .gh-main')) return;

    var step = 64;
    var k = e.key;
    var act = null;

    if (k === 'j') act = function () { by(step); };
    else if (k === 'k') act = function () { by(-step); };
    else if (k === 'd') act = function () { by(window.innerHeight * 0.5); };
    else if (k === 'u') act = function () { by(-window.innerHeight * 0.5); };
    else if (k === 'g') act = function () { to(0); };
    else if (k === 'G') act = function () { var s = scroller(); to(s === window ? document.body.scrollHeight : s.scrollHeight); };
    else if (k === '/') {
      var box = document.querySelector('#cmd-search, .gh-search, .zh-search');
      act = function () { if (box) { box.click ? box.click() : box.focus(); } };
    }
    if (!act) return;
    e.preventDefault();
    act();
  }, false);
})();
