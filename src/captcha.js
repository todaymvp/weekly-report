'use strict';

/** 图形验证码（登录用）：服务端生成 SVG，答案只存内存，一次性使用 */

const crypto = require('crypto');

const store = new Map();
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉 0/O、1/I 等易混字符
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 5000;

function pick(arr) {
  return arr[crypto.randomInt(0, arr.length)];
}

function render(code) {
  const W = 132;
  const H = 42;
  const colors = ['#4f46e5', '#0f766e', '#b45309', '#be185d', '#1d4ed8', '#7c3aed'];
  const bg = '#f4f5fa';

  let glyphs = '';
  for (let i = 0; i < code.length; i += 1) {
    const x = 16 + i * 28;
    const y = 29 + crypto.randomInt(-3, 4);
    const rot = crypto.randomInt(-18, 19);
    glyphs += `<text x="${x}" y="${y}" fill="${pick(colors)}" font-family="ui-monospace,Consolas,monospace" font-size="23" font-weight="700" transform="rotate(${rot} ${x} ${y})">${code[i]}</text>`;
  }

  let noise = '';
  for (let i = 0; i < 3; i += 1) {
    noise += `<path d="M0 ${crypto.randomInt(4, H - 4)} Q ${W / 2} ${crypto.randomInt(0, H)} ${W} ${crypto.randomInt(4, H - 4)}" stroke="rgba(99,102,241,.45)" stroke-width="1.2" fill="none"/>`;
  }
  for (let i = 0; i < 24; i += 1) {
    noise += `<circle cx="${crypto.randomInt(0, W)}" cy="${crypto.randomInt(0, H)}" r="${crypto.randomInt(1, 2)}" fill="rgba(79,70,229,.32)"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="图形验证码">` +
    `<rect width="${W}" height="${H}" rx="8" fill="${bg}"/>${noise}${glyphs}</svg>`
  );
}

function sweep() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expires < now) store.delete(k);
  }
  // 兜底：防止异常流量打爆内存
  if (store.size > MAX_ENTRIES) {
    const keys = [...store.keys()].slice(0, store.size - MAX_ENTRIES);
    keys.forEach((k) => store.delete(k));
  }
}

function create() {
  sweep();
  const code = Array.from({ length: 4 }, () => pick(CHARS)).join('');
  const id = crypto.randomBytes(16).toString('hex');
  store.set(id, { code, expires: Date.now() + TTL_MS });
  return { id, svg: render(code), code };
}

/** 校验并立即作废（防重放）：无论对错都只能用一次 */
function verify(id, input) {
  if (!id || typeof id !== 'string') return false;
  const rec = store.get(id);
  if (!rec) return false;
  store.delete(id);
  if (rec.expires < Date.now()) return false;
  return String(input || '').trim().toUpperCase() === rec.code;
}

module.exports = { create, verify, TTL_MS };
