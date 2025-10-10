-- up
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sub TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  email_hash TEXT,
  name TEXT,
  picture TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  last_seen_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at);

-- down
DROP TABLE IF EXISTS users;

