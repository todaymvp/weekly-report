/* 服务端 Markdown 渲染
 * 复用前端同一套渲染器（public/js/markdown.js + markdown-highlight.js），
 * 在 Node 的 vm 沙箱里跑，保证服务端/客户端输出逐字节一致，
 * 同时省掉每次进入详情页时浏览器端的解析与高亮开销。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

let renderer = null;

function init() {
  if (renderer) return renderer;
  const base = path.join(__dirname, '..', 'public', 'js');
  const sandbox = { window: {}, console };
  for (const file of ['markdown-highlight.js', 'markdown.js']) {
    const src = fs.readFileSync(path.join(base, file), 'utf8');
    vm.runInNewContext(src, sandbox, { filename: file, timeout: 5000 });
  }
  if (typeof sandbox.window.mdToHtml !== 'function') {
    throw new Error('markdown renderer 未正确加载');
  }
  renderer = sandbox.window.mdToHtml;
  return renderer;
}

// 内容哈希做键，最多缓存 300 篇（详情页重复访问直接命中）
const cache = new Map();
const MAX = 300;

function renderMarkdown(source) {
  const text = String(source == null ? '' : source);
  if (!text) return '';
  const key = crypto.createHash('sha1').update(text).digest('hex');
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  let html;
  try {
    html = init()(text);
  } catch (e) {
    // 渲染失败时降级为纯文本，绝不把异常抛给接口
    html = `<p>${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</p>`;
  }
  if (cache.size >= MAX) cache.clear();
  cache.set(key, html);
  return html;
}

module.exports = { renderMarkdown };
