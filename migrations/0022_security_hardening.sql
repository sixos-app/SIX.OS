-- One-time security hardening. Existing sessions are revoked so that every
-- account must authenticate again after the trust-boundary fixes are deployed.
DELETE FROM auth_sessions;

-- Remove the historical bootstrap credential only when it is still unchanged.
-- A deliberately rotated credential is preserved.
DELETE FROM user_credentials
WHERE user_id = 'user-agsix-admin'
  AND password_salt = 'MKfeKYaVzqLsgqUtFa5g+g=='
  AND password_hash = 'rE/3XV2yHGDxylW0NXbz5cJN5bCD+ebD2q18nj1wqY0=';

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  identifier_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_updated
  ON auth_login_attempts(updated_at);
