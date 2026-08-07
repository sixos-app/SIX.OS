-- ==========================================================
-- SIX.OS - SCRIPT DE RESET DE BANCO DE DADOS PARA LANÇAMENTO
-- ==========================================================
-- ATENÇÃO: Este script zera completamente dados de teste/demonstração
-- e recria a estrutura limpa e oficial para o lançamento da agência.
-- ==========================================================

PRAGMA foreign_keys = OFF;

-- 1. DROP DAS TABELAS EXISTENTES
DROP TABLE IF EXISTS agency_feed;
DROP TABLE IF EXISTS access_sessions;
DROP TABLE IF EXISTS admin_credentials;
DROP TABLE IF EXISTS user_rbac_roles;
DROP TABLE IF EXISTS rbac_permissions;
DROP TABLE IF EXISTS rbac_roles;
DROP TABLE IF EXISTS client_libraries;
DROP TABLE IF EXISTS project_libraries;
DROP TABLE IF EXISTS integration_connections;
DROP TABLE IF EXISTS calendar_events;
DROP TABLE IF EXISTS xp_events;
DROP TABLE IF EXISTS gamification_profiles;
DROP TABLE IF EXISTS approvals;
DROP TABLE IF EXISTS time_entries;
DROP TABLE IF EXISTS subtasks;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS demands;
DROP TABLE IF EXISTS mission_history;
DROP TABLE IF EXISTS mission_assignees;
DROP TABLE IF EXISTS missions;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS organizations;

PRAGMA foreign_keys = ON;

-- 2. CRIAÇÃO DA ESTRUTURA OFICIAL (SCHEMA PRODUÇÃO)

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'collaborator',
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_code TEXT,
  image_url TEXT,
  corporate_name TEXT,
  cnpj TEXT,
  segment TEXT,
  units TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  account_manager_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  brandbook_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contracts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  monthly_deliverables INTEGER NOT NULL DEFAULT 0,
  hour_limit REAL NOT NULL DEFAULT 0,
  agreed_deadline_days INTEGER DEFAULT 3,
  revision_rounds INTEGER DEFAULT 2,
  monthly_balance REAL NOT NULL DEFAULT 0,
  contract_value REAL DEFAULT 0,
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'renewed', 'expired', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'approval', 'delivered', 'archived')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  due_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE demands (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  demand_type TEXT NOT NULL DEFAULT 'social_media',
  department TEXT NOT NULL DEFAULT 'design',
  requester_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  client_due_at TEXT,
  internal_due_at TEXT,
  estimated_hours REAL DEFAULT 0,
  complexity TEXT NOT NULL DEFAULT 'medium',
  scope_type TEXT NOT NULL DEFAULT 'contracted',
  urgency_reason TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  workflow_stage TEXT NOT NULL DEFAULT 'briefing',
  piece_count INTEGER DEFAULT 1,
  piece_formats TEXT,
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  demand_id TEXT NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  estimated_hours REAL DEFAULT 0,
  due_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE time_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  demand_id TEXT REFERENCES demands(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hours INTEGER NOT NULL DEFAULT 0,
  minutes INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL DEFAULT (date('now')),
  description TEXT,
  entry_type TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  demand_id TEXT NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL DEFAULT 'internal',
  status TEXT NOT NULL DEFAULT 'pending',
  version INTEGER NOT NULL DEFAULT 1,
  rounds_count INTEGER NOT NULL DEFAULT 1,
  approver_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  feedback TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE missions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  visual_tone TEXT NOT NULL DEFAULT 'lime',
  xp_reward INTEGER NOT NULL DEFAULT 0,
  ideas_reward INTEGER NOT NULL DEFAULT 0,
  reward_label TEXT,
  due_at TEXT,
  completed_at TEXT,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mission_assignees (
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (mission_id, user_id)
);

CREATE TABLE gamification_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  ideas INTEGER NOT NULL DEFAULT 0 CHECK (ideas >= 0),
  level TEXT NOT NULL DEFAULT 'Criativo Iniciante',
  streak_days INTEGER NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE xp_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL,
  xp INTEGER NOT NULL,
  ideas INTEGER NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  event_type TEXT NOT NULL DEFAULT 'meeting',
  visibility TEXT NOT NULL DEFAULT 'private',
  created_by_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE integration_connections (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, provider)
);

CREATE TABLE project_libraries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  storage_path TEXT NOT NULL,
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  version_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE client_libraries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  folder_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  storage_path TEXT NOT NULL,
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  version_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rbac_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rbac_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (role_id, permission_code)
);

CREATE TABLE user_rbac_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE admin_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE access_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. SEED INICIAL LIMPO DE PRODUÇÃO (SEM DADOS SIMULADOS)

INSERT INTO organizations (id, name, slug) VALUES 
  ('org-six', 'Agência SIX', 'agencia-six');

-- Perfis RBAC Padrão
INSERT INTO rbac_roles (id, name, code, description) VALUES
  ('role-admin', 'Administrador', 'admin', 'Acesso total à administração e configurações'),
  ('role-management', 'Gestão', 'management', 'Gestão operacional de clientes, contratos e relatórios'),
  ('role-coordinator', 'Coordenador', 'coordinator', 'Coordenação de equipes e atribuição de demandas'),
  ('role-account', 'Atendimento', 'account', 'Relacionamento com clientes e criação de demandas'),
  ('role-specialist', 'Especialista', 'specialist', 'Execução de tarefas de criação, redação e mídia');

-- Permissões Padrão do Administrador
INSERT INTO rbac_permissions (id, role_id, permission_code) VALUES
  ('p-admin-1', 'role-admin', 'admin.all'),
  ('p-admin-2', 'role-admin', 'users.manage'),
  ('p-admin-3', 'role-admin', 'clients.manage'),
  ('p-admin-4', 'role-admin', 'demands.manage'),
  ('p-admin-5', 'role-admin', 'reports.view');

-- Administrador Inicial Oficial
INSERT INTO users (id, organization_id, name, email, role) VALUES 
  ('user-agsix-admin', 'org-six', 'Administração SIX', 'six.guimell@gmail.com', 'admin');

INSERT INTO user_rbac_roles (user_id, role_id) VALUES 
  ('user-agsix-admin', 'role-admin');

INSERT INTO gamification_profiles (user_id, xp, ideas, level, streak_days) VALUES 
  ('user-agsix-admin', 0, 0, 'Visionário', 0);

-- Credencial Administrador Padrão (Senha inicial segura)
INSERT INTO admin_credentials (user_id, password_hash, password_salt) VALUES 
  ('user-agsix-admin', '5c8227b9ef8347f805a8b7921200236a992bcfa1b7f04c6be662ecb04c869911', 'salt_six_os_2026');

-- ==========================================================
-- BANCO PRONTO E LIMPO PARA O LANÇAMENTO OFICIAL DO SIX.OS!
-- ==========================================================
