PRAGMA foreign_keys = ON;

ALTER TABLE mission_workflow_steps ADD COLUMN responsible_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Preserva quem já executou etapas concluídas.
UPDATE mission_workflow_steps
SET responsible_user_id = completed_by_user_id
WHERE completed_by_user_id IS NOT NULL;

-- Para fluxos existentes, tenta primeiro um colaborador do setor e usa o
-- responsável operacional como fallback para que nenhuma etapa fique invisível.
UPDATE mission_workflow_steps
SET responsible_user_id = COALESCE(
  (
    SELECT users.id
    FROM users
    JOIN departments ON departments.id = users.department_id
    JOIN missions ON missions.id = mission_workflow_steps.mission_id
    JOIN projects ON projects.id = missions.project_id
    WHERE users.organization_id = projects.organization_id
      AND users.status = 'active'
      AND departments.name = mission_workflow_steps.department_name
    ORDER BY users.name
    LIMIT 1
  ),
  (
    SELECT mission_assignees.user_id
    FROM mission_assignees
    WHERE mission_assignees.mission_id = mission_workflow_steps.mission_id
    ORDER BY mission_assignees.user_id
    LIMIT 1
  )
)
WHERE responsible_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_mission_workflow_responsible
  ON mission_workflow_steps(responsible_user_id, status);
