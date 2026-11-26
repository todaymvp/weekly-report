# HJSEC 架构设计

## 总体架构

```
┌──────────────────────────────────────────────────┐
│              Gitea (git + registry + CI)          │
└────────────────────┬─────────────────────────────┘
                     │ push main → Actions
                     ▼
┌──────────────────────────────────────────────────┐
│         CI: build image → push → deploy          │
│         (docker compose pull → up -d)            │
└────────────────────┬─────────────────────────────┘
                     ▼
┌──────────────────────────────────────────────────┐
│              服务器 (Docker)                      │
│  ┌──────────────────────────────────────────┐    │
│  │  weekly-report 容器 (node:22-slim)       │    │
│  │  ├── Express 应用 (server.js)            │    │
│  │  ├── SQLite: /app/data/app.db            │    │
│  │  ├── 上传: /app/data/uploads             │    │
│  │  ├── 头像: /app/data/avatars             │    │
│  │  ├── 品牌图: /app/data/branding          │    │
│  │  └── HEALTHCHECK /api/health             │    │
│  └──────────────────────────────────────────┘    │
│         数据卷: ${DATA_PATH}:/app/data            │
└──────────────────────────────────────────────────┘
```

## 请求流

```
浏览器 (原生前端 SPA)
    │ Cookie: wrs_sid
    ▼
Express 中间件链
    ├── 安全头 (CSP / nosniff / frame-ancestors)
    ├── JSON body 解析 (256KB)
    ├── Cookie 解析 → attachUser (session 查询)
    ├── CSRF 同源校验
    ├── 限流 (内存桶: api 600/min, login 12/10min, ...)
    ├── 访问日志 (logger.js)
    └── 路由分发 /api/*
         ├── routes/auth.js      → bcrypt + sessions 表 + 邮件
         ├── routes/reports.js   → reports + comments + likes + attachments
         ├── routes/admin.js     → requireAdmin → users/settings/logs
         ├── routes/users.js     → avatarstore.js
         ├── routes/branding.js  → branding.js
         ├── routes/misc.js      → notifications / members / recent comments
         ├── routes/uploads.js   → multer → uploads/
         └── settings.js         → settings 表 (运行时配置)
    ▼
SQLite (better-sqlite3, WAL)
    ├── users / sessions / reports / comments / likes / attachments
    ├── posts / notifications / messages / uploads / groups
    ├── email_codes / settings / audit_logs / report_groups
    └── 迁移: PRAGMA table_info → ALTER TABLE
```

## 关键设计决策

### 双皮肤（知乎 / GitHub）

前端无框架，用 CSS 属性选择器实现皮肤切换：

```html
<html data-ui="zhihu" data-theme="dark">
```

- `style.css`：基础设计系统（GitHub Light token）+ 全部组件
- `zhihu.css`：`[data-ui='zhihu']` 覆盖层（颜色 / 布局差异）
- 深色模式：`[data-theme='dark']` 覆盖 token（GitHub Dark / 知乎夜间）

切换逻辑（app.js）：

1. 用户偏好存 `localStorage.wsec-ui`（优先级最高）
2. 后台默认存 `settings.ui_style`（经 `/api/site` 下发）
3. 管理员锁定 `settings.ui_locked` 时忽略用户偏好
4. `applyUiStyle()` 设置 `data-ui` 属性 → CSS 自动生效
5. `renderShell()` 根据当前皮肤选择外壳（`renderShellZhihu()` 或 GitHub 侧栏）

首页「最新动态」Feed 由 `viewFeedZhihu()` / `viewFeed()` 各自组装，数据源相同
（`/api/reports` + `/api/members` + `/api/comments/recent` + 统计），按时间倒序合并。

> 注意：两种皮肤是**分别渲染**的，新增字段时两处都要改。曾出现 GitHub 皮肤评论动态
> 漏传 `reportAuthor`，导致「评论了 XXX 的周报」里作者名为空；知乎皮肤正常。
> `/api/comments/recent` 返回的 `reportAuthor` 是被评论周报的作者（周报被删时为 `null`），
> `author` 是评论者。

### 头像链路

```
userAvatar(u, cls)
  ├── u.avatarUrl 存在 → 上传的图片（/api/users/:id/avatar）
  ├── settings.default_avatar_provider == 'github' → identicon(u.username)
  └── 否则 → avatar(u, cls) 首字 + avatarColor
```

- 上传：`avatarstore.js`（文件头嗅探 + 随机文件名 + DATA_DIR/avatars/）
- identicon：前端按 username 确定性生成（5×5 对称色块），不入库

### 配置体系

```
优先级（高→低）：
1. 环境变量（docker compose / CI / 命令行）
2. appsettings.json（支持 ${ENV} 引用）
3. 代码内置默认值
```

运行时设置（settings 表）优先于配置文件默认值——后台改过的不会被覆盖。

### 审计日志

```js
audit({ actor, action: 'login', detail: '登录成功', req })
// → INSERT audit_logs + log.info('audit login', {...})
```

保留 90 天，`pruneAuditLogs()` 每小时清理。

### 邮件

SMTP 配置存 `settings` 表（后台「邮件设置」），`sendMail()` 从数据库读取，新增 `verifySmtp()` 做真实握手检测。
每次发信写 `mail_send` / `mail_failed` 审计记录。

模板分层（一套业务逻辑、多套视觉主题、服务端随机选择、统一变量渲染）：

```
src/email/
├── engine/
│   ├── variables.js   buildContext()：业务字段 → 主题消费的统一 ctx
│   ├── renderer.js    render / renderWithTheme / renderSelected
│   └── selector.js    随机 / 固定选择、启用集合、兜底与配置快照
└── themes/
    ├── index.js       主题注册表（新增主题只改这里）
    ├── _shared.js     <html>/<head>/<body> 外壳 + 580px 容器
    ├── nature.js      Nature 自然（浅色、圆角、衬线标题）
    ├── hacker.js      Hacker 终端（黑底终端绿、等宽、日志行）
    ├── cyberpunk.js   Cyberpunk 霓虹（深紫 + 紫青霓虹、网格信息）
    ├── developer.js   Developer 工程师（GitHub 风、代码块、标签表）
    └── minimal.js     Minimal 极简（白底大留白、单点蓝）
```

`src/mail_templates.js` 只保留业务内容（标题/正文/状态/按钮/签名）与 `plain()` 纯文本，
渲染交给 `email/engine`。业务函数签名不变，因此通知调用点改动最小。

主题相关设置（`settings` 表）：

| key | 说明 |
|---|---|
| `mail_theme_mode` | `random` / `fixed` |
| `mail_theme_default` | 固定主题，也是全部禁用时的兜底（默认 `nature`） |
| `mail_themes_enabled` | JSON 数组，参与随机的主题；空 = 全部 |

`renderMail(kind, data)` 是发送链路入口：**先选一次主题**，再用同一主题渲染，
返回 `{ html, theme }`；`theme` 原样传给 `sendMail()` 写入 `mail_logs`，
SMTP 重试复用同一份 HTML，因此不会中途换主题。预览走 `renderAs(theme, fn, data)`，
与发送同一条渲染路径，保证所见即所得。

### 周报提醒

`reminders.js` 每分钟检查（`setInterval`）：
- 周六 `satTime` → 提醒未提交
- 周日 `sunTime` → 未提交通知
- 幂等：`settings.reminder_last_sat/sun` 记录当天日期
- 手动发送：`POST /api/admin/reminders/send`

### 版本管理

`VERSION` 文件 → `src/version.js` → `/api/health` 返回。
发版只改 VERSION，不动 package.json，避免 Docker 依赖层缓存失效。

## 安全设计

| 层 | 措施 |
|---|---|
| 认证 | bcrypt(10)、Session 32B hex、HttpOnly Cookie、强制下线 |
| 授权 | requireAuth / requireAdmin / 资源属主检查 |
| CSRF | SameSite=Lax + Origin 校验 |
| 限流 | 内存桶（api/login/register/forgot/reset） |
| 上传 | 文件头嗅探 + 白名单扩展名 + 随机文件名 + 路径校验 |
| XSS | 前端 escapeHtml 后渲染 + CSP 无 unsafe-inline script |
| 注入 | better-sqlite3 参数化查询 |
| 日志 | 密码不落日志；审计记录操作者 IP + UA |
| 邮箱枚举 | 忘记密码对不存在邮箱返回相同结果 |
| 审计保留 | 90 天自动清理 |

## 双皮肤样式覆盖链

```
style.css（基础）
  :root { --primary:#0969da; --bg:#f6f8fa; ... }        ← GitHub Light
  [data-theme='dark'] { ... }                            ← GitHub Dark

zhihu.css（覆盖层，仅 [data-ui='zhihu'] 时生效）
  [data-ui='zhihu'] { --zh-blue:#1677ff; --zh-bg:#f6f7f8; ... }
  [data-ui='zhihu'] .btn { border-radius:3px; ... }      ← 覆盖组件样式
  [data-ui='zhihu'][data-theme='dark'] { ... }           ← 知乎夜间
```

## 性能要点

- SQLite WAL：读不阻塞写
- 前端无构建：静态文件直接托管，ETag 协商缓存
- 头像：带版本号 URL，`Cache-Control: public, max-age=604800`
- 图片上传：multer memoryStorage + 同步写盘（单实例够用）
- 限流：内存 Map（单实例够用，多实例换 Redis）
- 日志：stdout + docker json-file（max-size 10m × 3）
