CREATE TABLE IF NOT EXISTS agency_feed (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  target_name TEXT NOT NULL,
  xp_amount INTEGER,
  link TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  organization_id TEXT
);

INSERT INTO agency_feed (id, user_id, type, title, target_name, xp_amount, link, created_at, organization_id) VALUES
('feed-1', 'user-agsix-admin', 'mission_completed', 'concluiu a missão', 'Estudo de posicionamento', 400, '/?section=projects', '2026-08-05 10:00:00', 'org-six-os'),
('feed-2', 'user-agsix-admin', 'project_created', 'iniciou o projeto', 'KV Criativo', NULL, '/?section=projects', '2026-08-05 11:30:00', 'org-six-os'),
('feed-3', 'user-agsix-admin', 'kudo_received', 'recebeu kudos de Guilherme por', 'Alta proatividade no lançamento', 100, NULL, '2026-08-05 12:15:00', 'org-six-os'),
('feed-4', 'user-agsix-admin', 'collaborator_joined', 'entrou no time da agência como', 'Especialista em Redação', NULL, '/?section=team', '2026-08-05 14:00:00', 'org-six-os');
