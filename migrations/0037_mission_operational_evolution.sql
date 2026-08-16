PRAGMA foreign_keys = ON;

-- Estimativas e campos operacionais na missão
ALTER TABLE missions ADD COLUMN expected_minutes INTEGER DEFAULT NULL;

-- Campos operacionais por etapa de workflow
ALTER TABLE mission_workflow_steps ADD COLUMN step_type TEXT DEFAULT 'production';
ALTER TABLE mission_workflow_steps ADD COLUMN expected_minutes INTEGER DEFAULT NULL;
ALTER TABLE mission_workflow_steps ADD COLUMN review_notes TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_mission_workflow_steps_order
  ON mission_workflow_steps(mission_id, position);
