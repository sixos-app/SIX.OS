PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO mission_workflow_steps (id, mission_id, position, department_name, status)
SELECT 'workflow-legacy-0-' || missions.id, missions.id, 0, 'Redação', 'active'
FROM missions
WHERE missions.status IN ('open', 'in_progress')
  AND NOT EXISTS (SELECT 1 FROM mission_workflow_steps existing WHERE existing.mission_id = missions.id);

INSERT OR IGNORE INTO mission_workflow_steps (id, mission_id, position, department_name, status)
SELECT 'workflow-legacy-1-' || missions.id, missions.id, 1, 'Criação', 'pending'
FROM missions
WHERE missions.status IN ('open', 'in_progress')
  AND EXISTS (SELECT 1 FROM mission_workflow_steps first_step WHERE first_step.mission_id = missions.id AND first_step.id = 'workflow-legacy-0-' || missions.id);

INSERT OR IGNORE INTO mission_workflow_steps (id, mission_id, position, department_name, status)
SELECT 'workflow-legacy-2-' || missions.id, missions.id, 2, 'Planejamento', 'pending'
FROM missions
WHERE missions.status IN ('open', 'in_progress')
  AND EXISTS (SELECT 1 FROM mission_workflow_steps first_step WHERE first_step.mission_id = missions.id AND first_step.id = 'workflow-legacy-0-' || missions.id);

UPDATE missions SET current_workflow_position = 0
WHERE status IN ('open', 'in_progress')
  AND EXISTS (SELECT 1 FROM mission_workflow_steps first_step WHERE first_step.mission_id = missions.id AND first_step.id = 'workflow-legacy-0-' || missions.id);
