PRAGMA foreign_keys = ON;

-- Client master fields remain optional so legacy clients stay valid.
ALTER TABLE clients ADD COLUMN trade_name TEXT;
ALTER TABLE clients ADD COLUMN state_registration TEXT;
ALTER TABLE clients ADD COLUMN municipal_registration TEXT;
ALTER TABLE clients ADD COLUMN website TEXT;
ALTER TABLE clients ADD COLUMN address_zip_code TEXT;
ALTER TABLE clients ADD COLUMN address_street TEXT;
ALTER TABLE clients ADD COLUMN address_number TEXT;
ALTER TABLE clients ADD COLUMN address_complement TEXT;
ALTER TABLE clients ADD COLUMN address_district TEXT;
ALTER TABLE clients ADD COLUMN address_city TEXT;
ALTER TABLE clients ADD COLUMN address_state TEXT;
ALTER TABLE clients ADD COLUMN address_country TEXT;

-- CNPJ is canonical when present: fourteen ASCII digits without punctuation.
CREATE TRIGGER IF NOT EXISTS trg_clients_cnpj_canonical_insert
BEFORE INSERT ON clients
WHEN NEW.cnpj IS NOT NULL
  AND (length(NEW.cnpj) <> 14 OR NEW.cnpj GLOB '*[^0-9]*')
BEGIN
  SELECT RAISE(ABORT, 'client cnpj must contain exactly 14 digits');
END;

CREATE TRIGGER IF NOT EXISTS trg_clients_cnpj_canonical_update
BEFORE UPDATE OF cnpj ON clients
WHEN NEW.cnpj IS NOT NULL
  AND (length(NEW.cnpj) <> 14 OR NEW.cnpj GLOB '*[^0-9]*')
BEGIN
  SELECT RAISE(ABORT, 'client cnpj must contain exactly 14 digits');
END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_organization_cnpj
ON clients(organization_id, cnpj)
WHERE cnpj IS NOT NULL;

CREATE TABLE IF NOT EXISTS client_contacts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_title TEXT,
  email TEXT,
  phone TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client_active
ON client_contacts(client_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_contacts_one_primary_active
ON client_contacts(client_id)
WHERE is_primary = 1 AND is_active = 1;

CREATE TRIGGER IF NOT EXISTS trg_client_contacts_tenant_insert
BEFORE INSERT ON client_contacts
WHEN NOT EXISTS (
  SELECT 1 FROM clients
  WHERE id = NEW.client_id AND organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'client contact organization mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_client_contacts_tenant_update
BEFORE UPDATE OF organization_id, client_id ON client_contacts
WHEN NOT EXISTS (
  SELECT 1 FROM clients
  WHERE id = NEW.client_id AND organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'client contact organization mismatch');
END;

-- Contract extensions are nullable to avoid assigning unverified semantics to existing data.
ALTER TABLE contracts ADD COLUMN renewal_type TEXT CHECK (renewal_type IS NULL OR renewal_type IN ('manual', 'automatic'));
ALTER TABLE contracts ADD COLUMN renewal_date TEXT;
ALTER TABLE contracts ADD COLUMN billing_frequency TEXT;
ALTER TABLE contracts ADD COLUMN billing_day INTEGER CHECK (billing_day IS NULL OR billing_day BETWEEN 1 AND 31);
ALTER TABLE contracts ADD COLUMN commercial_terms TEXT;
ALTER TABLE contracts ADD COLUMN notes TEXT;

CREATE TRIGGER IF NOT EXISTS trg_contracts_tenant_insert
BEFORE INSERT ON contracts
WHEN NOT EXISTS (
  SELECT 1 FROM clients
  WHERE id = NEW.client_id AND organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'contract organization mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_contracts_tenant_update
BEFORE UPDATE OF organization_id, client_id ON contracts
WHEN NOT EXISTS (
  SELECT 1 FROM clients
  WHERE id = NEW.client_id AND organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'contract organization mismatch');
END;

-- Catalog only: no existing access profile receives this permission automatically.
INSERT OR IGNORE INTO permissions (code, module, action, description, sensitivity)
VALUES ('contracts.manage', 'contracts', 'manage', 'Gerenciar contratos.', 'high');
