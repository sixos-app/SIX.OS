PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS professional_positions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS professional_levels (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS access_profiles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS permissions (
  code TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  sensitivity TEXT NOT NULL DEFAULT 'low' CHECK (sensitivity IN ('low', 'medium', 'high', 'critical')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profile_permissions (
  profile_id TEXT NOT NULL REFERENCES access_profiles(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('own', 'team', 'department', 'assigned_clients', 'participating_projects', 'unit', 'all')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id, permission_code)
);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('own', 'team', 'department', 'assigned_clients', 'participating_projects', 'unit', 'all')),
  is_granted INTEGER NOT NULL CHECK (is_granted IN (0, 1)),
  reason TEXT,
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  starts_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN department_id TEXT REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN position_id TEXT REFERENCES professional_positions(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN professional_level_id TEXT REFERENCES professional_levels(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN access_profile_id TEXT REFERENCES access_profiles(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN manager_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'inactive'));

CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_access_profile ON users(access_profile_id);
CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_id);
CREATE INDEX IF NOT EXISTS idx_professional_positions_department ON professional_positions(department_id);
CREATE INDEX IF NOT EXISTS idx_profile_permissions_profile ON profile_permissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_permissions_code ON profile_permissions(permission_code);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_code ON user_permission_overrides(permission_code);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_expires ON user_permission_overrides(expires_at);

-- Inserir Perfis de Acesso Básicos correspondentes aos papéis do RBAC v1
INSERT OR IGNORE INTO access_profiles (id, organization_id, code, name, description, is_system, is_active)
SELECT 'profile-admin', 'org-six', 'admin_tech', 'Administrador Técnico', 'Acesso total ao sistema.', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM access_profiles WHERE code = 'admin_tech');

INSERT OR IGNORE INTO access_profiles (id, organization_id, code, name, description, is_system, is_active)
SELECT 'profile-mgmt', 'org-six', 'operations_management', 'Gerência de Operações', 'Visão geral, projetos e aprovações.', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM access_profiles WHERE code = 'operations_management');

INSERT OR IGNORE INTO access_profiles (id, organization_id, code, name, description, is_system, is_active)
SELECT 'profile-coord', 'org-six', 'coordinator', 'Coordenador', 'Distribuição de missões e coordenação da equipe.', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM access_profiles WHERE code = 'coordinator');

INSERT OR IGNORE INTO access_profiles (id, organization_id, code, name, description, is_system, is_active)
SELECT 'profile-service', 'org-six', 'service', 'Atendimento', 'Clientes, projetos, briefings e acompanhamento.', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM access_profiles WHERE code = 'service');

INSERT OR IGNORE INTO access_profiles (id, organization_id, code, name, description, is_system, is_active)
SELECT 'profile-specialist', 'org-six', 'specialist', 'Especialista', 'Execução das próprias missões e envio de arquivos.', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM access_profiles WHERE code = 'specialist');

-- Backfill para usuários existentes (mapeando user_role_assignments para access_profile_id)
UPDATE users
SET access_profile_id = (
  CASE 
    WHEN (SELECT role_code FROM user_role_assignments WHERE user_id = users.id LIMIT 1) = 'admin' THEN 'profile-admin'
    WHEN (SELECT role_code FROM user_role_assignments WHERE user_id = users.id LIMIT 1) = 'management' THEN 'profile-mgmt'
    WHEN (SELECT role_code FROM user_role_assignments WHERE user_id = users.id LIMIT 1) = 'coordinator' THEN 'profile-coord'
    WHEN (SELECT role_code FROM user_role_assignments WHERE user_id = users.id LIMIT 1) = 'service' THEN 'profile-service'
    WHEN (SELECT role_code FROM user_role_assignments WHERE user_id = users.id LIMIT 1) = 'specialist' THEN 'profile-specialist'
    ELSE 'profile-specialist'
  END
)
WHERE access_profile_id IS NULL;
