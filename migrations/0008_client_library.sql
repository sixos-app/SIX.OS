CREATE TABLE IF NOT EXISTS client_library_folders (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, slug)
);

CREATE TABLE IF NOT EXISTS client_library_files (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES client_library_folders(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS client_library_file_versions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES client_library_files(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  storage_key TEXT,
  size_bytes INTEGER,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(file_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_library_files_folder_name ON client_library_files(client_id, folder_id, name);
CREATE INDEX IF NOT EXISTS idx_client_library_folders_client ON client_library_folders(client_id, position);

INSERT OR IGNORE INTO client_library_folders (id, client_id, name, slug, position)
SELECT 'client-folder-' || clients.id || '-logo', clients.id, 'Logo', 'logo', 1 FROM clients;
INSERT OR IGNORE INTO client_library_folders (id, client_id, name, slug, position)
SELECT 'client-folder-' || clients.id || '-brandbook', clients.id, 'Brandbook', 'brandbook', 2 FROM clients;
INSERT OR IGNORE INTO client_library_folders (id, client_id, name, slug, position)
SELECT 'client-folder-' || clients.id || '-briefing', clients.id, 'Briefing', 'briefing', 3 FROM clients;
INSERT OR IGNORE INTO client_library_folders (id, client_id, name, slug, position)
SELECT 'client-folder-' || clients.id || '-contrato', clients.id, 'Contrato', 'contrato', 4 FROM clients;
INSERT OR IGNORE INTO client_library_folders (id, client_id, name, slug, position)
SELECT 'client-folder-' || clients.id || '-referencias', clients.id, 'Referências', 'referencias', 5 FROM clients;
INSERT OR IGNORE INTO client_library_folders (id, client_id, name, slug, position)
SELECT 'client-folder-' || clients.id || '-outros', clients.id, 'Outros', 'outros', 6 FROM clients;
