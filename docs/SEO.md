# SEO 统一认证接口（`/api/seo`）

给外部系统（站点地图生成器、搜索引擎抓取脚本、第三方看板、Gitea Actions）用**统一凭据**访问周报元数据的接口层。

实现文件：`src/routes/seo.js`，挂载：`server.js` → `app.use('/api/seo', ...)`。

---

## 1. 凭据配置

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `SEO_CLIENT_ID` | `hjsec-seo` | 客户端 ID |
| `SEO_CLIENT_SECRET` | `dev-seo-secret` | 客户端密钥，**生产必须改** |
| `SEO_TOKEN_TTL` | `3600` | token 有效期（秒） |

未配置 `SEO_CLIENT_SECRET` 时，`/capabilities` 与 `/token` 的响应里会带 `mode: "dev-default-secret"`，方便发现漏配。

---

## 2. 接口

### 2.1 能力探测（公开）

```bash
curl https://study.hjsec.top/api/seo/capabilities
```

```json
{
  "name": "HJSEC SEO Auth",
  "version": "5.13.0",
  "token_endpoint": "/api/seo/token",
  "verify_endpoint": "/api/seo/verify",
  "revoke_endpoint": "/api/seo/revoke",
  "sitemap_endpoint": "/api/seo/sitemap",
  "grant_types": ["client_credentials"],
  "scopes": ["seo:read", "seo:sitemap"],
  "token_ttl": 3600,
  "auth_scheme": "Bearer (HMAC-SHA256, stateless)"
}
```

### 2.2 获取 token

```bash
curl -X POST https://study.hjsec.top/api/seo/token \
  -H 'Content-Type: application/json' \
  -d '{"grant_type":"client_credentials","client_id":"hjsec-seo","client_secret":"<secret>","scope":"seo:read seo:sitemap"}'
```

```json
{
  "access_token": "eyJzdWIiOiJoanNlYy1zZW8i... .-c5a3_J6jRHikELXLOmSkoKvRX-QqDZCRWLYElvPYN0",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "seo:read seo:sitemap",
  "issued_at": 1795654774,
  "jti": "ba984ed7881a1245"
}
```

错误：

| 情况 | 状态码 | body |
|---|---|---|
| 缺 client_id / secret | 400 | `invalid_request` |
| 凭据错误 | 401 | `invalid_client` |
| scope 不在白名单 | 400 | `invalid_scope` |
| grant_type 不支持 | 400 | `unsupported_grant_type` |

### 2.3 校验 token

```bash
curl https://study.hjsec.top/api/seo/verify -H "Authorization: Bearer $TOKEN"
```

```json
{"valid":true,"sub":"hjsec-seo","scope":"seo:read seo:sitemap","expires_in":3600}
```

过期返回 401 `{"error":"invalid_token","detail":"expired"}`；签名不对返回 `detail:"bad_signature"`。

### 2.4 吊销

```bash
curl -X POST https://study.hjsec.top/api/seo/revoke -H "Authorization: Bearer $TOKEN"
```

当前 token 无状态（HMAC 签名，不落库），因此 revoke 只返回建议：客户端丢弃即可。要服务端强制吊销，需要再加一张 `token_blacklist(jti, exp)` 表并在校验时查。

### 2.5 Sitemap 数据（骨架）

```bash
curl https://study.hjsec.top/api/seo/sitemap -H "Authorization: Bearer $TOKEN"
```

```json
{
  "generated_at": "2026-11-26T00:59:34.072Z",
  "total_reports": 11,
  "items": [],
  "todo": "TODO: 输出公开周报的 url / lastmod / title"
}
```

`items` 目前为空 —— 需要先定「哪些周报对外公开」（是否只 `status=submitted`、是否排除草稿/私密方向），再把记录映射成：

```json
{"loc":"https://study.hjsec.top/#/report/12","lastmod":"2026-11-25T07:08:00Z","title":"…"}
```

---

## 3. 能和 Gitea 联动吗？

能，有三种接法，按侵入性从低到高：

### 方案 A：Gitea Actions 定时拉取（推荐，零耦合）

Gitea 仓库里加一个 workflow，用 Actions 定时调本接口生成 sitemap 并提交到静态站点仓库：

```yaml
# .gitea/workflows/seo.yml
name: seo-sitemap
on:
  schedule:
    - cron: "0 3 * * *"
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          TOKEN=$(curl -s -X POST "$SEO_BASE/api/seo/token" \
            -H 'Content-Type: application/json' \
            -d "{\"client_id\":\"$SEO_ID\",\"client_secret\":\"$SEO_SECRET\"}" \
            | jq -r .access_token)
          curl -s "$SEO_BASE/api/seo/sitemap" -H "Authorization: Bearer $TOKEN" -o sitemap.json
      - run: git add sitemap.json && git commit -m "chore: update sitemap" && git push
```

凭据放 Gitea 仓库的 **Secrets**（`SEO_BASE` / `SEO_ID` / `SEO_SECRET`），代码里不出现密钥。

### 方案 B：Gitea Webhook 反向通知（实时）

Gitea 仓库 Settings → Webhooks 指向本站新增的 `/api/seo/gitea/webhook`，推送/发布时触发重新生成 sitemap。需要在 `src/routes/seo.js` 里补一个入口：

```js
// 需校验 Gitea 的 X-Gitea-Signature（HMAC-SHA256，secret 用 SEO_WEBHOOK_SECRET）
router.post('/gitea/webhook', express.json(), (req, res) => {
  const sig = req.get('X-Gitea-Signature') || '';
  const calc = crypto.createHmac('sha256', process.env.SEO_WEBHOOK_SECRET || '')
    .update(JSON.stringify(req.body)).digest('hex');
  if (sig !== calc) return res.status(401).json({ error: 'bad_signature' });
  // TODO: 触发 sitemap 重建 / 记录 push 事件
  res.json({ ok: true });
});
```

### 方案 C：用 Gitea 当身份源（OAuth2）

如果你想让「Gitea 账号 = 周报账号」，那属于**登录体系**而不是 SEO：在 Gitea 建 OAuth2 应用，回调本站 `/api/auth/gitea/callback`，用 `code` 换 access_token 再取用户信息，按 `username` 匹配本地用户（首次自动开通）。

> 注意：Gitea 目前**没有**「被当作 OAuth2 客户端去访问第三方」的标准流程，所以方向只能是 **Gitea 提供身份 / Gitea Actions 主动调用我们**，不能让我们反过来当 Gitea 的 OAuth 客户端。

---

## 4. 与 Caddy 限流的关系

`study.hjsec.top` 现为 `handle /api/*` 内 **300 events / 1m / IP**。抓取脚本建议：

- 单 IP 全量拉取时限制到 **≤120 次/分钟**（留余量给真实用户）
- 或用多个出口 IP + 代理池分摊
- 429 响应没有 `Retry-After` 头，客户端请按 60s 退避重试

---

## 5. 安全建议

1. 生产改掉 `SEO_CLIENT_SECRET`，并在 `/capabilities` 里确认 `mode` 不是 `dev-default-secret`
2. token 只发 `seo:*` scope，不要复用用户会话
3. `sitemap` 只暴露**已提交**周报的元数据，绝不含正文
4. 需要强制吊销时再加黑名单表（`jti` + `exp`）
