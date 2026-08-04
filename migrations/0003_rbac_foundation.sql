CREATE TABLE IF NOT EXISTS role_definitions (
  code TEXT PRIMARY KEY CHECK (code IN ('admin', 'management', 'coordinator', 'service', 'specialist')),
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_code TEXT NOT NULL REFERENCES role_definitions(code) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  PRIMARY KEY (role_code, permission)
);

CREATE TABLE IF NOT EXISTS user_role_assignments (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL REFERENCES role_definitions(code) ON DELETE RESTRICT,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO role_definitions (code, name, description) VALUES
  ('admin', 'Administrador', 'Controle completo da organização e das configurações.'),
  ('management', 'Gestão', 'Visão geral, projetos e aprovações.'),
  ('coordinator', 'Coordenador', 'Distribuição de missões e coordenação da equipe.'),
  ('service', 'Atendimento', 'Clientes, projetos, briefings e acompanhamento.'),
  ('specialist', 'Especialista', 'Execução das próprias missões e envio de arquivos.');

INSERT OR IGNORE INTO role_permissions (role_code, permission) VALUES
  ('admin', 'users.manage'), ('admin', 'roles.manage'), ('admin', 'gamification.manage'), ('admin', 'projects.create'), ('admin', 'projects.manage'), ('admin', 'missions.assign'), ('admin', 'missions.approve'), ('admin', 'missions.update_own'), ('admin', 'clients.manage'), ('admin', 'library.manage'), ('admin', 'finance.view'), ('admin', 'ai.use'), ('admin', 'reports.view'), ('admin', 'agenda.team.view'),
  ('management', 'projects.create'), ('management', 'projects.manage'), ('management', 'missions.approve'), ('management', 'clients.manage'), ('management', 'library.manage'), ('management', 'ai.use'), ('management', 'reports.view'), ('management', 'agenda.team.view'),
  ('coordinator', 'projects.manage'), ('coordinator', 'missions.assign'), ('coordinator', 'missions.approve'), ('coordinator', 'agenda.team.view'),
  ('service', 'projects.create'), ('service', 'clients.manage'), ('service', 'agenda.team.view'),
  ('specialist', 'missions.update_own');

INSERT OR IGNORE INTO user_role_assignments (user_id, role_code)
SELECT id, CASE role WHEN 'admin' THEN 'admin' ELSE 'specialist' END
FROM users;

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role ON user_role_assignments(role_code);
