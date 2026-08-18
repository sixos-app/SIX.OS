-- 0045_employees_and_compensation_history.sql
-- Separação de Usuário e Colaborador, Histórico Salarial, Documentos Privados e Permissões do Financeiro

-- 1. Tabela de Colaboradores (Employees)
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT UNIQUE,
  name TEXT NOT NULL,
  social_name TEXT,
  cpf TEXT,
  rg TEXT,
  emitter_organ TEXT,
  birth_date TEXT,
  marital_status TEXT,
  phone TEXT,
  personal_email TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  zip_code TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Brasil',
  registration_number TEXT,
  department_id TEXT,
  position_id TEXT,
  professional_level_id TEXT,
  manager_id TEXT,
  admission_date TEXT,
  contract_type TEXT DEFAULT 'CLT' CHECK (contract_type IN ('CLT', 'PJ', 'estagio', 'freelancer', 'temporario', 'outro')),
  work_modality TEXT DEFAULT 'hibrido' CHECK (work_modality IN ('presencial', 'remoto', 'hibrido')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'vacation', 'leave', 'terminated')),
  termination_date TEXT,
  termination_reason TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employees_org_status ON employees (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees (user_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept_id ON employees (department_id);

-- 2. Tabela de Histórico de Remuneração (Employee Compensation History)
CREATE TABLE IF NOT EXISTS employee_compensation_history (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  salary REAL NOT NULL DEFAULT 0 CHECK (salary >= 0),
  monthly_hours REAL NOT NULL DEFAULT 220 CHECK (monthly_hours > 0),
  hourly_cost REAL NOT NULL DEFAULT 0 CHECK (hourly_cost >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  reason TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_emp_comp_employee ON employee_compensation_history (employee_id, valid_from);
CREATE INDEX IF NOT EXISTS idx_emp_comp_active ON employee_compensation_history (employee_id) WHERE valid_until IS NULL;

-- 3. Tabela de Documentos Privados do Colaborador (Employee Documents)
CREATE TABLE IF NOT EXISTS employee_documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  folder_category TEXT NOT NULL DEFAULT 'other' CHECK (folder_category IN ('personal', 'contracts', 'payslips', 'medical', 'vacation', 'benefits', 'terms', 'evaluations', 'other')),
  file_name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_by_user_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_emp_docs_category ON employee_documents (employee_id, folder_category);

-- 4. Tabela de Auditoria de Dados Sensíveis (Employee Audit Logs)
CREATE TABLE IF NOT EXISTS employee_audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  details TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_emp_audit_employee ON employee_audit_logs (employee_id, created_at DESC);

-- 5. Atualização da tabela time_entries para suporte a snapshot financeiro imutável
ALTER TABLE time_entries ADD COLUMN hourly_cost_snapshot REAL DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN compensation_history_id TEXT;

-- 6. Adicionar novas permissões V2 de RH & Financeiro
INSERT OR IGNORE INTO permissions (code, module, action, description, sensitivity) VALUES
('employees.view', 'employees', 'view', 'Visualizar lista e dados básicos de colaboradores.', 'medium'),
('employees.create', 'employees', 'create', 'Criar novos registros de colaboradores.', 'high'),
('employees.edit', 'employees', 'edit', 'Editar dados cadastrais de colaboradores.', 'high'),
('employees.view_sensitive', 'employees', 'view_sensitive', 'Visualizar dados pessoais sensíveis (CPF, RG, endereço).', 'critical'),
('employees.edit_sensitive', 'employees', 'edit_sensitive', 'Editar dados pessoais sensíveis.', 'critical'),
('employees.salary.view', 'employees', 'salary_view', 'Visualizar remuneração e histórico salarial.', 'critical'),
('employees.salary.edit', 'employees', 'salary_edit', 'Editar e conceder reajustes salariais.', 'critical'),
('employees.documents.view', 'employees', 'documents_view', 'Visualizar e baixar documentos privados do colaborador.', 'high'),
('employees.documents.upload', 'employees', 'documents_upload', 'Fazer upload de documentos do colaborador.', 'high'),
('employees.documents.delete', 'employees', 'documents_delete', 'Excluir documentos do colaborador.', 'high'),
('employees.history.view', 'employees', 'history_view', 'Visualizar trilha de auditoria do colaborador.', 'high'),
('finance.manage', 'finance', 'manage', 'Gerenciar módulo financeiro.', 'critical'),
('mission_costs.view', 'missions', 'costs_view', 'Visualizar detalhamento financeiro dos custos de missões.', 'high');

-- 7. Criar Perfil de Acesso 'finance' (Financeiro) para cada organização existente
INSERT OR IGNORE INTO access_profiles (id, organization_id, code, name, description, is_system, created_at, updated_at)
SELECT
  'prof-finance-' || org.id,
  org.id,
  'finance',
  'Financeiro / RH',
  'Acesso completo a colaboradores, remuneração, documentos e finanças.',
  1,
  datetime('now'),
  datetime('now')
FROM organizations org;

-- Atribuir permissões ao Perfil Financeiro
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT ap.id, p.code, 'all'
FROM access_profiles ap
CROSS JOIN permissions p
WHERE ap.code = 'finance'
  AND p.code IN (
    'employees.view', 'employees.create', 'employees.edit', 'employees.view_sensitive', 'employees.edit_sensitive',
    'employees.salary.view', 'employees.salary.edit', 'employees.documents.view', 'employees.documents.upload',
    'employees.documents.delete', 'employees.history.view', 'finance.view', 'finance.manage', 'mission_costs.view',
    'time_entries.view', 'reports.view'
  );

-- Technical Admin recebe todas as novas permissões
INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT ap.id, p.code, 'all'
FROM access_profiles ap
CROSS JOIN permissions p
WHERE ap.code = 'admin_tech'
  AND p.code IN (
    'employees.view', 'employees.create', 'employees.edit', 'employees.view_sensitive', 'employees.edit_sensitive',
    'employees.salary.view', 'employees.salary.edit', 'employees.documents.view', 'employees.documents.upload',
    'employees.documents.delete', 'employees.history.view', 'finance.manage', 'mission_costs.view'
  );

-- 8. Migrar usuários existentes para a tabela employees inicializando vínculo e remuneração base
INSERT OR IGNORE INTO employees (
  id, organization_id, user_id, name, personal_email, department_id,
  position_id, professional_level_id, manager_id, status, created_at, updated_at
)
SELECT
  'emp-' || u.id,
  u.organization_id,
  u.id,
  u.name,
  u.email,
  u.department_id,
  u.position_id,
  u.professional_level_id,
  u.manager_id,
  CASE WHEN u.status = 'active' THEN 'active' ELSE 'inactive' END,
  COALESCE(u.created_at, datetime('now')),
  datetime('now')
FROM users u;

-- Criar primeira vigência salarial para colaboradores migrados que possuem hourly_rate > 0
INSERT OR IGNORE INTO employee_compensation_history (
  id, organization_id, employee_id, salary, monthly_hours, hourly_cost,
  currency, valid_from, reason, created_at
)
SELECT
  'comp-' || e.id,
  e.organization_id,
  e.id,
  COALESCE(u.hourly_rate, 0) * 220,
  220,
  COALESCE(u.hourly_rate, 0),
  'BRL',
  COALESCE(u.created_at, datetime('now')),
  'Migração inicial de remuneração base.',
  datetime('now')
FROM employees e
JOIN users u ON u.id = e.user_id
WHERE COALESCE(u.hourly_rate, 0) > 0;
