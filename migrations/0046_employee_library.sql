-- 0046_employee_library.sql

CREATE TABLE IF NOT EXISTS employee_library_folders (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, slug)
);

CREATE TABLE IF NOT EXISTS employee_library_files (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES employee_library_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size_bytes INTEGER,
  storage_provider TEXT NOT NULL DEFAULT 'pending' CHECK (storage_provider IN ('pending', 'r2', 'mega_link')),
  storage_key TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_library_file_versions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES employee_library_files(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  storage_key TEXT,
  size_bytes INTEGER,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (file_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_library_files_folder_name 
ON employee_library_files(employee_id, folder_id, name);

-- Inicializa pastas para funcionários já existentes
INSERT OR IGNORE INTO employee_library_folders (id, employee_id, name, slug, position)
SELECT 'folder-' || id || '-pessoais', id, 'Documentos Pessoais', 'documentos-pessoais', 1 FROM employees
UNION ALL
SELECT 'folder-' || id || '-contratos', id, 'Contratos', 'contratos', 2 FROM employees
UNION ALL
SELECT 'folder-' || id || '-holerites', id, 'Holerites', 'holerites', 3 FROM employees
UNION ALL
SELECT 'folder-' || id || '-atestados', id, 'Atestados', 'atestados', 4 FROM employees
UNION ALL
SELECT 'folder-' || id || '-ferias', id, 'Férias', 'ferias', 5 FROM employees
UNION ALL
SELECT 'folder-' || id || '-beneficios', id, 'Benefícios', 'beneficios', 6 FROM employees
UNION ALL
SELECT 'folder-' || id || '-advertencias', id, 'Advertências e Termos', 'advertencias-termos', 7 FROM employees
UNION ALL
SELECT 'folder-' || id || '-avaliacoes', id, 'Avaliações', 'avaliacoes', 8 FROM employees
UNION ALL
SELECT 'folder-' || id || '-outros', id, 'Outros', 'outros', 9 FROM employees;

-- Migra dados da tabela employee_documents (se houver algum inserido)
INSERT OR IGNORE INTO employee_library_files (id, employee_id, folder_id, name, file_type, size_bytes, storage_provider, storage_key, version, created_by_user_id, created_at, updated_at)
SELECT 
  id, 
  employee_id, 
  'folder-' || employee_id || '-' || 
    CASE folder_category 
      WHEN 'personal' THEN 'pessoais'
      WHEN 'contracts' THEN 'contratos'
      WHEN 'payslips' THEN 'holerites'
      WHEN 'medical' THEN 'atestados'
      WHEN 'vacation' THEN 'ferias'
      WHEN 'benefits' THEN 'beneficios'
      WHEN 'terms' THEN 'advertencias'
      WHEN 'evaluations' THEN 'avaliacoes'
      ELSE 'outros'
    END,
  file_name,
  file_type,
  size_bytes,
  'r2',
  storage_key,
  1,
  uploaded_by_user_id,
  created_at,
  created_at
FROM employee_documents;
