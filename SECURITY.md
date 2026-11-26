# 安全策略

## 报告漏洞

请不要在公开 Issue 里贴可利用细节。请通过以下方式私下联系维护者：

- GitHub Security Advisories（推荐）：仓库 → Security → Report a vulnerability
- 或邮件：`security@todaymvp.dev`（开源发布时请替换为真实邮箱）

我们会在 **72 小时**内回应，修复后在 Release Notes 中公开致谢。

## 部署者必读

本项目默认值仅用于本地开发，部署到公网前请务必：

| 项 | 要求 |
|---|---|
| `ADMIN_PASSWORD` | 改成强密码，首次登录后立即在「个人设置」更换 |
| `SEO_CLIENT_SECRET` | 必须改，否则 `/api/seo/capabilities` 会返回 `mode: dev-default-secret` |
| `COOKIE_SECURE` | 走 HTTPS 时必须为 `true` |
| `TRUST_PROXY` | 前面有反代（Nginx / Caddy）时为 `true`，否则限流会取到代理 IP |
| `DEV_CODE_HINT` | 生产必须为 `false`（否则验证码会写进接口响应） |
| `MAIL_MODE` | 生产用 `smtp`；`console` 会把验证码打到容器日志 |
| 数据目录 | `data/` 含 SQLite 与上传文件，**不要**提交进仓库，也不要放在 Web 根目录 |

反向代理侧建议：

- 开启 HTTPS（HSTS 可选）
- 配置按路径的限流（例如只对 `/api/*` 限流，静态资源不计），否则单页应用一次首屏的 20+ 请求会误伤正常用户
- 保留 `X-Forwarded-For` / `X-Forwarded-Proto`

## 已知边界

- 会话为 HttpOnly Cookie + 服务端会话表，退出登录会删除会话
- 上传文件按扩展名与 MIME 双校验，仅站内路径可引用
- Markdown 渲染全程转义，禁止原始 HTML 注入
- 附件下载走 `/api/attachments/:id`，需登录且做权限校验
