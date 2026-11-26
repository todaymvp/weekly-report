'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { get } = require('./config');

const DATA_DIR = process.env.DATA_DIR || get('database.dataDir', '') || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const AVATAR_DIR = path.join(DATA_DIR, 'avatars');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  bio           TEXT NOT NULL DEFAULT '',
  avatar_color  TEXT NOT NULL DEFAULT '#6366f1',
  avatar_file   TEXT NOT NULL DEFAULT '',   -- 上传头像的文件名（空=用颜色+首字）
  role          TEXT NOT NULL DEFAULT 'user',
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  category   TEXT NOT NULL DEFAULT '', -- 方向分组：基础知识 / 逆向工程 / Web 安全 …
  hours      REAL NOT NULL DEFAULT 0, -- 已废弃：不再参与统计，仅保留历史数据
  tags       TEXT NOT NULL DEFAULT '',
  summary    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'submitted',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_week ON reports(week_start);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);

CREATE TABLE IF NOT EXISTS attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id   INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL,
  filename    TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime        TEXT NOT NULL DEFAULT '',
  size        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

-- 编辑器内联资源（Markdown 图片）：与周报解耦，
-- 这样新建周报/帖子时就能先传图，二次编辑时图片也不会因为换绑周报而失效
CREATE TABLE IF NOT EXISTS uploads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime        TEXT NOT NULL DEFAULT '',
  size        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id);

CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  category   TEXT NOT NULL DEFAULT 'ask',
  views      INTEGER NOT NULL DEFAULT 0,
  is_pinned  INTEGER NOT NULL DEFAULT 0,
  is_locked  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id   INTEGER NOT NULL,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id   INTEGER,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id);

CREATE TABLE IF NOT EXISTS likes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id   INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id    INTEGER,
  type        TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id   INTEGER,
  message     TEXT NOT NULL DEFAULT '',
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 方向分组：内置默认值，用户可以在写周报时自行新增
CREATE TABLE IF NOT EXISTS report_groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_by INTEGER,
  created_at TEXT NOT NULL
);

-- 邮箱验证码（注册 / 后续可用于找回密码）
CREATE TABLE IF NOT EXISTS email_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL COLLATE NOCASE,
  purpose    TEXT NOT NULL DEFAULT 'register',
  code_hash  TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  consumed   INTEGER NOT NULL DEFAULT 0,
  ip         TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_codes_lookup ON email_codes(email, purpose, consumed);

-- 项目组
CREATE TABLE IF NOT EXISTS groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#6366f1',
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

-- 私信
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(from_id, to_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_id, is_read);

-- 审计日志：谁在什么时候做了什么（后台「日志」页可查，同时打到 stdout）
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    INTEGER,
  actor_name  TEXT NOT NULL DEFAULT '',
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id   INTEGER,
  detail      TEXT NOT NULL DEFAULT '',
  ip          TEXT NOT NULL DEFAULT '',
  user_agent  TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- 邮件发送日志：记录每次发送实际使用的主题（随机主题也需要可追溯）
CREATE TABLE IF NOT EXISTS mail_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email   TEXT NOT NULL DEFAULT '',
  type       TEXT NOT NULL DEFAULT '',
  theme      TEXT NOT NULL DEFAULT '',
  subject    TEXT NOT NULL DEFAULT '',
  ok         INTEGER NOT NULL DEFAULT 0,
  error      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mail_logs_created ON mail_logs(created_at);
`);

/* ---- 轻量迁移：老库补列 ---- */
const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userCols.includes('student_id')) {
  db.exec('ALTER TABLE users ADD COLUMN student_id TEXT');
}
if (!userCols.includes('avatar_file')) {
  db.exec("ALTER TABLE users ADD COLUMN avatar_file TEXT NOT NULL DEFAULT ''");
}
if (!userCols.includes('password_changed_at')) {
  db.exec('ALTER TABLE users ADD COLUMN password_changed_at TEXT');
}
const reportCols = db.prepare('PRAGMA table_info(reports)').all().map((c) => c.name);
if (!reportCols.includes('group_id')) {
  db.exec('ALTER TABLE reports ADD COLUMN group_id INTEGER');
}
if (!reportCols.includes('category')) {
  db.exec("ALTER TABLE reports ADD COLUMN category TEXT NOT NULL DEFAULT ''");
}
db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_id
  ON users(student_id) WHERE student_id IS NOT NULL AND student_id != '';
CREATE INDEX IF NOT EXISTS idx_reports_group ON reports(group_id, week_start);
`);

/* ---- 迁移：允许一周提交多篇周报（去掉 UNIQUE(user_id, week_start)） ---- */
(function dropWeeklyUnique() {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reports'")
    .get();
  if (!row || !/UNIQUE\s*\(\s*user_id\s*,\s*week_start\s*\)/i.test(row.sql || '')) return;

  const cols = db.prepare('PRAGMA table_info(reports)').all().map((c) => c.name);
  const hasGroup = cols.includes('group_id');
  const hasCategory = cols.includes('category');

  // 重建表：SQLite 不支持直接 DROP CONSTRAINT
  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE reports__new (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_start TEXT NOT NULL,
        title      TEXT NOT NULL,
        content    TEXT NOT NULL DEFAULT '',
        hours      REAL NOT NULL DEFAULT 0,
        tags       TEXT NOT NULL DEFAULT '',
        summary    TEXT NOT NULL DEFAULT '',
        status     TEXT NOT NULL DEFAULT 'submitted',
        ${hasCategory ? "category   TEXT NOT NULL DEFAULT ''," : ''}
        ${hasGroup ? 'group_id INTEGER,' : ''}
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO reports__new
        (id, user_id, week_start, title, content, hours, tags, summary, status, ${
          hasCategory ? 'category, ' : ''
        }${hasGroup ? 'group_id, ' : ''}created_at, updated_at)
        SELECT id, user_id, week_start, title, content, hours, tags, summary, status, ${
          hasCategory ? 'category, ' : ''
        }${hasGroup ? 'group_id, ' : ''}created_at, updated_at FROM reports;
      DROP TABLE reports;
      ALTER TABLE reports__new RENAME TO reports;
      CREATE INDEX IF NOT EXISTS idx_reports_week ON reports(week_start);
      CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
      ${hasGroup ? 'CREATE INDEX IF NOT EXISTS idx_reports_group ON reports(group_id, week_start);' : ''}
    `);
    db.exec('COMMIT');
    console.log('[db] 已迁移：周报允许一周提交多篇');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.pragma('foreign_keys = ON');
  }
})();

/* ---- 初始化默认方向分组（只在表为空时写入一次） ---- */
(function seedReportGroups() {
  const { REPORT_GROUPS } = require('./taxonomy');
  if (db.prepare('SELECT COUNT(*) AS c FROM report_groups').get().c > 0) return;
  const ins = db.prepare('INSERT OR IGNORE INTO report_groups (name, created_by, created_at) VALUES (?, NULL, ?)');
  const ts = new Date().toISOString();
  for (const name of REPORT_GROUPS) ins.run(name, ts);
})();

const AVATAR_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'
];

function pickColor(seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

module.exports = { db, DATA_DIR, UPLOAD_DIR, AVATAR_DIR, AVATAR_COLORS, pickColor };
