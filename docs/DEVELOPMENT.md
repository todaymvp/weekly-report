# HJSEC 安全学习周报 · 开发维护手册

> HJSEC · 科协安全部 · Security Department
> 面向科协安全部成员的周报、技术交流、知识沉淀与团队协作平台

## 项目概览

- 技术栈：Node.js 22+ · Express 5 · SQLite (better-sqlite3) · 原生前端（无框架、无构建）
- 部署形态：单容器 + 数据卷，Gitea Actions CI 自动构建
- 版本管理：`VERSION` 文件 + git tag，发版只改 VERSION

## 快速开始

```bash
# 首次
git pull origin main
./start.sh dev          # 本地启动（端口 3001，验证码回显）

# 日常开发循环
./start.sh restart      # 改完代码重启（源码已挂载进容器）
./start.sh logs         # 看日志
./start.sh down         # 停止
./start.sh reset        # 清空数据重来
```

**邮件配置**：登录后「管理后台 → 邮件设置」填 SMTP，点「测试连接」验证。
无需改任何文件、无需重启、无需设环境变量。

本地无 Docker 时：

```bash
npm install --registry=https://registry.npmmirror.com
npm install-scripts approve better-sqlite3 && npm rebuild better-sqlite3 --foreground-scripts
DATA_DIR=/tmp/wrs-dev PORT=3001 DEV_CODE_HINT=true MAIL_MODE=console node server.js
```

## 目录结构

```
├── server.js              # 入口：Express 应用、中间件、路由挂载、定时任务
├── VERSION                # 版本号（/api/health 返回；改它不影响 npm 层缓存）
├── package.json           # 依赖清单
├── appsettings.json       # 运行配置（SMTP / 周次 / 提醒 / 管理员），不进 git
├── appsettings.example.json
├── start_dev.sh           # 本地开发一键脚本
├── docker-compose.yml     # 生产部署
├── docker-compose.dev.yml # 本地开发（源码挂载进容器）
├── Dockerfile             # 多阶段构建
├── .gitea/workflows/      # CI：push main 触发构建和部署
│
├── src/                   # 后端
│   ├── config.js          # 配置加载（appsettings.json + env，env 优先）
│   ├── db.js              # SQLite 连接、建表、迁移
│   ├── settings.js        # 运行时设置（数据库 settings 表）
│   ├── version.js         # 读 VERSION 文件
│   ├── auth.js            # 会话、requireAuth / requireAdmin
│   ├── audit.js           # 审计日志（audit_logs 表 + stdout）
│   ├── logger.js          # 结构化 stdout 日志（LOG_LEVEL）
│   ├── mailer.js          # SMTP / console 邮件
│   ├── emailcode.js       # 注册/重置邮箱验证码
│   ├── captcha.js         # 图形验证码
│   ├── branding.js        # 站点 Logo 存储
│   ├── imageinfo.js       # 图片文件头嗅探
│   ├── avatarstore.js     # 头像存储（用户自助 + 管理员代传）
│   ├── reminders.js       # 周报提醒定时任务（周六/周日 22:00）
│   ├── mail_templates.js  # 邮件业务内容层（标题/正文/状态/按钮，渲染委托给 email/）
│   ├── email/             # 邮件主题引擎（一套业务、多套视觉、服务端随机）
│   │   ├── engine/
│   │   │   ├── variables.js   # buildContext()：业务字段 → 统一变量接口
│   │   │   ├── renderer.js    # render / renderWithTheme / renderMail
│   │   │   └── selector.js    # 随机/固定选择、启用集合、兜底
│   │   └── themes/            # nature / hacker / cyberpunk / developer / minimal + index
│   ├── taxonomy.js        # 方向分组常量
│   ├── helpers.js         # 通用工具（nowIso、notify、publicUser 等）
│   ├── routes/
│   │   ├── auth.js        # 注册/登录/登出/忘记密码/重置密码
│   │   ├── users.js       # 用户头像自助上传/移除/读取
│   │   ├── reports.js     # 周报 CRUD、评论、点赞、附件、统计、个人主页
│   │   ├── forum.js       # 帖子（社区模块，入口已下线接口保留）
│   │   ├── messages.js    # 私信（同上）
│   │   ├── uploads.js     # 正文图片、.md 导入
│   │   ├── admin.js       # 管理后台全部接口
│   │   ├── misc.js        # 通知、成员列表、最近评论、附件下载
│   │   └── branding.js    # 站点 Logo 公开读取
│   └── ...
│
├── public/                # 前端（无构建，直接静态托管）
│   ├── index.html
│   ├── img/               # logo-mask.png（默认品牌图）
│   ├── css/
│   │   ├── style.css      # 设计系统 + 全部组件 + 页面样式
│   │   └── zhihu.css      # 知乎皮肤覆盖层（data-ui="zhihu" 时生效）
│   └── js/
│       ├── app.js         # 前端主逻辑（路由 + 全部视图 + 组件）
│       ├── api.js         # fetch 封装（统一错误处理）
│       ├── editor.js      # 富文本编辑器（Markdown 双向）
│       └── markdown.js    # Markdown 渲染器（含 Obsidian 语法）
│
└── docs/                  # 文档
    ├── ARCHITECTURE.md    # 架构与数据流
    ├── API.md             # API 接口清单
    ├── DEPLOY.md          # 部署文档（生产）
    └── DEVELOPMENT.md     # 本文件
```

## 前端架构

单页应用（hash 路由），无框架：

- `public/js/app.js`：路由分发（`navigate()`）+ 所有视图函数 + 组件
- 双皮肤：`data-ui="zhihu|github"` 属性切换，`zhihu.css` 只覆盖差异部分
- 主题：`data-theme="light|dark"` 属性切换
- 视图函数：`viewFeed`（首页）、`viewReports`（周报总览/我的）、`viewMembers`、`viewStatus`、`viewReportDetail`、`viewEditor`、`viewSettings`、`viewAdmin`、`viewNotifications`、`viewProfile`（个人主页）

### 双皮肤切换机制

```js
// 用户偏好存 localStorage（wsec-ui），后台默认存 settings.ui_style
// 管理员锁定（ui_locked）时忽略用户偏好
const uiIsZhihu = () => effectiveUi() !== 'github';
document.documentElement.dataset.ui = uiIsZhihu() ? 'zhihu' : 'github';
```

顶栏「知乎 / GitHub」胶囊按钮调用 `setUiStyle()`，即时重建外壳并导航。

## 后端架构

- 所有路由挂载在 `/api` 前缀下，`server.js` 统一注册
- 权限：`requireAuth`（登录即可）、`requireAdmin`（管理员）
- 数据库：SQLite 单文件（`DATA_DIR/app.db`），WAL 模式
- 迁移：`db.js` 里用 `PRAGMA table_info` 检查后 `ALTER TABLE`，老库自动升级
- 审计：所有敏感操作写 `audit_logs` 表 + stdout（`docker compose logs` 可见）
- 邮件：`mailer.js`，`MAIL_MODE=smtp|console`，console 模式只打日志

## API 约定

- 全部 JSON，前缀 `/api`
- 错误：非 2xx 返回 `{ error: "中文提示" }`
- 认证：Cookie `wrs_sid`（HttpOnly）
- 分页：`?limit=&offset=`，返回 `{ total, items }`

主要接口分组：

| 前缀 | 说明 | 文件 |
|---|---|---|
| `/api/auth` | 注册/登录/忘记密码 | routes/auth.js |
| `/api/reports` | 周报 CRUD、评论、点赞、统计、字数排行榜 | routes/reports.js |
| `/api/reports/leaderboard` | 成员周报字数排行榜（`range=week\|month\|all`） | routes/reports.js |
| `/api/users` | 头像自助管理 | routes/users.js |
| `/api/uploads` | 正文图片、.md 导入 | routes/uploads.js |
| `/api/admin` | 管理后台全部 | routes/admin.js |
| `/api/members` | 成员列表 | routes/misc.js |
| `/api/comments/recent` | 最近评论（Feed 用） | routes/misc.js |
| `/api/branding` | 站点 Logo | routes/branding.js |
| `/api/site` | 公开站点信息（含 modalNotice） | src/settings.js |

完整接口清单见 `docs/API.md`。

## 版本发布流程

```bash
# 1. 更新版本号（三处同步）
echo "2.2.0" > VERSION
# package.json 的 version 也改（或不管，VERSION 优先）

# 2. 提交
git add -A
git commit -m "feat: 描述（v2.2.0）"

# 3. 打 tag 并推送
git tag -a v2.2.0 -m "描述"
git push origin main && git push origin v2.2.0
```

- `push main` 触发 CI：构建镜像 → 推 registry → SSH 部署
- 只推 tag 不触发部署
- 注意 zsh 用户：heredoc（`<<MSG`）可能有兼容问题，建议把提交信息写到文件里 `git commit -F file`

## 开发注意事项

1. **改前端**：改 `public/` 下的文件，dev 模式已挂载进容器，`  ./start.sh restart` 即生效
2. **改后端**：改 `src/` 或 `server.js`，dev 模式同样挂载；改依赖需重建镜像
3. **改数据库**：在 `db.js` 加迁移块（`PRAGMA table_info` 检查 → `ALTER TABLE`），不能破坏老数据
4. **加接口**：在对应 routes 文件加路由，`server.js` 已挂载的前缀下自动生效；权限用 `requireAuth`/`requireAdmin`
5. **头像**：全站统一走 `userAvatar(u, cls)`，不要直接用 `avatar()`——它按后台设置渲染 identicon/首字
6. **日志**：用 `logger.js`（`log.info/warn/error`），不要直接 `console.log`
7. **审计**：敏感操作加 `audit({ actor, action, ... })`
8. **通知**：用 `helpers.js` 的 `notify()`，会写 notifications 表 + 可触发邮件
9. **测试**：手动或 Playwright，改完至少过一遍登录 → 写周报 → 评论 → 管理后台全 tab

## 常见问题

**Q: 启动报 `Cannot find module 'better-sqlite3'`**
A: 原生模块没编译。`npm install-scripts approve better-sqlite3 && npm rebuild better-sqlite3`

**Q: npm 12 拦截 install script**
A: `npm install-scripts approve better-sqlite3` 或在 CI 里跳过

**Q: 容器重启循环，`EACCES: mkdir '/app/data/uploads'`**
A: 数据卷目录属主是 root。`sudo chown -R 1000:1000 <目录>` 或换 `DATA_PATH`

**Q: zsh 里 heredoc 报 bad substitution**
A: 改用 `git commit -F <文件>` 或切 bash

**Q: LOG_LEVEL 怎么看日志**
A: `docker compose logs -f`；`LOG_LEVEL=debug` 显示静态资源请求，`info` 只显示 API 和审计

## 相关文档

- [API.md](API.md) — 接口清单
- [ARCHITECTURE.md](ARCHITECTURE.md) — 架构设计
- [../DEPLOY.md](../DEPLOY.md) — 生产部署
