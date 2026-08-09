ALTER TABLE users ADD COLUMN username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  iterations INTEGER NOT NULL CHECK (iterations >= 100000),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);

INSERT OR IGNORE INTO users (id, organization_id, team_id, name, email, role, username) VALUES
  ('user-agsix-admin', 'org-six', 'team-six', 'Administração SIX', 'agsix@sixos.app', 'admin', 'agsix');

INSERT OR IGNORE INTO gamification_profiles (user_id, xp, ideas, level, streak_days) VALUES
  ('user-agsix-admin', 0, 0, 'Administrador', 0);

INSERT OR IGNORE INTO user_role_assignments (user_id, role_code) VALUES
  ('user-agsix-admin', 'admin');

INSERT OR IGNORE INTO user_credentials (user_id, password_salt, password_hash, iterations) VALUES
  ('user-agsix-admin', 'MKfeKYaVzqLsgqUtFa5g+g==', 'rE/3XV2yHGDxylW0NXbz5cJN5bCD+ebD2q18nj1wqY0=', 310000);
