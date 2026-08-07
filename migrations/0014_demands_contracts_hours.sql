PRAGMA foreign_keys = ON;

-- Clientes: Adicionar campos cadastrais completos de agência
ALTER TABLE clients ADD COLUMN corporate_name TEXT;
ALTER TABLE clients ADD COLUMN cnpj TEXT;
ALTER TABLE clients ADD COLUMN segment TEXT;
ALTER TABLE clients ADD COLUMN units TEXT;
ALTER TABLE clients ADD COLUMN contact_name TEXT;
ALTER TABLE clients ADD COLUMN contact_email TEXT;
ALTER TABLE clients ADD COLUMN contact_phone TEXT;
ALTER TABLE clients ADD COLUMN account_manager_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived'));
ALTER TABLE clients ADD COLUMN brandbook_url TEXT;

-- Contratos e Escopos dos Clientes
CREATE TABLE IF NOT EXISTS contracts (
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

-- Demandas (Macro solicitações do cliente ou internas)
CREATE TABLE IF NOT EXISTS demands (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  demand_type TEXT NOT NULL DEFAULT 'social_media' CHECK (demand_type IN ('social_media', 'campaign', 'branding', 'event', 'audiovisual', 'print', 'institutional')),
  department TEXT NOT NULL DEFAULT 'design' CHECK (department IN ('social_media', 'design', 'copywriting', 'audiovisual', 'media', 'tech', 'account')),
  requester_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  client_due_at TEXT,
  internal_due_at TEXT,
  estimated_hours REAL DEFAULT 0,
  complexity TEXT NOT NULL DEFAULT 'medium' CHECK (complexity IN ('low', 'medium', 'high', 'urgent')),
  scope_type TEXT NOT NULL DEFAULT 'contracted' CHECK (scope_type IN ('contracted', 'extra', 'courtesy')),
  urgency_reason TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'review', 'approval', 'completed', 'cancelled')),
  workflow_stage TEXT NOT NULL DEFAULT 'briefing' CHECK (workflow_stage IN ('briefing', 'planned', 'copywriting', 'design', 'internal_review', 'client_review', 'adjustments', 'supplier', 'approved', 'scheduled', 'completed', 'cancelled')),
  piece_count INTEGER DEFAULT 1,
  piece_formats TEXT,
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tarefas (Etapas executáveis atribuídas a colaboradores)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  demand_id TEXT NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  estimated_hours REAL DEFAULT 0,
  due_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subtarefas (Partes menores de execução dentro da tarefa)
CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Apontamento de Horas e Produtividade
CREATE TABLE IF NOT EXISTS time_entries (
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
  entry_type TEXT NOT NULL DEFAULT 'manual' CHECK (entry_type IN ('manual', 'timer', 'meeting', 'adjustment')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fluxo de Aprovações (Interna vs Cliente)
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  demand_id TEXT NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL DEFAULT 'internal' CHECK (approval_type IN ('internal', 'client')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'changes_requested', 'rejected')),
  version INTEGER NOT NULL DEFAULT 1,
  rounds_count INTEGER NOT NULL DEFAULT 1,
  approver_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  feedback TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de desempenho
CREATE INDEX IF NOT EXISTS idx_demands_client ON demands(client_id, status);
CREATE INDEX IF NOT EXISTS idx_demands_workflow ON demands(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id, status);
