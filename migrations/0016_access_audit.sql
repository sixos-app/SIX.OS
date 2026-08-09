PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS access_audit_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_access_audit_log_org ON access_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_log_target ON access_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_log_action ON access_audit_log(action);
