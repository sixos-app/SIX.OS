ALTER TABLE missions ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE missions ADD COLUMN reward_label TEXT;
ALTER TABLE missions ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'not_requested' CHECK (approval_status IN ('not_requested', 'pending', 'approved'));
ALTER TABLE missions ADD COLUMN approval_requested_at TEXT;
ALTER TABLE missions ADD COLUMN approved_at TEXT;
ALTER TABLE missions ADD COLUMN approved_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE missions ADD COLUMN created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS mission_checklist_items (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
  position INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mission_comments (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mission_attachments (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  library_file_id TEXT NOT NULL REFERENCES project_library_files(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  file_version INTEGER NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (mission_id, library_file_id)
);

CREATE TABLE IF NOT EXISTS mission_history (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mission_checklist_mission ON mission_checklist_items(mission_id, position);
CREATE INDEX IF NOT EXISTS idx_mission_comments_mission ON mission_comments(mission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mission_history_mission ON mission_history(mission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mission_attachments_mission ON mission_attachments(mission_id);

INSERT OR IGNORE INTO role_permissions (role_code, permission) VALUES ('management', 'missions.assign');

UPDATE missions
SET description = CASE id
  WHEN 'mission-kv-dia-dos-pais' THEN 'Consolidar o Key Visual da campanha de Dia dos Pais, respeitando a identidade do Shopping Uberaba e os desdobramentos aprovados.'
  WHEN 'mission-roteiro-manifesto' THEN 'Estruturar o roteiro do vídeo manifesto e preparar a versão para validação de locução.'
  WHEN 'mission-conceito-primavera' THEN 'Definir o território criativo da campanha Primavera e organizar os caminhos para apresentação.'
  ELSE description
END
WHERE description = '';

INSERT OR IGNORE INTO mission_checklist_items (id, mission_id, label, position) VALUES
  ('check-kv-briefing', 'mission-kv-dia-dos-pais', 'Revisar briefing e referências', 1),
  ('check-kv-layout', 'mission-kv-dia-dos-pais', 'Finalizar layout principal', 2),
  ('check-kv-export', 'mission-kv-dia-dos-pais', 'Exportar arquivos para aprovação', 3),
  ('check-roteiro-estrutura', 'mission-roteiro-manifesto', 'Organizar estrutura narrativa', 1),
  ('check-roteiro-revisao', 'mission-roteiro-manifesto', 'Revisar texto e ritmo', 2),
  ('check-primavera-pesquisa', 'mission-conceito-primavera', 'Pesquisar referências visuais', 1),
  ('check-primavera-caminhos', 'mission-conceito-primavera', 'Preparar três caminhos criativos', 2);

INSERT OR IGNORE INTO mission_history (id, mission_id, action, detail) VALUES
  ('history-kv-created', 'mission-kv-dia-dos-pais', 'created', 'Missão inicial criada.'),
  ('history-roteiro-created', 'mission-roteiro-manifesto', 'created', 'Missão inicial criada.'),
  ('history-primavera-created', 'mission-conceito-primavera', 'created', 'Missão inicial criada.');
