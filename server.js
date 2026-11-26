'use strict';

const path = require('path');
require('./src/config'); // 先加载 appsettings.json，把值补进 process.env
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const { db, pickColor } = require('./src/db');
const { attachUser, purgeExpired } = require('./src/auth');
const { nowIso, weekStartOf, notify } = require('./src/helpers');
const { siteSettings } = require('./src/settings');
const log = require('./src/logger');
const VERSION = require('./src/version');
const { pruneAuditLogs } = require('./src/audit');
const reminders = require('./src/reminders');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ============================ 安全中间件 ============================ */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );
  if (process.env.COOKIE_SECURE === 'true') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(cookieParser());
app.use(attachUser);

/* ---------------- 访问日志（docker logs 直接可见） ---------------- */
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    const meta = {
      ip: req.ip,
      user: req.user ? req.user.username : '-',
      status: res.statusCode,
      ms: Date.now() - started
    };
    const line = `${req.method} ${req.originalUrl}`;
    // 健康检查探针每 30 秒一次，压到 debug，别把访问日志刷满
    const isProbe = req.originalUrl === '/api/health';
    if (res.statusCode >= 500) log.error(line, meta);
    else if (res.statusCode >= 400) log.warn(line, meta);
    else if (req.originalUrl.startsWith('/api') && !isProbe) log.info(line, meta);
    else log.debug(line, meta); // 静态资源与健康探针默认不打，LOG_LEVEL=debug 时才看得到
  });
  next();
});

// CSRF：SameSite=Lax Cookie + 同源校验（写操作一律拒绝跨站来源）
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const site = req.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    return res.status(403).json({ error: '跨站请求已被拦截' });
  }
  const origin = req.get('origin');
  if (origin) {
    let host;
    try {
      host = new URL(origin).host;
    } catch {
      return res.status(403).json({ error: '非法来源' });
    }
    if (host !== req.get('host')) return res.status(403).json({ error: '跨站请求已被拦截' });
  }
  next();
});

// 轻量限流（内存版，够单实例用；多实例请换 Redis）
const buckets = new Map();
function rateLimit({ name, windowMs, max }) {
  return (req, res, next) => {
    const k = `${name}:${req.ip}`; // 每个限流器独立计桶
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || b.reset < now) {
      b = { count: 0, reset: now + windowMs };
      buckets.set(k, b);
    }
    b.count += 1;
    if (b.count > max) {
      res.setHeader('Retry-After', Math.ceil((b.reset - now) / 1000));
      return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    }
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60000).unref();

app.use('/api', rateLimit({ name: 'api', windowMs: 60000, max: 600 }));
app.use('/api/auth/login', rateLimit({ name: 'login', windowMs: 10 * 60000, max: 12 }));
app.use('/api/auth/register', rateLimit({ name: 'register', windowMs: 60 * 60000, max: 10 }));
// 忘记密码：发码 8 次/10 分钟，重置 15 次/10 分钟（按 IP）
app.use('/api/auth/forgot', rateLimit({ name: 'forgot', windowMs: 10 * 60000, max: 8 }));
app.use('/api/auth/reset', rateLimit({ name: 'reset', windowMs: 10 * 60000, max: 15 }));

/* ============================ 路由 ============================ */
app.get('/api/health', (_req, res) => res.json({ ok: true, version: VERSION, time: nowIso() }));

// 站点公开信息（登录页展示站点名 / 是否开放注册）
app.get('/api/site', (_req, res) => res.json(siteSettings()));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/uploads', require('./src/routes/uploads'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/branding', require('./src/routes/branding'));
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/report-groups', require('./src/routes/reportGroups'));
app.use('/api/posts', require('./src/routes/forum'));
app.use('/api/messages', require('./src/routes/messages'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/admin/mail', require('./src/routes/mailbroadcast'));
app.use('/api/seo', require('./src/routes/seo'));   // 对外 SEO 统一认证（骨架）
app.use('/api', require('./src/routes/misc'));

app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在' }));

/* ============================ 静态资源 ============================ */
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(
  express.static(PUBLIC_DIR, {
    index: 'index.html',
    etag: true,
    lastModified: true,
    dotfiles: 'ignore',
    // 每次都协商缓存（命中 ETag 返回 304），保证发版后浏览器立即拿到新前端
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache')
  })
);
// Express 5 移除了 '*' 字符串路径：这里用兜底中间件把前端路由交回 SPA
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

/* ============================ 错误兜底 ============================ */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) log.error('[error] ' + err.message, { path: req.originalUrl, stack: String(err.stack || '').split('\n').slice(0, 3).join(' | ') });
  else log.warn('[error] ' + err.message, { path: req.originalUrl, status });
  res.status(status).json({
    error: status >= 500 ? '服务器开小差了，请稍后重试' : err.message
  });
});

/* ============================ 初始化数据 ============================ */
/* 项目组 / 私信演示数据：只在 groups 表为空时写入一次 */
function seedGroups() {
  // 兼容早期版本的演示账号：学号列是后加的，这里补齐一次
  for (const [uname, sid] of [
    ['linzhi', '2024010101'],
    ['wangyu', '2024010102'],
    ['chenxi', '2024010103']
  ]) {
    const row = db.prepare('SELECT id, student_id FROM users WHERE username = ?').get(uname);
    if (row && !row.student_id && !db.prepare('SELECT id FROM users WHERE student_id = ?').get(sid)) {
      db.prepare('UPDATE users SET student_id = ? WHERE id = ?').run(sid, row.id);
    }
  }

  if (db.prepare('SELECT COUNT(*) AS c FROM groups').get().c > 0) return;
  const uid = (name) => {
    const u = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
    return u ? u.id : null;
  };
  if (!uid('linzhi')) return;

  const ts = nowIso();
  const defs = [
    { name: 'Web', desc: 'Web 安全：SQL 注入、XSS、SSRF、文件上传与反序列化', color: '#0ea5e9', leader: 'linzhi', members: ['wangyu'] },
    { name: '逆向', desc: '逆向工程：二进制分析、脱壳、协议还原与恶意样本分析', color: '#8b5cf6', leader: 'wangyu', members: ['chenxi'] },
    { name: 'PWN', desc: 'PWN：栈溢出、堆利用、格式化字符串与 CTF 实战', color: '#ef4444', leader: 'chenxi', members: ['linzhi'] }
  ];

  for (const d of defs) {
    if (db.prepare('SELECT id FROM groups WHERE name = ? COLLATE NOCASE').get(d.name)) continue;
    const info = db
      .prepare('INSERT INTO groups (name, description, color, owner_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(d.name, d.desc, d.color, uid(d.leader), ts);
    db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').run(
      info.lastInsertRowid,
      uid(d.leader),
      'leader',
      ts
    );
    for (const m of d.members) {
      if (uid(m)) {
        db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').run(
          info.lastInsertRowid,
          uid(m),
          'member',
          ts
        );
      }
    }
  }

  const cvGroup = db.prepare("SELECT id FROM groups WHERE name = 'Web'").get();
  if (cvGroup) {
    db.prepare('UPDATE reports SET group_id = ? WHERE user_id = ? AND group_id IS NULL').run(cvGroup.id, uid('linzhi'));
  }

  const lid = uid('linzhi');
  const wid = uid('wangyu');
  if (lid && wid && db.prepare('SELECT COUNT(*) AS c FROM messages').get().c === 0) {
    db.prepare('INSERT INTO messages (from_id, to_id, content, is_read, created_at) VALUES (?, ?, ?, 1, ?)').run(
      wid,
      lid,
      '看到你这周的 ViT 周报了，patch embedding 那段讲得很清楚 👍',
      ts
    );
    db.prepare('INSERT INTO messages (from_id, to_id, content, is_read, created_at) VALUES (?, ?, ?, 0, ?)').run(
      lid,
      wid,
      '谢谢！下周准备复现 Swin 的 window attention，到时候一起看看？',
      ts
    );
  }
}

function seed() {
  const adminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin'").get().c;
  if (adminCount === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    db.prepare(
      `INSERT INTO users (username, email, password_hash, display_name, avatar_color, role, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'admin', 'active', ?)`
    ).run(username, email, bcrypt.hashSync(password, 10), '系统管理员', '#6366f1', nowIso());
    console.log(`[init] 已创建管理员账号：${username} / ${password}（请及时修改密码）`);
  }

  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const postCount = db.prepare('SELECT COUNT(*) AS c FROM posts').get().c;
  if (process.env.SEED_DEMO === 'false' || (userCount > 1 && postCount > 0)) return;

  const hash = bcrypt.hashSync('123456', 10);
  const demos = [
    ['linzhi', '林知', '2024010101', '计算机视觉方向，正在啃 Transformer 源码'],
    ['wangyu', '王宇', '2024010102', '后端开发，最近在学 Rust 与分布式'],
    ['chenxi', '陈曦', '2024010103', '产品经理转全栈，边做边学']
  ];
  for (const [username, display, sid, bio] of demos) {
    if (db.prepare('SELECT id FROM users WHERE username=?').get(username)) continue;
    db.prepare(
      `INSERT INTO users (username, email, password_hash, display_name, student_id, bio, avatar_color, role, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'user', 'active', ?)`
    ).run(username, `${username}@example.com`, hash, display, sid, bio, pickColor(username), nowIso());
  }

  const ids = db.prepare("SELECT id, username FROM users WHERE username IN ('linzhi','wangyu','chenxi')").all();
  const uid = (name) => (ids.find((u) => u.username === name) || {}).id;
  if (!uid('linzhi')) return;

  const weeks = [];
  let ws = weekStartOf();
  for (let i = 0; i < 4; i += 1) {
    const d = new Date(ws + 'T00:00:00');
    d.setDate(d.getDate() - 7 * i);
    weeks.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  }

  const samples = [
    {
      user: 'linzhi',
      title: '把 ViT 的 Patch Embedding 彻底搞懂了',
      summary: '从卷积等价视角重看 ViT',
      tags: 'Transformer,ViT,论文精读',
      content:
        '## 本周目标\n把 ViT 里的 patch embedding 为什么能用卷积实现这件事搞明白。\n\n## 学习内容\n1. 精读 ViT 原文第 3.1 节，手推了一遍 patch 切分维度。\n2. 用 `unfold` 复现了 patch 切分，验证与 `Conv2d(kernel=stride=patch)` 等价。\n3. 看了 Swin 的 shift window 图解。\n\n## 关键收获\n\n> 当 kernel_size == stride == patch_size 且 padding=0 时，卷积与 patch 切分在数学上完全等价，所以工程上直接用 Conv2d 实现更快。\n\n## 下周计划\n- 复现 Swin-T 的 window attention\n- 输出一篇笔记到组内 wiki'
    },
    {
      user: 'wangyu',
      title: 'Rust 所有权与借用检查器：从抗拒到接受',
      summary: '第 4 章 + 实战改写一个数据清洗脚本',
      tags: 'Rust,系统编程',
      content:
        '## 这周做了什么\n把之前用 Python 写的数据清洗脚本用 Rust 重写了一遍，性能从 42s 降到 1.8s。\n\n## 踩坑记录\n- `borrow of moved value`：原因是在循环里把 `String` 直接传给了函数，改成 `&str` 就通了。\n- 生命周期标注第一次真正理解了：返回值引用必须活得比函数调用长。\n\n## 心得\n借用检查器不是刁难人，它在帮我把并发 bug 提前到编译期。'
    },
    {
      user: 'chenxi',
      title: '用一周时间把 React 状态管理理顺了',
      summary: 'useState/useReducer/Context 边界划分',
      tags: 'React,前端,状态管理',
      content:
        '## 学习路径\n1. 官方文档 Hooks 章节通读\n2. 用 useReducer 重构了表单页\n3. 把跨页面共享的状态抽到 Context\n\n## 结论\n组件内部状态用 `useState`，复杂状态机用 `useReducer`，跨层级但低频更新用 `Context`，高频更新还是得上状态库。'
    }
  ];

  let i = 0;
  for (const s of samples) {
    for (const week of weeks) {
      if (i % 4 === 3) {
        i += 1;
        continue; // 制造一些空缺，让连续打卡有差异
      }
      const ts = nowIso();
      try {
        db.prepare(
          `INSERT INTO reports (user_id, week_start, title, content, tags, summary, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`
        ).run(uid(s.user), week, s.title, s.content, s.tags, s.summary, ts, ts);
      } catch {
        /* 忽略重复 */
      }
      i += 1;
    }
  }

  if (postCount === 0) {
    const posts = [
      {
        user: 'linzhi',
        category: 'ask',
        title: 'ViT 的 position embedding 为什么可以插值扩展到更大分辨率？',
        content:
          '看到很多实现里在推理时对 position embedding 做双线性插值，理论上为什么可行？会不会破坏位置关系？\n\n有没有推荐的分析文章，或者 @wangyu 你有没有试过？'
      },
      {
        user: 'wangyu',
        category: 'share',
        title: '分享一套我用了半年的「周报模板」',
        content:
          '结构很简单：\n\n1. 本周目标（上周定下的）\n2. 实际完成 / 未完成原因\n3. 关键收获（写具体，别写"学习了 XX"）\n4. 下周计划（不超过 3 条）\n\n关键是第 3 点，逼自己把知识压缩成一句话，写不出来的就是没学会。'
      },
      {
        user: 'chenxi',
        category: 'checkin',
        title: '第 8 周打卡：每天 1 小时算法题',
        content: '今天完成了 3 道滑动窗口，模板终于不用看题解了。继续加油。'
      }
    ];
    const ts = nowIso();
    for (const p of posts) {
      const info = db
        .prepare(
          `INSERT INTO posts (user_id, title, content, category, views, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(uid(p.user), p.title, p.content, p.category, 3 + Math.floor(Math.random() * 40), ts, ts);

      if (p.category === 'ask') {
        db.prepare(
          `INSERT INTO comments (target_type, target_id, user_id, parent_id, content, created_at)
           VALUES ('post', ?, ?, NULL, ?, ?)`
        ).run(
          info.lastInsertRowid,
          uid('wangyu'),
          '因为插值后的向量仍然保留了相对位置的光滑性，模型主要依赖的是相对距离而非绝对坐标。参考 CLIP 的实现，他们直接把插值后的 embedding 当作可学习参数微调了一下。',
          ts
        );
        notify({
          userId: uid('linzhi'),
          actorId: uid('wangyu'),
          type: 'comment',
          targetType: 'post',
          targetId: info.lastInsertRowid,
          message: '评论了你的帖子'
        });
      }
    }
  }
}

seed();
seedGroups();
purgeExpired();
pruneAuditLogs();
setInterval(() => {
  purgeExpired();
  pruneAuditLogs();
}, 3600000).unref();
reminders.startScheduler(); // 周六/周日 22:00 的周报提醒

app.listen(PORT, '0.0.0.0', () => {
  if (String(process.env.MAIL_MODE || (process.env.SMTP_HOST ? 'smtp' : 'console')).toLowerCase() !== 'smtp') {
    log.warn('邮件为 console 模式：验证码 / 提醒只会打到日志，不会真正发信（设 MAIL_MODE=smtp 并配好 SMTP_* 才是真发）');
  }
  log.info(`周报系统已启动：http://localhost:${PORT}`, {
    logLevel: log.level,
    mailMode: process.env.MAIL_MODE || (process.env.SMTP_HOST ? 'smtp' : 'console'),
    dataDir: process.env.DATA_DIR || 'data'
  });
});
