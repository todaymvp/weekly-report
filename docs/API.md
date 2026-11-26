# HJSEC API 接口清单

> 全部 JSON，前缀 `/api`，认证用 Cookie `wrs_sid`。
> 错误格式：非 2xx 返回 `{ "error": "中文提示" }`。
> 分页：`?limit=&offset=`，返回 `{ "total": N, "items": [...] }`。

## 认证 `/api/auth`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/captcha` | 公开 | 图形验证码 `{id, svg, devCode?}` |
| POST | `/email-code` | 公开 | 发送注册邮箱验证码 `{email}` |
| POST | `/register` | 公开 | 注册 `{username,email,displayName,studentId,emailCode,password}` |
| POST | `/login` | 公开 | 登录 `{account,password,captchaId,captchaCode}` |
| POST | `/logout` | 登录 | 退出 |
| GET | `/me` | 公开 | 当前用户 `{user}` |
| PATCH | `/profile` | 登录 | 改资料 `{displayName,bio,avatarColor}` |
| POST | `/password` | 登录 | 改密码 `{oldPassword,newPassword}` |
| POST | `/forgot` | 公开 | 发重置验证码 `{email}` |
| POST | `/reset` | 公开 | 重置密码 `{email,code,password}` |

## 周报 `/api/reports`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/` | 登录 | 列表 `?scope=all|mine&limit&offset&week&tag&category&q` |
| POST | `/` | 登录 | 创建 `{weekStart,title,content,summary,status,tags,category}` |
| GET | `/:id` | 登录 | 详情（含正文、附件） |
| PUT | `/:id` | 作者/管理员 | 更新 |
| DELETE | `/:id` | 作者/管理员 | 删除 |
| GET | `/tags` | 登录 | 标签云 `?week=` |
| GET | `/status` | 登录 | 提交情况 `?weeks=N` |
| GET | `/leaderboard?range=week\|month\|all&limit=50` | 登录 | 成员周报字数排行榜（只统计已提交，含排名/字数/篇数/占比） |
| GET | `/stats/me` | 登录 | 个人统计 |
| GET | `/stats/overview` | 登录 | 团队概览（含排行、分组统计） |
| GET | `/by-user/:uid` | 登录 | 某人全部周报（个人主页用） |
| POST | `/:id/like` | 登录 | 点赞/取消 |
| GET | `/:id/comments` | 登录 | 评论列表 |
| POST | `/:id/comments` | 登录 | 发评论 `{content}` |
| POST | `/:id/attachments` | 作者/管理员 | 上传附件 |

## 用户 / 头像 `/api/users`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/avatar` | 登录 | 上传自己的头像（multipart `avatar`） |
| DELETE | `/avatar` | 登录 | 移除自己的头像 |
| GET | `/:id/avatar` | 公开 | 读取用户头像图片 |

## 编辑器素材 `/api/uploads`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/image` | 登录 | 上传正文图片（multipart `image`） |
| POST | `/markdown` | 登录 | 导入 .md（multipart `file`，返回纯文本） |
| GET | `/:id` | 登录 | 读取已上传图片 |
| DELETE | `/:id` | 上传者/管理员 | 删除图片 |

## 成员 / 通知 `/api`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/members` | 登录 | 成员列表（含统计） |
| GET | `/users?q=` | 登录 | 用户搜索（@提及用） |
| GET | `/comments/recent?limit=` | 登录 | 最近评论（Feed 用，含周报作者 `reportAuthor`） |
| GET | `/notifications` | 登录 | 通知列表 `{unread, items}` |
| POST | `/notifications/read-all` | 登录 | 全部已读 |
| GET | `/attachments/:id` | 登录 | 下载附件 |

## 管理后台 `/api/admin`

> 全部需要 `requireAdmin`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/stats` | 概览统计 |
| GET | `/users?q=&limit=` | 用户列表 |
| PATCH | `/users/:id` | 改用户（role/status/displayName/username/email/studentId/bio） |
| POST | `/users/:id/avatar` | 代传头像（multipart `avatar`） |
| DELETE | `/users/:id/avatar` | 移除头像 |
| POST | `/users/:id/reset-password` | 重置密码 `{password}` |
| GET | `/reports` | 周报管理列表 |
| DELETE | `/reports/:id` | 删除周报 |
| POST | `/repair-escapes` | 批量修复旧内容转义 |
| GET/PUT | `/status-excluded` | 提交情况排除名单 |
| GET/PUT | `/week-base` | 周次基准 `{start,num}` |
| GET/PUT | `/smtp` | SMTP 配置（含 siteUrl） |
| POST | `/smtp/test` | SMTP 连接检测 |
| GET/PUT | `/mail/themes` | 邮件主题：模式（随机/固定）、启用集合、默认主题、最近发送记录 |
| GET/PUT | `/mail/theme` | 兼容旧接口（等同读写固定主题） |
| GET | `/mail/preview?theme=&kind=` | 主题预览（真实模板 HTML，`theme=random` 随机一套） |
| POST | `/mail/preview/send` | 发送测试邮件 `{to, kind, theme}` |
| GET | `/mail/recipients` | 群发收件人 |
| POST | `/mail/send` | 群发邮件 |
| GET/PUT | `/settings` | 系统设置（站点名/公告/注册/评论邮件/uiStyle/uiLocked/头像样式） |
| POST | `/logo` | 上传站点 Logo |
| DELETE | `/logo` | 移除 Logo |
| GET | `/logs?q=&action=&range=&limit=` | 审计日志 |
| GET/PUT | `/reminders` | 周报提醒配置 |
| POST | `/reminders/send` | 手动发送提醒 `{stage:'sat'|'sun', ids?}` |

## 站点 `/api`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/site` | 公开 | 站点信息 `{siteName,uiStyle,uiLocked,logoUrl,modalNotice,allowRegister,...}` |
| GET | `/health` | 公开 | 健康检查 `{ok,version,time}` |
| GET | `/branding/logo` | 公开 | 站点 Logo 图片 |

## 设置项（PUT /api/admin/settings 可改）

| 字段 | 值 | 说明 |
|---|---|---|
| siteName | string | 站点名称 |
| siteNotice | string | 登录页公告 |
| allowRegister | bool | 开放注册 |
| commentMail | bool | 评论邮件通知 |
| uiStyle | `zhihu` / `github` | 界面风格（默认） |
| uiLocked | bool | 锁定界面风格（忽略用户切换） |
| defaultAvatarProvider | `letter` / `github` | 默认头像样式 |
| modalNotice | `{enabled,title,body,pinned}` | 弹窗公告 |

## 数据结构补充

### GET /api/reports/leaderboard 返回

```json
{
  "range": "all",
  "from": null,
  "currentWeek": "2026-11-23",
  "totalMembers": 3,
  "totalChars": 2139,
  "totalReports": 9,
  "items": [
    {
      "rank": 1, "id": 2, "displayName": "林知", "username": "linzhi",
      "reports": 3, "chars": 1065, "weeks": 3, "avgChars": 355,
      "weekChars": 355, "share": 49.8, "relative": 100
    }
  ],
  "me": { "rank": 1, "chars": 1065, "reports": 3, "weekChars": 355 }
}
```

`range=week` 本周、`month` 近四周、`all` 累计；只统计 `status='submitted'` 的周报正文，
与「提交情况」共用 `status_excluded` 排除名单。

### GET /api/comments/recent 返回项（Feed 用）

```json
{
  "id": 12, "content": "...", "createdAt": "...",
  "reportId": 34, "reportTitle": "周报标题", "reportWeek": "2026-11-23",
  "reportAuthor": { "id": 2, "displayName": "林知", "username": "linzhi", "avatarUrl": "" },
  "author": { "id": 5, "displayName": "王宇", "username": "wangyu", "avatarUrl": "" }
}
```

- `author`：评论者；`reportAuthor`：被评论周报的作者（两种 UI 风格动态列表里显示「评论了 XXX 的周报」都依赖它，周报被删时为 `null`）。
