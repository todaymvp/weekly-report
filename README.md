# 学习周报系统 · Weekly Report

> 自托管的团队周报平台：Markdown 周报 + 讨论 + 排行榜 + 通知 + 管理后台。
> 原生前端（无框架）+ Express 5 + SQLite，一条 `docker compose up` 起服务。

<p>
<img alt="node" src="https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white">
<img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
<img alt="docker" src="https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white">
<img alt="version" src="https://img.shields.io/badge/version-5.16.2-3a6ea5">
<img alt="ghcr" src="https://img.shields.io/badge/ghcr.io-todaymvp%2Fweekly--report-2496ED?logo=github">
</p>

---

## 特性

| 模块 | 说明 |
|---|---|
| **周报** | Markdown 编写、服务端预渲染；代码高亮 20+ 语言（Shiki 配色）+ 行号 + 复制；表格 / 行内公式 / 任务列表 / Callout / 折叠块 |
| **阅读** | 两套皮肤（知乎 / GitHub）、亮暗主题、右侧目录、阅读进度光线、自托管中文衬线字体（436KB 子集） |
| **交互** | 编辑器 vim 层（默认关，`Ctrl+Alt+V` 开）、阅读态 `j k d u g G /`、命令面板 `Ctrl+K`、双链 `[[笔记]]` |
| **协作** | 评论（列表内联预览）、点赞、@提醒、站内通知、未提交邮件提醒 |
| **管理** | 用户 / 注册审核 / 分类 / 公告 / 邮件模板 / 审计日志，全部后台可配 |
| **对外** | `/api/seo` 无状态 HMAC token 的统一认证接口（抓取、看板、CI 调用） |

## 快速开始

### Docker（推荐）

```bash
git clone https://github.com/todaymvp/weekly-report.git
cd weekly-report

cp .env.example .env
# 至少改：ADMIN_PASSWORD
# 不发邮件可设 MAIL_MODE=console

docker compose up -d
# → http://localhost:3000
```

### 源码

```bash
npm install
DATA_DIR=./data ADMIN_PASSWORD='change-me' MAIL_MODE=console node server.js
```

### 使用预构建镜像

镜像由 GitHub Actions 在**发布 Release** 时自动构建并推送到 GHCR。

```bash
# 最新
docker pull ghcr.io/todaymvp/weekly-report:latest
# 固定版本（推荐生产）
docker pull ghcr.io/todaymvp/weekly-report:5.16.2

docker run -d --name weekly-report -p 3000:3000 \
  -v /data/study:/app/data \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD='改成强密码' \
  -e MAIL_MODE=console \
  ghcr.io/todaymvp/weekly-report:latest
```

## 配置

全部通过环境变量（完整列表见 `.env.example`）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `APP_PORT` | `3000` | 对外端口 |
| `DATA_PATH` | `./data-dev` | SQLite 与上传目录（**必须持久化**） |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / — | 首次初始化管理员 |
| `COOKIE_SECURE` | `true` | 走 HTTPS 时才可 `true`；本地 http 调试设 `false` |
| `TRUST_PROXY` | `true` | 反代后必须 `true`，否则限流按代理 IP 统计 |
| `DEV_CODE_HINT` | `false` | 生产必须 `false`（否则验证码进接口响应） |
| `MAIL_MODE` | `console` | `console` 打印验证码到日志；`smtp` 走真实邮件 |
| `SITE_URL` | 空 | 邮件里的回链地址 |
| `SEO_CLIENT_ID` / `SEO_CLIENT_SECRET` | — | `/api/seo` 凭据，**生产必须改** |

## 目录结构

```
server.js              Express 入口（静态资源 + 路由挂载 + 限流）
src/
  routes/              auth / reports / forum / admin / seo …
  md-render.js         服务端 Markdown 渲染（vm 复用前端渲染器 + 内容哈希缓存）
  db.js  settings.js  mailer.js  helpers.js
public/
  js/                  app.js（SPA 路由与视图）/ markdown.js / markdown-highlight.js / editor.js
  css/                 style.css / zhihu.css / cupertino/* / blog-theme.css / polish.css
  fonts/               hjsec-serif.woff2（思源宋体子集，OFL）
docs/SEO.md            SEO 接口说明与 Gitea 联动方案
```

## 发布新版本（维护者）

```bash
# 1) 改 VERSION 与 README 徽章
echo "5.17.0" > VERSION
git commit -am "chore: bump version to 5.17.0"
git push origin main        # 或 git push github main

# 2) 打 tag 并推送
git tag -a v5.17.0 -m "v5.17.0"
git push origin v5.17.0

# 3) 在 GitHub 上建 Release（Releases → Draft a new release → 选 v5.17.0 → Publish）
#    发布后 Actions 的 Docker Image 会自动构建并推送：
#      ghcr.io/<owner>/weekly-report:latest
#      ghcr.io/<owner>/weekly-report:5.17.0
#      ghcr.io/<owner>/weekly-report:v5.17.0
```

> 也可以在 Actions 里手动触发 `Docker Image` → Run workflow。

### 首次发布前别忘了

1. 仓库 **Settings → Actions → General** 允许工作流读写（默认即可，`permissions: packages: write` 已在工作流里声明）
2. 包可见性默认 private，发完第一个镜像后去
   `https://github.com/users/<owner>/packages/container/weekly-report/settings`
   → Danger Zone → **Change visibility → Public**

## 开发

```bash
npm run dev      # node --watch
npm run check    # node --check server.js
docker compose -f docker-compose.dev.yml up -d   # 挂载源码，改完 restart 即生效
```

## 安全

- 会话：HttpOnly Cookie + 服务端会话表
- 上传：扩展名 + MIME 双校验，仅站内路径可引用
- Markdown：全程转义，禁原始 HTML
- 部署前必看 [SECURITY.md](./SECURITY.md)

## 路线图

- [ ] Shiki 真正的语法高亮（当前为等价配色的自研高亮）
- [ ] Mermaid 图表渲染
- [ ] 周报导出 PDF / 静态站点
- [ ] 多语言（i18n）

## 贡献

见 [CONTRIBUTING 思路](./.github/pull_request_template.md)：小步提交、附截图、不提交任何密钥。

## 授权

代码 [MIT](./LICENSE)；内置字体子集遵循 [SIL OFL 1.1](./public/fonts/NOTICE.md)。
