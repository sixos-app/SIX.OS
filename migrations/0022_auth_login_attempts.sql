-- Migration: Create auth_login_attempts for brute-force protection
CREATE TABLE IF NOT EXISTS auth_login_attempts (
  identifier_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL
);
