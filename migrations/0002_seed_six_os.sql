INSERT OR IGNORE INTO organizations (id, name, slug) VALUES
  ('org-six', 'Agência SIX', 'agencia-six');

INSERT OR IGNORE INTO teams (id, organization_id, name) VALUES
  ('team-six', 'org-six', 'Time SIX');

INSERT OR IGNORE INTO users (id, organization_id, team_id, name, email, role) VALUES
  ('team-guilherme', 'org-six', 'team-six', 'Guilherme', 'six.guimell@gmail.com', 'admin'),
  ('team-lorraine', 'org-six', 'team-six', 'Lorraine', 'lorraine@sixos.app', 'collaborator'),
  ('team-mateus', 'org-six', 'team-six', 'Mateus', 'mateus@sixos.app', 'collaborator'),
  ('team-vitoria', 'org-six', 'team-six', 'Vitória', 'vitoria@sixos.app', 'collaborator'),
  ('team-rafael', 'org-six', 'team-six', 'Rafael', 'rafael@sixos.app', 'collaborator');

INSERT OR IGNORE INTO gamification_profiles (user_id, xp, ideas, level, streak_days) VALUES
  ('team-guilherme', 8420, 1280, 'Criador', 6);

INSERT OR IGNORE INTO clients (id, organization_id, name) VALUES
  ('client-shopping-uberaba', 'org-six', 'Shopping Uberaba'),
  ('client-sicredi', 'org-six', 'Sicredi'),
  ('client-radio-cultura', 'org-six', 'Rádio Cultura');

INSERT OR IGNORE INTO projects (id, organization_id, client_id, name, status, progress, due_at) VALUES
  ('project-shopping-uberaba', 'org-six', 'client-shopping-uberaba', 'Shopping Uberaba', 'approval', 85, datetime('now', '+2 hours')),
  ('project-sicredi', 'org-six', 'client-sicredi', 'Sicredi', 'active', 58, datetime('now', '+1 day')),
  ('project-radio-cultura', 'org-six', 'client-radio-cultura', 'Rádio Cultura', 'planning', 34, datetime('now', '+1 day', '+5 hours'));

INSERT OR IGNORE INTO missions (id, project_id, client_id, title, status, priority, visual_tone, xp_reward, ideas_reward, due_at) VALUES
  ('mission-kv-dia-dos-pais', 'project-shopping-uberaba', 'client-shopping-uberaba', 'Key Visual Dia dos Pais', 'open', 'urgent', 'lime', 120, 30, datetime('now', '+2 hours')),
  ('mission-roteiro-manifesto', 'project-sicredi', 'client-sicredi', 'Roteiro de vídeo manifesto', 'open', 'normal', 'purple', 95, 20, datetime('now', '+1 day')),
  ('mission-conceito-primavera', 'project-radio-cultura', 'client-radio-cultura', 'Conceito campanha Primavera', 'open', 'normal', 'orange', 80, 15, datetime('now', '+1 day', '+5 hours'));

INSERT OR IGNORE INTO mission_assignees (mission_id, user_id) VALUES
  ('mission-kv-dia-dos-pais', 'team-guilherme'),
  ('mission-roteiro-manifesto', 'team-mateus'),
  ('mission-conceito-primavera', 'team-lorraine');
