/* 极简安全 Markdown 渲染：先转义 HTML，再解析语法，杜绝 XSS */
(function () {
  'use strict';

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  }

  // 图片只允许本站托管：编辑器上传的 /api/uploads/<id>，或周报附件的 /api/attachments/<id>
  // 这样既能配合 CSP（img-src 'self'），也避免正文里塞外链图片做追踪
  const IMG_PATH = /^\/api\/(?:uploads|attachments)\/\d+$/;

  function inline(text) {
    const images = [];
    const literals = [];
    const wikis = [];
    let s = escapeHtml(text);

    // 反斜杠转义（富文本编辑器序列化出的 \* \# 等）先抽成占位符，避免被当成语法
    s = s.replace(/\\([\\`*_{}[\]()#+\-.!~>|])/g, (_m, ch) => {
      const i = literals.length;
      literals.push(ch);
      return `\u0001L${i}\u0001`;
    });

    // 先把图片语法抽成占位符，避免后面的强调/链接规则把 <img> 拆坏
    s = s.replace(/!\[([^\]\n]{0,120})\]\(([^)\s]{1,300})\)/g, (m, alt, url) => {
      if (!IMG_PATH.test(url)) {
        // 非站内图片：留成可见占位符，方便编辑器里定位并补传
        return `<span class="md-img-missing" data-src="${url}" title="图片未上传">${m}</span>`;
      }
      const i = images.length;
      images.push(`<img src="${url}" alt="${alt}" loading="lazy" decoding="async" />`);
      return `\u0000img${i}\u0000`;
    });

    // 徽章：[[badge:文字]] 或 [[badge:文字|green]] —— 小型彩色标签
    const badges = [];
    s = s.replace(/\[\[badge:([^\]\n|]{1,20})(?:\|(\w+))?\]\]/g, (_m, text, tone) => {
      const i = badges.length;
      const t = ['green', 'blue', 'orange', 'red', 'purple', 'gray'].includes(tone) ? tone : 'blue';
      badges.push(`<span class="md-badge badge-${t}">${escapeHtml(text)}</span>`);
      return `\u0004B${i}\u0004`;
    });

    // 键盘按键：<kbd>Ctrl</kbd> 或 [[key:Ctrl]]
    const kbd = [];
    s = s.replace(/\[\[key:([^\]\n]{1,20})\]\]/g, (_m, text) => {
      const i = kbd.length;
      kbd.push(`<kbd class="md-kbd">${escapeHtml(text)}</kbd>`);
      return `\u0004K${i}\u0004`;
    });
    s = s.replace(/&lt;kbd&gt;([^&]{1,20})&lt;\/kbd&gt;/g, (_m, text) => {
      const i = kbd.length;
      kbd.push(`<kbd class="md-kbd">${text}</kbd>`);
      return `\u0004K${i}\u0004`;
    });

    // Obsidian 内嵌：![[图片.png]]
    s = s.replace(/!\[\[([^\]\n|]{1,200})(?:\|([^\]\n]{0,80}))?\]\]/g, (_m, target, alt) => {
      const t = String(target).trim();
      const i = wikis.length;
      if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(t)) {
        wikis.push(
          `<span class="md-img-missing" data-src="${t}" data-wiki="1" title="Obsidian 内嵌图片，导入时把这批图片一起选上会自动嵌入">![[${t}]]</span>`
        );
      } else {
        wikis.push(`<span class="wiki-link" data-note="${t}">${alt || t}</span>`);
      }
      return `\u0002W${i}\u0002`;
    });

    // Obsidian 双链：[[笔记]] / [[笔记|别名]] / [[笔记#小节]]
    s = s.replace(/\[\[([^\]\n|]{1,200})(?:\|([^\]\n]{0,120}))?\]\]/g, (_m, target, alias) => {
      const t = String(target).trim();
      const label = String(alias || t).replace(/#/g, ' › ');
      const i = wikis.length;
      wikis.push(`<span class="wiki-link" data-note="${t}">${label}</span>`);
      return `\u0002W${i}\u0002`;
    });

    s = s.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
    // 行内数学：$formula$（单个 $，避免与 $$ 块冲突）
    s = s.replace(/\$([^$\n]{1,120})\$/g, (_m, f) => `<span class="md-math-inline">${escapeHtml(f)}</span>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    s = s.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
    // Obsidian 上标/下标：^^文字^^ 上标，~~不冲突的 ~文字~ 下标（~~删除线已先处理）
    s = s.replace(/\^\^([^\^\n]{1,40})\^\^/g, '<sup>$1</sup>');
    s = s.replace(/(^|[^\n])~([^~\n]{1,40})~/g, '$1<sub>$2</sub>');
    s = s.replace(/__([^_\n]+)__/g, '<u>$1</u>');
    s = s.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)"']+)\)/g,
      (_m, t, u) =>
        `<a href="${u}" target="_blank" rel="noopener noreferrer nofollow">${t}</a>`
    );
    // 进度条：progress:75% 说明文字 —— 用占位符保护生成的 HTML
    const progresses = [];
    s = s.replace(/progress:(\d{1,3})\s*%?\s*([^\n<]*)/g, (_m, num, label) => {
      const pct = Math.max(0, Math.min(100, parseInt(num, 10)));
      const text = String(label || '').trim();
      const i = progresses.length;
      progresses.push(
        `<span class="md-progress" title="进度 ${pct}%"><span class="md-progress-bar" style="width:${pct}%"></span><span class="md-progress-label">${text || pct + '%'}</span></span>`
      );
      return `\u0003P${i}\u0003`;
    });


    // 自动链接：裸 http(s) URL（前面不是 = / " 等，避免吃掉已有 a 标签的 href）
    s = s.replace(/(^|[^(\=\"])((?:https?:\/\/)[^\s<>]{4,200})/g, (_m, pre, url) => {
      const clean = url.replace(/[.,;:!?)\u3002\uff0c\uff01]+$/, '');
      const tail = url.slice(clean.length);
      return `${pre}<a href="${clean}" target="_blank" rel="noopener noreferrer nofollow">${clean}</a>${tail}`;
    });

    s = s.replace(/@([A-Za-z0-9_\u4e00-\u9fa5-]{2,24})/g, '<span class="mention">@$1</span>');
    // Obsidian 行内标签：#tag（前面必须是空白或行首，避免吃掉 URL 片段和标题）
    s = s.replace(/(^|[\s(\uff08\u3001,\uff0c])#([A-Za-z0-9_\u4e00-\u9fa5][\w\u4e00-\u9fa5/-]{0,31})/g, '$1<span class="md-tag">#$2</span>');
    s = s.replace(/\u0002W(\d+)\u0002/g, (_m, i) => wikis[Number(i)] || '');
    s = s.replace(/\u0000img(\d+)\u0000/g, (_m, i) => images[Number(i)] || '');
    s = s.replace(/\u0003P(\d+)\u0003/g, (_m, i) => progresses[Number(i)] || '');
    s = s.replace(/\u0004B(\d+)\u0004/g, (_m, i) => badges[Number(i)] || '');
    s = s.replace(/\u0004K(\d+)\u0004/g, (_m, i) => kbd[Number(i)] || '');
    s = s.replace(/\u0001L(\d+)\u0001/g, (_m, i) => literals[Number(i)]);
    return s;
  }

  /** 表格分隔行：|---|:---:|---:| */
  function isTableSeparator(line) {
    const t = String(line || '').trim();
    if (!t.includes('|') || !t.includes('-')) return false;
    return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(t);
  }

  /** 拆分表格行，支持 \| 转义 */
  function splitTableRow(line) {
    let s = String(line || '').trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
  }

  /** 去掉 Obsidian / Jekyll 的 YAML frontmatter（--- 开头到 --- 结束） */
  function stripFrontMatter(text) {
    const lines = String(text).split('\n');
    // 允许开头有 BOM / 空行（从 Obsidian 导入的笔记很常见）
    let start = 0;
    while (start < lines.length && lines[start].replace(/^\uFEFF/, '').trim() === '') start += 1;
    if (lines.length < start + 3) return text;
    if (lines[start].replace(/^\uFEFF/, '').trim() !== '---') return text;
    const max = Math.min(lines.length, start + 200);
    for (let k = start + 1; k < max; k += 1) {
      const t = lines[k].trim();
      if (t === '---' || t === '...') return lines.slice(k + 1).join('\n');
    }
    return text;
  }

  /** Obsidian 标注类型 → 中文标题（未列出时用原文） */
  const CALLOUT_LABEL = {
    note: '笔记',
    abstract: '摘要',
    summary: '摘要',
    info: '信息',
    todo: '待办',
    tip: '提示',
    hint: '提示',
    success: '完成',
    check: '完成',
    question: '疑问',
    help: '疑问',
    warning: '警告',
    caution: '警告',
    attention: '注意',
    failure: '失败',
    fail: '失败',
    missing: '缺失',
    danger: '危险',
    error: '错误',
    bug: '缺陷',
    example: '示例',
    quote: '引用',
    cite: '引用'
  };

  function mdToHtml(src) {
    let text = String(src == null ? '' : src).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    text = stripFrontMatter(text);
    text = text.replace(/%%[\s\S]*?%%/g, ''); // Obsidian 注释整段丢弃
    const lines = text.split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // 折叠块：::: details 标题  ...  :::
      const fold = line.match(/^\s*:::\s*(?:details|fold|collapse)(?:\s+(.*))?$/i);
      if (fold) {
        const title = String(fold[1] || '展开查看详情').trim();
        const buf = [];
        i += 1;
        while (i < lines.length && !/^\s*:::\s*$/.test(lines[i])) {
          buf.push(lines[i]);
          i += 1;
        }
        i += 1; // 跳过结束 :::
        out.push(
          `<details class="md-details">` +
            `<summary>${inline(title)}</summary>` +
            `<div class="md-details-body">${mdToHtml(buf.join('\n'))}</div>` +
          `</details>`
        );
        continue;
      }

      // 时间线：::: timeline  ...  :::   每行 "- 2026-01-01 事件" 或 "2026-01-01: 事件"
      if (/^\s*:::\s*timeline\b/i.test(line)) {
        const buf = [];
        i += 1;
        while (i < lines.length && !/^\s*:::\s*$/.test(lines[i])) {
          buf.push(lines[i]);
          i += 1;
        }
        i += 1;
        const items = buf
          .map((l) => {
            const m = String(l).trim().replace(/^[-*+]\s*/, '').match(/^(.{1,40}?)\s*[:：]\s*([\s\S]+)$/);
            return m
              ? `<li><span class="tl-time">${escapeHtml(m[1])}</span><span class="tl-text">${inline(m[2])}</span></li>`
              : `<li><span class="tl-text">${inline(String(l))}</span></li>`;
          })
          .join('');
        out.push(`<ol class="md-timeline">${items}</ol>`);
        continue;
      }

      // Mermaid 图表（零外部依赖：用 CSS 渲染简单流程/时序/架构图，复杂图降级为代码块样式）
      const mermaid = line.match(/^\s*```mermaid\s*$/i);
      if (mermaid) {
        const buf = [];
        i += 1;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i += 1; }
        i += 1;
        const raw = buf.join('\n');
        const kind = /sequenceDiagram/i.test(raw) ? 'sequence' : /classDiagram|flowchart|graph\s/i.test(raw) ? 'flow' : 'raw';
        if (kind === 'raw') {
          out.push(`<div class="md-mermaid raw"><div class="mm-title">Mermaid · 图表</div><pre>${escapeHtml(raw)}</pre></div>`);
        } else {
          const nodes = [];
          const edges = [];
          for (const l of buf) {
            const t = l.trim();
            if (!t || /^(flowchart|graph|sequenceDiagram|participant|autonumber|direction|%%)/i.test(t)) continue;
            if (/^(sequenceDiagram|flowchart|graph)/i.test(t)) continue;
            // A --> B / A -->|文字| B / A->>B: 文本
            const e = t.match(/^(.+?)\s*(?:-->|->>|->|==>)\s*\|?([^|\n]*?)(?:\|)?\s*(.+)$/);
            if (e) edges.push({ from: e[1].trim(), label: e[2].trim(), to: e[3].trim() });
            else if (/\[|\(/.test(t)) nodes.push(t.replace(/[\[\]]/g, '').split('(')[0].trim());
          }
          const flow = edges.length
            ? edges.map((e) => `<div class="mm-step"><span class="mm-node">${escapeHtml(e.from)}</span><span class="mm-arrow">${escapeHtml(e.label || '→')}</span><span class="mm-node">${escapeHtml(e.to)}</span></div>`).join('')
            : nodes.map((n) => `<div class="mm-step"><span class="mm-node">${escapeHtml(n)}</span></div>`).join('');
          out.push(
            `<div class="md-mermaid ${kind}"><div class="mm-title">Mermaid · ${kind === 'sequence' ? '时序图' : '流程图'}</div><div class="mm-body">${flow || `<pre>${escapeHtml(raw)}</pre>`}</div></div>`
          );
        }
        continue;
      }

      // KaTeX 数学块（零外部依赖：保留公式源码，渲染为居中的数学容器）
      const math = line.match(/^\s*\$\$\s*$/);
      if (math) {
        const buf = [];
        i += 1;
        while (i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) { buf.push(lines[i]); i += 1; }
        i += 1;
        out.push(`<div class="md-math">${escapeHtml(buf.join('\n'))}</div>`);
        continue;
      }

      // 代码块：技术文档风格（浅色底、可选行号、语法高亮、可折叠）
      const fence = line.match(/^\s*(`{3,}|~{3,})\s*([^`~]*)$/);
      if (fence) {
        const marker = fence[1][0];
        const closeRe = new RegExp('^\\s*' + (marker === '`' ? '`{3,}' : '~{3,}') + '\\s*$');
        const buf = [];
        i += 1;
        while (i < lines.length && !closeRe.test(lines[i])) {
          buf.push(lines[i]);
          i += 1;
        }
        i += 1;
        // 代码块首尾的空行去掉，避免 <pre> 里多出一整行空白
        while (buf.length && buf[0].trim() === '') buf.shift();
        while (buf.length && buf[buf.length - 1].trim() === '') buf.pop();
        // info string：````c++ / ```js {line-numbers} / ```python title="x"````
        const info = String(fence[2] || '').trim();
        const metaMatch = info.match(/\{([^}]*)\}/);
        const meta = metaMatch ? metaMatch[1] : '';
        const lang = info
          .replace(/\{[^}]*\}/g, ' ')
          .trim()
          .split(/\s+/)[0]
          .replace(/^\./, '')
          .toLowerCase();
        const plain = buf.join('\n');
        const highlighted = window.mdHighlight ? window.mdHighlight(plain, lang) : escapeHtml(plain);
        const langLabel = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : '<span class="code-lang">text</span>';
        const copyBtn = `<button type="button" class="code-copy" data-copy title="复制代码">复制</button>`;
        // {line-numbers} / {no-line-numbers} / {fold}
        // 默认就带行号（与博客一致），{no-line-numbers} 可关闭
        const showLines = !/no-line-numbers/.test(meta);
        const foldable = /fold/.test(meta);
        const body = showLines
          ? buf.map((l, idx) => `<span class="code-line"><span class="code-ln">${idx + 1}</span><span class="code-txt">${window.mdHighlight ? window.mdHighlight(l, lang) : escapeHtml(l)}</span></span>`).join('')
          : `<span class="code-line"><span class="code-txt">${highlighted}</span></span>`;
        const codeBody = `<pre class="code"><code>${body}</code></pre>`;
        out.push(
          `<div class="code-block">` +
            `<div class="code-bar"><span class="term-dots"><i></i><i></i><i></i></span>${langLabel}${
              foldable ? '<button type="button" class="code-fold" data-code-fold>展开</button>' : ''
            }${copyBtn}</div>` +
            (foldable ? `<div class="code-fold-body" hidden>${codeBody}</div>` : codeBody) +
          `</div>`
        );
        continue;
      }

      if (/^\s*$/.test(line)) {
        i += 1;
        continue;
      }

      // 分隔线
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        out.push('<hr/>');
        i += 1;
        continue;
      }

      // 表格：表头行 + 分隔行（|---|:---:|）
      if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        const header = splitTableRow(line);
        const aligns = splitTableRow(lines[i + 1]).map((c) => {
          const left = c.startsWith(':');
          const right = c.endsWith(':');
          return left && right ? 'center' : right ? 'right' : left ? 'left' : '';
        });
        const alignAttr = (k) => (aligns[k] ? ` style="text-align:${aligns[k]}"` : '');
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) {
          rows.push(splitTableRow(lines[i]));
          i += 1;
        }
        const th = header.map((c, k) => `<th${alignAttr(k)}>${inline(c)}</th>`).join('');
        const body = rows
          .map((r) => `<tr>${header.map((_, k) => `<td${alignAttr(k)}>${inline(r[k] || '')}</td>`).join('')}</tr>`)
          .join('');
        out.push(
          `<div class="table-wrap"><table class="md-table"><thead><tr>${th}</tr></thead>${
            body ? `<tbody>${body}</tbody>` : ''
          }</table></div>`
        );
        continue;
      }

      // 标题（自动加锚点 id，供目录跳转）
      const h = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
      if (h) {
        const lv = h[1].length;
        const plain = h[2].replace(/[*_`~\[\]()#]/g, '').trim();
        const slug = 'sec-' + plain.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '').slice(0, 40) + '-' + h[2].length;
        out.push(`<h${lv} id="${slug}">${inline(h[2])}<a class="h-anchor" data-anchor="${slug}" title="锚点">¶</a></h${lv}>`);
        i += 1;
        continue;
      }

      // Obsidian 标注：> [!note] 标题 / > [!warning]- 可折叠
      const callout = line.match(/^\s*>\s*\[!([\w-]+)\]([+-]?)\s*(.*)$/);
      if (callout) {
        const type = String(callout[1]).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'note';
        const collapsible = callout[2] === '-';
        const collapsed = collapsible; // Obsidian: "-" = 默认折叠, "+" = 默认展开
        const title = callout[3].trim() || CALLOUT_LABEL[type] || type;
        const buf = [];
        i += 1;
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i += 1;
        }
        const inner = `<div class="callout-title">${inline(title)}</div><div class="callout-body">${mdToHtml(buf.join('\n'))}</div>`;
        out.push(
          collapsible
            ? `<details class="callout callout-${type}"${collapsed ? '' : ' open'}><summary>${inline(title)}</summary><div class="callout-body">${mdToHtml(buf.join('\n'))}</div></details>`
            : `<div class="callout callout-${type}">${inner}</div>`
        );
        continue;
      }

      // 引用
      if (/^\s*>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i += 1;
        }
        out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
        continue;
      }

      // 列表（含 Obsidian / GitHub 的 - [ ] 任务项）
      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
        const ordered = /^\s*\d+\.\s+/.test(line);
        const startNum = ordered ? Number(line.match(/^\s*(\d+)\.\s+/)[1]) : 1;
        const items = [];
        let hasTask = false;
        while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
          let body = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, '');
          const task = body.match(/^\[([ xX])\]\s+([\s\S]*)$/);
          if (task) {
            hasTask = true;
            const done = task[1].toLowerCase() === 'x';
            body = `<span class="task-box${done ? ' done' : ''}">${done ? '✓' : ''}</span>${
              done ? '<span class="task-done">' : '<span>'
            }${inline(task[2])}</span>`;
          } else {
            body = inline(body);
          }
          items.push(`<li class="${task ? 'task-item' : ''}">${body}</li>`);
          i += 1;
        }
        const tag = ordered ? 'ol' : 'ul';
        // 中间被段落/代码块打断的有序列表，用 start 保持原来的编号
        const startAttr = ordered && startNum > 1 ? ` start="${startNum}"` : '';
        const cls = hasTask ? ' class="task-list"' : '';
        out.push(`<${tag}${startAttr}${cls}>${items.join('')}</${tag}>`);
        continue;
      }

      // 段落
      const buf = [];
      while (
        i < lines.length &&
        !/^\s*$/.test(lines[i]) &&
        !/^\s*```/.test(lines[i]) &&
        !/^\s{0,3}#{1,6}\s/.test(lines[i]) &&
        !/^\s*>/.test(lines[i]) &&
        !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
        !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
      ) {
        buf.push(lines[i]);
        i += 1;
      }
      // 逐行渲染再手动补 <br/>：直接 join 会把 <br/> 一起转义掉，页面上显示成字面量
      out.push(`<p>${buf.map((l) => inline(l)).join('<br/>')}</p>`);
    }
    return out.join('\n');
  }

  window.escapeHtml = escapeHtml;
  window.mdToHtml = mdToHtml;
})();
