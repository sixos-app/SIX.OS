PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS evaluation_cycles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cycle_type TEXT NOT NULL, -- performance, leadership, 360
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'review', 'closed', 'archived')),
  starts_at TEXT,
  responses_due_at TEXT,
  results_available_at TEXT,
  closed_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competency_categories (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competencies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES competency_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  guidance TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evaluation_scales (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evaluation_scale_options (
  id TEXT PRIMARY KEY,
  scale_id TEXT NOT NULL REFERENCES evaluation_scales(id) ON DELETE CASCADE,
  numeric_value INTEGER NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS evaluation_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scale_id TEXT REFERENCES evaluation_scales(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evaluation_questions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES evaluation_templates(id) ON DELETE CASCADE,
  competency_id TEXT REFERENCES competencies(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rating', 'text', 'boolean')),
  required INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evaluation_cycle_participants (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL REFERENCES evaluation_cycles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evaluation_assignments (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL REFERENCES evaluation_cycles(id) ON DELETE CASCADE,
  subject_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('self', 'manager', 'direct_report', 'peer')),
  is_confidential INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted')),
  started_at TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evaluation_responses (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES evaluation_assignments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evaluation_answers (
  id TEXT PRIMARY KEY,
  response_id TEXT NOT NULL REFERENCES evaluation_responses(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES evaluation_questions(id) ON DELETE CASCADE,
  rating_value INTEGER,
  text_value TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_eval_cycles_org ON evaluation_cycles(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_reviewer ON evaluation_assignments(reviewer_user_id, status);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_subject ON evaluation_assignments(subject_user_id);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_cycle ON evaluation_assignments(cycle_id);

-- Inserir as Novas Permissões (Evolution Module)
INSERT OR IGNORE INTO permissions (code, module, action, description, sensitivity) VALUES
('evaluations.view', 'evolution', 'view', 'Acessar o módulo Evolução (Visão Geral).', 'low'),
('evaluations.respond', 'evolution', 'create', 'Responder a avaliações atribuídas.', 'low'),
('evaluations.results.view_own', 'evolution', 'view', 'Visualizar os próprios resultados liberados.', 'low'),
('evaluations.results.view_team', 'evolution', 'view', 'Visualizar resultados consolidados da equipe.', 'medium'),
('evaluations.cycles.view', 'evolution', 'view', 'Visualizar a lista e os detalhes de ciclos de avaliação.', 'medium'),
('evaluations.cycles.manage', 'evolution', 'manage', 'Criar, configurar e gerenciar ciclos de avaliação.', 'high'),
('evaluations.competencies.manage', 'evolution', 'manage', 'Gerenciar banco de competências e categorias.', 'high'),
('evaluations.assign_reviewers', 'evolution', 'manage', 'Configurar participantes e atribuir avaliadores.', 'high'),
('evaluations.monitor', 'evolution', 'view', 'Acompanhar o progresso e pendências das avaliações.', 'medium'),
('evaluations.close_cycle', 'evolution', 'manage', 'Encerrar ciclos e liberar consolidações.', 'high'),
('evaluations.confidential.view', 'evolution', 'view', 'Ler comentários originais e identificar autoria de respostas confidenciais.', 'critical');

-- Vincular Permissões aos Perfis (Usando RBAC V2 System Profiles)
-- NOTA: O script a seguir assume que os perfis originais (admin_tech, operations_management, coordinator, service, specialist) foram criados na 0015_rbac_v2.sql.

-- 1. Permissões básicas para todos os perfis ativos
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.view', 'all' FROM access_profiles WHERE is_active = 1;

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.respond', 'own' FROM access_profiles WHERE is_active = 1;

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.results.view_own', 'own' FROM access_profiles WHERE is_active = 1;

-- 2. Permissões para Coordenadores (Coordinator)
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.cycles.view', 'team' FROM access_profiles WHERE code IN ('coordinator');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.results.view_team', 'team' FROM access_profiles WHERE code IN ('coordinator');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.monitor', 'team' FROM access_profiles WHERE code IN ('coordinator');

-- 3. Permissões para Gerência (Operations Management)
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.results.view_team', 'department' FROM access_profiles WHERE code IN ('operations_management');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.cycles.view', 'department' FROM access_profiles WHERE code IN ('operations_management');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.monitor', 'department' FROM access_profiles WHERE code IN ('operations_management');

-- 4. Permissões Globais para Administrador (Admin Tech)
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.results.view_team', 'all' FROM access_profiles WHERE code = 'admin_tech';

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.cycles.view', 'all' FROM access_profiles WHERE code = 'admin_tech';

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.cycles.manage', 'all' FROM access_profiles WHERE code = 'admin_tech';

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.competencies.manage', 'all' FROM access_profiles WHERE code = 'admin_tech';

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.assign_reviewers', 'all' FROM access_profiles WHERE code = 'admin_tech';

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.monitor', 'all' FROM access_profiles WHERE code = 'admin_tech';

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.close_cycle', 'all' FROM access_profiles WHERE code = 'admin_tech';

-- Somente admin_tech ganha visualização de confidencialidade de forma global por default
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'evaluations.confidential.view', 'all' FROM access_profiles WHERE code = 'admin_tech';
