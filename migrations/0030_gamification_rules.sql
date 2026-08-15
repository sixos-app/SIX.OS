PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS xp_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  base_xp INTEGER NOT NULL CHECK (base_xp BETWEEN 0 AND 10000),
  recipient_mode TEXT NOT NULL DEFAULT 'responsible' CHECK (recipient_mode IN ('responsible', 'participants_split', 'participants_each')),
  on_time_bonus_percent INTEGER NOT NULL DEFAULT 0 CHECK (on_time_bonus_percent BETWEEN 0 AND 100),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS xp_rule_roles (
  rule_id TEXT NOT NULL REFERENCES xp_rules(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL REFERENCES role_definitions(code) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, role_code)
);

CREATE TABLE IF NOT EXISTS xp_rule_departments (
  rule_id TEXT NOT NULL REFERENCES xp_rules(id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, department_id)
);

ALTER TABLE missions ADD COLUMN xp_rule_id TEXT REFERENCES xp_rules(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS xp_awards (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id TEXT REFERENCES xp_rules(id) ON DELETE SET NULL,
  rule_version INTEGER,
  rule_name TEXT NOT NULL,
  base_xp INTEGER NOT NULL CHECK (base_xp >= 0),
  bonus_xp INTEGER NOT NULL DEFAULT 0 CHECK (bonus_xp >= 0),
  final_xp INTEGER NOT NULL CHECK (final_xp >= 0),
  recipient_mode TEXT NOT NULL,
  awarded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (mission_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_xp_rules_org ON xp_rules(organization_id, is_active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_awards_org ON xp_awards(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_missions_xp_rule ON missions(xp_rule_id);

INSERT INTO xp_rules (id, organization_id, name, description, base_xp, recipient_mode, on_time_bonus_percent, is_active, version)
SELECT 'xp-rule-default-' || organizations.id, organizations.id, 'Entrega de missão', 'Regra padrão para missões aprovadas.', 80, 'responsible', 20, 1, 1
FROM organizations
WHERE NOT EXISTS (SELECT 1 FROM xp_rules WHERE xp_rules.organization_id = organizations.id);
