PRAGMA foreign_keys = ON;

-- 1. Permissões de Tipos de Trabalho
INSERT OR IGNORE INTO permissions (code, module, action, description, sensitivity) VALUES
  ('work_types.view', 'work_types', 'view', 'Visualizar tipos de trabalho do catálogo.', 'low'),
  ('work_types.manage', 'work_types', 'manage', 'Criar, editar e desativar tipos de trabalho.', 'medium');

INSERT OR IGNORE INTO role_permissions (role_code, permission) VALUES
  ('admin', 'work_types.view'), ('admin', 'work_types.manage'),
  ('management', 'work_types.view'), ('management', 'work_types.manage'),
  ('coordinator', 'work_types.view'), ('coordinator', 'work_types.manage'),
  ('service', 'work_types.view'), ('service', 'work_types.manage'),
  ('specialist', 'work_types.view');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT access_profiles.id, permissions.code, 'all'
FROM access_profiles
JOIN permissions ON permissions.code IN ('work_types.view', 'work_types.manage')
WHERE access_profiles.code IN ('admin_tech', 'operations_management', 'coordinator', 'service');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT access_profiles.id, 'work_types.view', 'all'
FROM access_profiles
WHERE access_profiles.code NOT IN ('admin_tech', 'operations_management', 'coordinator', 'service');

-- 2. Tabela de Tipos de Trabalho Multi-empresa
CREATE TABLE IF NOT EXISTS work_types (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  default_minutes INTEGER NOT NULL DEFAULT 60 CHECK (default_minutes >= 5 AND default_minutes <= 10080),
  color_key TEXT NOT NULL DEFAULT 'lime',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_work_types_org_active
  ON work_types(organization_id, is_active);

-- 3. Tabela de Relacionamento Projeto / Tipos de Trabalho
CREATE TABLE IF NOT EXISTS project_work_types (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_type_id TEXT NOT NULL REFERENCES work_types(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, work_type_id)
);

CREATE INDEX IF NOT EXISTS idx_project_work_types_type
  ON project_work_types(work_type_id);

-- 4. Colunas de compatibilidade e tipo de trabalho na missão
ALTER TABLE missions ADD COLUMN work_type_id TEXT REFERENCES work_types(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN color_key TEXT DEFAULT 'lime';
ALTER TABLE missions ADD COLUMN color_key TEXT DEFAULT 'lime';

CREATE INDEX IF NOT EXISTS idx_missions_work_type
  ON missions(work_type_id);

-- 5. Seed inicial de tipos de trabalho padrão para organizações existentes
INSERT OR IGNORE INTO work_types (id, organization_id, name, normalized_name, default_minutes, color_key, is_active)
SELECT 'wt-design-' || id, id, 'Design / Peça', 'design / peca', 120, 'lime', 1 FROM organizations;

INSERT OR IGNORE INTO work_types (id, organization_id, name, normalized_name, default_minutes, color_key, is_active)
SELECT 'wt-copy-' || id, id, 'Redação / Conteúdo', 'redacao / conteudo', 90, 'purple', 1 FROM organizations;

INSERT OR IGNORE INTO work_types (id, organization_id, name, normalized_name, default_minutes, color_key, is_active)
SELECT 'wt-planning-' || id, id, 'Planejamento / Estratégia', 'planejamento / estrategia', 180, 'blue', 1 FROM organizations;

INSERT OR IGNORE INTO work_types (id, organization_id, name, normalized_name, default_minutes, color_key, is_active)
SELECT 'wt-video-' || id, id, 'Vídeo / Motion', 'video / motion', 240, 'orange', 1 FROM organizations;

INSERT OR IGNORE INTO work_types (id, organization_id, name, normalized_name, default_minutes, color_key, is_active)
SELECT 'wt-social-' || id, id, 'Social Media / Post', 'social media / post', 60, 'cyan', 1 FROM organizations;

INSERT OR IGNORE INTO work_types (id, organization_id, name, normalized_name, default_minutes, color_key, is_active)
SELECT 'wt-service-' || id, id, 'Atendimento / Alinhamento', 'atendimento / alinhamento', 60, 'pink', 1 FROM organizations;
