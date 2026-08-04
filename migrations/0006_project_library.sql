CREATE TABLE IF NOT EXISTS project_library_folders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, slug)
);

CREATE TABLE IF NOT EXISTS project_library_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES project_library_folders(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS project_library_file_versions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES project_library_files(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  storage_key TEXT,
  size_bytes INTEGER,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (file_id, version)
);

CREATE INDEX IF NOT EXISTS idx_project_library_folders_project ON project_library_folders(project_id, position);
CREATE INDEX IF NOT EXISTS idx_project_library_files_project ON project_library_files(project_id, folder_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_library_versions_file ON project_library_file_versions(file_id, version DESC);

INSERT OR IGNORE INTO project_library_folders (id, project_id, name, slug, position) VALUES
  ('folder-shopping-logo', 'project-shopping-uberaba', 'Logo', 'logo', 1),
  ('folder-shopping-kv', 'project-shopping-uberaba', 'KV', 'kv', 2),
  ('folder-shopping-videos', 'project-shopping-uberaba', 'Vídeos', 'videos', 3),
  ('folder-shopping-artes', 'project-shopping-uberaba', 'Artes', 'artes', 4),
  ('folder-shopping-briefing', 'project-shopping-uberaba', 'Briefing', 'briefing', 5),
  ('folder-shopping-contrato', 'project-shopping-uberaba', 'Contrato', 'contrato', 6),
  ('folder-shopping-outros', 'project-shopping-uberaba', 'Outros', 'outros', 7),
  ('folder-sicredi-logo', 'project-sicredi', 'Logo', 'logo', 1),
  ('folder-sicredi-kv', 'project-sicredi', 'KV', 'kv', 2),
  ('folder-sicredi-videos', 'project-sicredi', 'Vídeos', 'videos', 3),
  ('folder-sicredi-artes', 'project-sicredi', 'Artes', 'artes', 4),
  ('folder-sicredi-briefing', 'project-sicredi', 'Briefing', 'briefing', 5),
  ('folder-sicredi-contrato', 'project-sicredi', 'Contrato', 'contrato', 6),
  ('folder-sicredi-outros', 'project-sicredi', 'Outros', 'outros', 7),
  ('folder-radio-logo', 'project-radio-cultura', 'Logo', 'logo', 1),
  ('folder-radio-kv', 'project-radio-cultura', 'KV', 'kv', 2),
  ('folder-radio-videos', 'project-radio-cultura', 'Vídeos', 'videos', 3),
  ('folder-radio-artes', 'project-radio-cultura', 'Artes', 'artes', 4),
  ('folder-radio-briefing', 'project-radio-cultura', 'Briefing', 'briefing', 5),
  ('folder-radio-contrato', 'project-radio-cultura', 'Contrato', 'contrato', 6),
  ('folder-radio-outros', 'project-radio-cultura', 'Outros', 'outros', 7);
