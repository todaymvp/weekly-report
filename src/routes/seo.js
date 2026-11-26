/* ============================================================
 * SEO / 对外统一认证接口（骨架，可直接联调）
 *   目标：让外部 SEO 抓取、站点地图生成、第三方看板用统一凭据访问数据
 *
 *   1) POST /api/seo/token          client_credentials → access_token
 *   2) GET  /api/seo/verify         校验 token，返回身份与作用域
 *   3) POST /api/seo/revoke         吊销（无状态 token，返回建议）
 *   4) GET  /api/seo/sitemap        公开周报的 sitemap 数据（预留，当前返回空）
 *   5) GET  /api/seo/capabilities   公开：本接口能力与版本
 *
 *   凭据来源：环境变量 SEO_CLIENT_ID / SEO_CLIENT_SECRET
 *   未配置时使用开发默认值（仅 dev 可用），并在响应里标注 mode。
 *   实现说明：无状态签名 token（HMAC-SHA256），不落库、不依赖会话，
 *   方便外部系统调用；生产建议改成入库的可吊销 token。
 * ============================================================ */

'use strict';

const crypto = require('crypto');
const express = require('express');
const { db } = require('../db');

const router = express.Router();

const VERSION = (() => {
  try {
    return require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'VERSION'), 'utf8').trim();
  } catch (e) {
    return '';
  }
})();

const CLIENT_ID = process.env.SEO_CLIENT_ID || 'hjsec-seo';
const CLIENT_SECRET = process.env.SEO_CLIENT_SECRET || 'dev-seo-secret';
const IS_DEFAULT_SECRET = !process.env.SEO_CLIENT_SECRET;
const TTL_SECONDS = Number(process.env.SEO_TOKEN_TTL || 3600);
const SCOPES = ['seo:read', 'seo:sitemap'];
const DEFAULT_SCOPE = 'seo:read seo:sitemap';

/* ---------------- token 编解码（无状态） ---------------- */

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(s + '='.repeat((4 - (s.length % 4)) % 4), 'base64');
}

function sign(payloadB64) {
  return b64url(crypto.createHmac('sha256', CLIENT_SECRET).update(payloadB64).digest());
}

function issueToken(scope) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: CLIENT_ID,
    iss: 'hjsec-weekly',
    scope,
    iat: now,
    exp: now + TTL_SECONDS,
    jti: crypto.randomBytes(8).toString('hex')
  };
  const body = b64url(JSON.stringify(payload));
  return { token: `${body}.${sign(body)}`, payload };
}

function verifyToken(token) {
  const raw = String(token || '').replace(/^Bearer\s+/i, '').trim();
  const parts = raw.split('.');
  if (parts.length !== 2) return { ok: false, error: 'malformed_token' };
  const [body, sig] = parts;
  const expect = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, error: 'bad_signature' };
  let payload;
  try {
    payload = JSON.parse(unb64url(body).toString('utf8'));
  } catch (e) {
    return { ok: false, error: 'bad_payload' };
  }
  if (!payload || typeof payload.exp !== 'number') return { ok: false, error: 'bad_payload' };
  if (payload.exp * 1000 < Date.now()) return { ok: false, error: 'expired', payload };
  return { ok: true, payload };
}

/** Bearer 鉴权中间件；scope 用空格分隔 */
function requireScope(scope) {
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const got = verifyToken(header);
    if (!got.ok) {
      const code = got.error === 'expired' ? 401 : 401;
      return res.status(code).json({ error: 'invalid_token', detail: got.error });
    }
    const scopes = String(got.payload.scope || '').split(/\s+/).filter(Boolean);
    if (scope && !scopes.includes(scope)) {
      return res.status(403).json({ error: 'insufficient_scope', required: scope, granted: scopes });
    }
    req.seo = got.payload;
    next();
  };
}

/* ---------------- 1. 颁发 token ---------------- */

router.post('/token', (req, res) => {
  const body = req.body || {};
  const grant = String(body.grant_type || 'client_credentials');
  if (grant !== 'client_credentials') {
    return res.status(400).json({ error: 'unsupported_grant_type', supported: ['client_credentials'] });
  }
  const id = String(body.client_id || '');
  const secret = String(body.client_secret || '');
  if (!id || !secret) {
    return res.status(400).json({ error: 'invalid_request', detail: 'client_id 与 client_secret 必填' });
  }
  const okId = id.length === CLIENT_ID.length && crypto.timingSafeEqual(Buffer.from(id), Buffer.from(CLIENT_ID));
  const okSecret =
    secret.length === CLIENT_SECRET.length && crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(CLIENT_SECRET));
  if (!okId || !okSecret) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const wanted = String(body.scope || '').split(/\s+/).filter(Boolean);
  const scope = wanted.length ? wanted.filter((s) => SCOPES.includes(s)).join(' ') : DEFAULT_SCOPE;
  if (wanted.length && !scope) {
    return res.status(400).json({ error: 'invalid_scope', supported: SCOPES });
  }

  const { token, payload } = issueToken(scope);
  res.json({
    access_token: token,
    token_type: 'Bearer',
    expires_in: TTL_SECONDS,
    scope,
    issued_at: payload.iat,
    jti: payload.jti,
    mode: IS_DEFAULT_SECRET ? 'dev-default-secret' : 'configured'
  });
});

/* ---------------- 2. 校验 token ---------------- */

router.get('/verify', requireScope(''), (req, res) => {
  res.json({
    valid: true,
    sub: req.seo.sub,
    scope: req.seo.scope,
    issued_at: req.seo.iat,
    expires_at: req.seo.exp,
    expires_in: Math.max(0, req.seo.exp - Math.floor(Date.now() / 1000))
  });
});

/* ---------------- 3. 吊销（无状态实现） ---------------- */

router.post('/revoke', (req, res) => {
  res.json({
    revoked: true,
    note: '无状态 token：客户端丢弃即可；如需服务端强制吊销，请接入 token 黑名单'
  });
});

/* ---------------- 4. sitemap（预留，先给空结构） ---------------- */

router.get('/sitemap', requireScope('seo:sitemap'), (req, res) => {
  // 仅统计，不返回正文；后续可放开已提交周报的公开元数据
  let total = 0;
  try {
    total = db.prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'submitted'").get().c;
  } catch (e) {
    total = 0;
  }
  res.json({
    generated_at: new Date().toISOString(),
    total_reports: total,
    items: [],
    todo: 'TODO: 输出公开周报的 url / lastmod / title（需先确定可见范围与站点域名）'
  });
});

/* ---------------- 5. 能力探测（公开） ---------------- */

router.get('/capabilities', (_req, res) => {
  res.json({
    name: 'HJSEC SEO Auth',
    version: VERSION,
    token_endpoint: '/api/seo/token',
    verify_endpoint: '/api/seo/verify',
    revoke_endpoint: '/api/seo/revoke',
    sitemap_endpoint: '/api/seo/sitemap',
    grant_types: ['client_credentials'],
    scopes: SCOPES,
    token_ttl: TTL_SECONDS,
    auth_scheme: 'Bearer (HMAC-SHA256, stateless)',
    mode: IS_DEFAULT_SECRET ? 'dev-default-secret' : 'configured'
  });
});

module.exports = router;
