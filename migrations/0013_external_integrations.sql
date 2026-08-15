CREATE TABLE IF NOT EXISTS external_integrations (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  config_json TEXT NOT NULL,
  is_active INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  organization_id TEXT
);

-- Providers are created only after an administrator supplies an encrypted
-- configuration. Migrations intentionally contain no placeholder secrets.
