PRAGMA foreign_keys = ON;

-- 1. Cost Centers
CREATE TABLE IF NOT EXISTS cost_centers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'department', 'project', 'mission')),
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_centers_code ON cost_centers (organization_id, code);

-- Attach cost center to various entities
ALTER TABLE departments ADD COLUMN cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE SET NULL;
ALTER TABLE missions ADD COLUMN cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE SET NULL;

-- 2. Billing / Profit Margin fields on missions
ALTER TABLE missions ADD COLUMN billing_value REAL NOT NULL DEFAULT 0 CHECK (billing_value >= 0);

-- Impede vínculos entre organizações mesmo quando a escrita não passa pela API.
CREATE TRIGGER IF NOT EXISTS trg_missions_cost_center_org_insert
BEFORE INSERT ON missions
WHEN NEW.cost_center_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM cost_centers cc
    JOIN projects p ON p.id = NEW.project_id
    WHERE cc.id = NEW.cost_center_id
      AND cc.organization_id = p.organization_id
  )
BEGIN
  SELECT RAISE(ABORT, 'mission cost center organization mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_missions_cost_center_org_update
BEFORE UPDATE OF project_id, cost_center_id ON missions
WHEN NEW.cost_center_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM cost_centers cc
    JOIN projects p ON p.id = NEW.project_id
    WHERE cc.id = NEW.cost_center_id
      AND cc.organization_id = p.organization_id
  )
BEGIN
  SELECT RAISE(ABORT, 'mission cost center organization mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_cost_center_org_insert
BEFORE INSERT ON projects
WHEN NEW.cost_center_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cost_centers
    WHERE id = NEW.cost_center_id AND organization_id = NEW.organization_id
  )
BEGIN
  SELECT RAISE(ABORT, 'project cost center organization mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_cost_center_org_update
BEFORE UPDATE OF organization_id, cost_center_id ON projects
WHEN NEW.cost_center_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cost_centers
    WHERE id = NEW.cost_center_id AND organization_id = NEW.organization_id
  )
BEGIN
  SELECT RAISE(ABORT, 'project cost center organization mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_departments_cost_center_org_insert
BEFORE INSERT ON departments
WHEN NEW.cost_center_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cost_centers
    WHERE id = NEW.cost_center_id AND organization_id = NEW.organization_id
  )
BEGIN
  SELECT RAISE(ABORT, 'department cost center organization mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_departments_cost_center_org_update
BEFORE UPDATE OF organization_id, cost_center_id ON departments
WHEN NEW.cost_center_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cost_centers
    WHERE id = NEW.cost_center_id AND organization_id = NEW.organization_id
  )
BEGIN
  SELECT RAISE(ABORT, 'department cost center organization mismatch');
END;

-- 3. Invoices (Faturamento Automático)
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  contract_id TEXT REFERENCES contracts(id) ON DELETE SET NULL,
  amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  reference_month TEXT NOT NULL, -- e.g., '2023-10'
  due_date TEXT,
  paid_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices (client_id, reference_month);

CREATE TRIGGER IF NOT EXISTS trg_invoices_tenant_relations_insert
BEFORE INSERT ON invoices
WHEN NOT EXISTS (
    SELECT 1 FROM clients
    WHERE id = NEW.client_id AND organization_id = NEW.organization_id
  )
  OR (NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM projects
    WHERE id = NEW.project_id AND organization_id = NEW.organization_id
  ))
  OR (NEW.contract_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM contracts
    WHERE id = NEW.contract_id AND organization_id = NEW.organization_id
  ))
BEGIN
  SELECT RAISE(ABORT, 'invoice organization relation mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_invoices_tenant_relations_update
BEFORE UPDATE OF organization_id, client_id, project_id, contract_id ON invoices
WHEN NOT EXISTS (
    SELECT 1 FROM clients
    WHERE id = NEW.client_id AND organization_id = NEW.organization_id
  )
  OR (NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM projects
    WHERE id = NEW.project_id AND organization_id = NEW.organization_id
  ))
  OR (NEW.contract_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM contracts
    WHERE id = NEW.contract_id AND organization_id = NEW.organization_id
  ))
BEGIN
  SELECT RAISE(ABORT, 'invoice organization relation mismatch');
END;
