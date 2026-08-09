PRAGMA foreign_keys = ON;

-- 1. Evaluation Debriefs (Devolutivas)
CREATE TABLE IF NOT EXISTS evaluation_debriefs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cycle_id TEXT REFERENCES evaluation_cycles(id) ON DELETE SET NULL,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'completed', 'cancelled')),
  notes TEXT,
  meeting_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_eval_debriefs_org ON evaluation_debriefs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_eval_debriefs_subject ON evaluation_debriefs(subject_user_id);

-- 2. Development Plans (PDIs)
CREATE TABLE IF NOT EXISTS development_plans (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subject_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  source_cycle_id TEXT REFERENCES evaluation_cycles(id) ON DELETE SET NULL,
  source_debrief_id TEXT REFERENCES evaluation_debriefs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dev_plans_org ON development_plans(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_dev_plans_subject ON development_plans(subject_user_id);

-- 3. Development Goals
CREATE TABLE IF NOT EXISTS development_goals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES development_plans(id) ON DELETE CASCADE,
  competency_id TEXT REFERENCES competencies(id) ON DELETE SET NULL,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  success_criteria TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
  target_date TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dev_goals_plan ON development_goals(plan_id);

-- 4. Development Actions
CREATE TABLE IF NOT EXISTS development_actions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES development_goals(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
  target_date TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dev_actions_goal ON development_actions(goal_id);

-- 5. Development Evidence
CREATE TABLE IF NOT EXISTS development_evidence (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  goal_id TEXT REFERENCES development_goals(id) ON DELETE CASCADE,
  action_id TEXT REFERENCES development_actions(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  text_content TEXT,
  link_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  CHECK (goal_id IS NOT NULL OR action_id IS NOT NULL)
);

-- 6. Development Check-ins
CREATE TABLE IF NOT EXISTS development_checkins (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES development_plans(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meeting_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dev_checkins_plan ON development_checkins(plan_id);

-- 7. Development Check-in Entries
CREATE TABLE IF NOT EXISTS development_checkin_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  checkin_id TEXT NOT NULL REFERENCES development_checkins(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dev_checkin_entries_checkin ON development_checkin_entries(checkin_id);


-- Permissões (RBAC V2) para Módulo de Desenvolvimento
INSERT OR IGNORE INTO permissions (code, module, action, description, sensitivity) VALUES
('development.plans.view', 'evolution', 'view', 'Visualizar Planos de Desenvolvimento Individual.', 'medium'),
('development.plans.create', 'evolution', 'create', 'Criar Planos de Desenvolvimento Individual.', 'medium'),
('development.plans.edit', 'evolution', 'edit', 'Editar e atualizar metas e ações de PDIs.', 'medium'),
('development.plans.manage', 'evolution', 'manage', 'Gerenciar PDIs globalmente (Suporte/RH).', 'high'),
('development.monitor', 'evolution', 'view', 'Acompanhar painéis e indicadores de PDIs sem permissão de edição direta.', 'medium'),
('development.debriefs.view', 'evolution', 'view', 'Visualizar devolutivas e feedbacks estruturados.', 'high'),
('development.debriefs.edit', 'evolution', 'edit', 'Conduzir e registrar devolutivas.', 'high');

-- Atribuição de permissões aos perfis
-- RH / Operations Management / Admin (Acesso Monitor / Departamental / Total)
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'development.monitor', 'department' FROM access_profiles WHERE code IN ('operations_management');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'development.monitor', 'all' FROM access_profiles WHERE code IN ('admin_tech');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'development.plans.manage', 'all' FROM access_profiles WHERE code IN ('admin_tech');

-- Liderança e Coordenação (Acesso Equipe)
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'development.plans.view', 'team' FROM access_profiles WHERE code IN ('coordinator', 'operations_management', 'admin_tech');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'development.plans.create', 'team' FROM access_profiles WHERE code IN ('coordinator', 'operations_management', 'admin_tech');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'development.plans.edit', 'team' FROM access_profiles WHERE code IN ('coordinator', 'operations_management', 'admin_tech');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'development.debriefs.view', 'team' FROM access_profiles WHERE code IN ('coordinator', 'operations_management', 'admin_tech');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'development.debriefs.edit', 'team' FROM access_profiles WHERE code IN ('coordinator', 'operations_management', 'admin_tech');

-- Todos (Acesso próprio para os demais)
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'development.plans.view', 'own' FROM access_profiles WHERE is_active = 1;

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'development.plans.create', 'own' FROM access_profiles WHERE is_active = 1;

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'development.plans.edit', 'own' FROM access_profiles WHERE is_active = 1;

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'development.debriefs.view', 'own' FROM access_profiles WHERE is_active = 1;
