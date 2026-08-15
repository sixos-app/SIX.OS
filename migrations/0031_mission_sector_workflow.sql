PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO permissions (code, module, action, description, sensitivity) VALUES
  ('missions.delete', 'missions', 'delete', 'Cancelar missões mantendo auditoria.', 'high'),
  ('missions.workflow.manage', 'missions', 'workflow', 'Avançar e devolver etapas da missão.', 'high');

INSERT OR IGNORE INTO role_permissions (role_code, permission) VALUES
  ('admin', 'missions.delete'), ('admin', 'missions.workflow.manage'),
  ('management', 'missions.delete'), ('management', 'missions.workflow.manage'),
  ('coordinator', 'missions.delete'), ('coordinator', 'missions.workflow.manage'),
  ('service', 'missions.assign'), ('service', 'missions.delete'), ('service', 'missions.workflow.manage'), ('service', 'missions.approve');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT access_profiles.id, permissions.code, 'all'
FROM access_profiles
JOIN permissions ON permissions.code IN ('missions.delete', 'missions.workflow.manage')
WHERE access_profiles.code IN ('admin_tech', 'operations_management', 'coordinator', 'service');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT access_profiles.id, 'missions.approve', 'all'
FROM access_profiles
WHERE access_profiles.code = 'service';

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT access_profiles.id, permissions.code, 'all'
FROM access_profiles
JOIN permissions ON permissions.code IN ('missions.create', 'missions.edit', 'missions.assign')
WHERE access_profiles.code = 'service';

INSERT OR IGNORE INTO departments (id, organization_id, code, name, description, is_active)
SELECT 'dept-copy-' || organizations.id, organizations.id, 'redacao', 'Redação', 'Redação, conteúdo e revisão textual.', 1
FROM organizations;

ALTER TABLE missions ADD COLUMN xp_recipient_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE missions ADD COLUMN current_workflow_position INTEGER NOT NULL DEFAULT 0 CHECK (current_workflow_position >= 0);

UPDATE missions
SET xp_recipient_user_id = (
  SELECT mission_assignees.user_id
  FROM mission_assignees
  WHERE mission_assignees.mission_id = missions.id
  ORDER BY mission_assignees.user_id
  LIMIT 1
)
WHERE xp_recipient_user_id IS NULL;

CREATE TABLE IF NOT EXISTS mission_workflow_steps (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  department_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'returned')),
  completed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (mission_id, position)
);

CREATE INDEX IF NOT EXISTS idx_mission_workflow_current ON mission_workflow_steps(mission_id, position, status);
CREATE INDEX IF NOT EXISTS idx_missions_xp_recipient ON missions(xp_recipient_user_id);

UPDATE xp_rules SET recipient_mode = 'responsible', version = version + 1, updated_at = CURRENT_TIMESTAMP
WHERE recipient_mode <> 'responsible';
