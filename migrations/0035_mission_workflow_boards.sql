PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workflow_boards (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS workflow_stages (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES workflow_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  type TEXT NOT NULL CHECK (type IN ('backlog', 'ready', 'doing', 'review', 'approval', 'done')),
  color TEXT NOT NULL DEFAULT 'lime' CHECK (color IN ('lime', 'purple', 'orange', 'neutral')),
  is_initial INTEGER NOT NULL DEFAULT 0 CHECK (is_initial IN (0, 1)),
  is_final INTEGER NOT NULL DEFAULT 0 CHECK (is_final IN (0, 1)),
  requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (board_id, position),
  UNIQUE (board_id, type)
);

ALTER TABLE missions ADD COLUMN board_id TEXT REFERENCES workflow_boards(id) ON DELETE SET NULL;
ALTER TABLE missions ADD COLUMN stage_id TEXT REFERENCES workflow_stages(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS mission_stage_history (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  board_id TEXT REFERENCES workflow_boards(id) ON DELETE SET NULL,
  from_stage_id TEXT REFERENCES workflow_stages(id) ON DELETE SET NULL,
  to_stage_id TEXT NOT NULL REFERENCES workflow_stages(id) ON DELETE RESTRICT,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_boards_one_default
  ON workflow_boards(organization_id)
  WHERE is_default = 1;
CREATE INDEX IF NOT EXISTS idx_workflow_stages_board
  ON workflow_stages(board_id, position);
CREATE INDEX IF NOT EXISTS idx_missions_board_stage
  ON missions(board_id, stage_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_mission_stage_history_mission
  ON mission_stage_history(mission_id, created_at DESC);

INSERT OR IGNORE INTO workflow_boards (id, organization_id, name, slug, is_default)
SELECT 'workflow-board-default-' || id, id, 'Fluxo de Missões', 'missoes', 1
FROM organizations;

INSERT OR IGNORE INTO workflow_stages (id, board_id, name, position, type, color, is_initial, is_final, requires_approval)
SELECT 'workflow-stage-backlog-' || id, 'workflow-board-default-' || id, 'Entrada', 0, 'backlog', 'neutral', 0, 0, 0 FROM organizations;
INSERT OR IGNORE INTO workflow_stages (id, board_id, name, position, type, color, is_initial, is_final, requires_approval)
SELECT 'workflow-stage-ready-' || id, 'workflow-board-default-' || id, 'A Fazer', 1, 'ready', 'purple', 1, 0, 0 FROM organizations;
INSERT OR IGNORE INTO workflow_stages (id, board_id, name, position, type, color, is_initial, is_final, requires_approval)
SELECT 'workflow-stage-doing-' || id, 'workflow-board-default-' || id, 'Em Produção', 2, 'doing', 'lime', 0, 0, 0 FROM organizations;
INSERT OR IGNORE INTO workflow_stages (id, board_id, name, position, type, color, is_initial, is_final, requires_approval)
SELECT 'workflow-stage-review-' || id, 'workflow-board-default-' || id, 'Revisão', 3, 'review', 'orange', 0, 0, 0 FROM organizations;
INSERT OR IGNORE INTO workflow_stages (id, board_id, name, position, type, color, is_initial, is_final, requires_approval)
SELECT 'workflow-stage-approval-' || id, 'workflow-board-default-' || id, 'Aprovação', 4, 'approval', 'purple', 0, 0, 1 FROM organizations;
INSERT OR IGNORE INTO workflow_stages (id, board_id, name, position, type, color, is_initial, is_final, requires_approval)
SELECT 'workflow-stage-done-' || id, 'workflow-board-default-' || id, 'Concluído', 5, 'done', 'lime', 0, 1, 0 FROM organizations;

UPDATE missions
SET board_id = (
      SELECT boards.id
      FROM workflow_boards boards
      JOIN projects ON projects.organization_id = boards.organization_id
      WHERE projects.id = missions.project_id AND boards.is_default = 1
      LIMIT 1
    ),
    stage_id = (
      SELECT stages.id
      FROM workflow_stages stages
      JOIN workflow_boards boards ON boards.id = stages.board_id
      JOIN projects ON projects.organization_id = boards.organization_id
      WHERE projects.id = missions.project_id
        AND boards.is_default = 1
        AND stages.type = CASE
          WHEN missions.status = 'completed' THEN 'done'
          WHEN missions.approval_status = 'pending' THEN 'approval'
          WHEN missions.status = 'in_progress' THEN 'doing'
          ELSE 'ready'
        END
      LIMIT 1
    )
WHERE missions.status <> 'cancelled';

INSERT INTO mission_stage_history (id, mission_id, board_id, to_stage_id, reason, created_at)
SELECT lower(hex(randomblob(16))), missions.id, missions.board_id, missions.stage_id,
  'Migração compatível do status legado.', COALESCE(missions.updated_at, CURRENT_TIMESTAMP)
FROM missions
WHERE missions.stage_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM mission_stage_history history WHERE history.mission_id = missions.id
  );

CREATE TRIGGER IF NOT EXISTS missions_workflow_after_insert
AFTER INSERT ON missions
WHEN NEW.status <> 'cancelled' AND (NEW.board_id IS NULL OR NEW.stage_id IS NULL)
BEGIN
  UPDATE missions
  SET board_id = COALESCE(
        NEW.board_id,
        (SELECT boards.id
         FROM workflow_boards boards
         JOIN projects ON projects.organization_id = boards.organization_id
         WHERE projects.id = NEW.project_id AND boards.is_default = 1
         LIMIT 1)
      ),
      stage_id = COALESCE(
        NEW.stage_id,
        (SELECT stages.id
         FROM workflow_stages stages
         JOIN workflow_boards boards ON boards.id = stages.board_id
         JOIN projects ON projects.organization_id = boards.organization_id
         WHERE projects.id = NEW.project_id
           AND boards.is_default = 1
           AND stages.type = CASE
             WHEN NEW.status = 'completed' THEN 'done'
             WHEN NEW.approval_status = 'pending' THEN 'approval'
             WHEN NEW.status = 'in_progress' THEN 'doing'
             ELSE 'ready'
           END
         LIMIT 1)
      )
  WHERE id = NEW.id;

  INSERT INTO mission_stage_history (id, mission_id, board_id, to_stage_id, reason)
  SELECT lower(hex(randomblob(16))), mission.id, mission.board_id, mission.stage_id,
    'Etapa inicial definida por compatibilidade.'
  FROM missions mission
  WHERE mission.id = NEW.id AND mission.stage_id IS NOT NULL;
END;

CREATE TRIGGER IF NOT EXISTS missions_workflow_after_legacy_status_update
AFTER UPDATE OF status, approval_status ON missions
WHEN NEW.status <> 'cancelled'
  AND COALESCE(
    (SELECT type FROM workflow_stages WHERE id = NEW.stage_id),
    ''
  ) <> CASE
    WHEN NEW.status = 'completed' THEN 'done'
    WHEN NEW.approval_status = 'pending' THEN 'approval'
    WHEN NEW.status = 'in_progress' THEN 'doing'
    ELSE 'ready'
  END
BEGIN
  INSERT INTO mission_stage_history (id, mission_id, board_id, from_stage_id, to_stage_id, reason)
  SELECT lower(hex(randomblob(16))), NEW.id, COALESCE(NEW.board_id, boards.id), NEW.stage_id, stages.id,
    'Sincronização do status legado.'
  FROM projects
  JOIN workflow_boards boards ON boards.organization_id = projects.organization_id
  JOIN workflow_stages stages ON stages.board_id = COALESCE(NEW.board_id, boards.id)
  WHERE projects.id = NEW.project_id
    AND boards.is_default = 1
    AND stages.type = CASE
      WHEN NEW.status = 'completed' THEN 'done'
      WHEN NEW.approval_status = 'pending' THEN 'approval'
      WHEN NEW.status = 'in_progress' THEN 'doing'
      ELSE 'ready'
    END
  LIMIT 1;

  UPDATE missions
  SET board_id = COALESCE(
        NEW.board_id,
        (SELECT boards.id
         FROM workflow_boards boards
         JOIN projects ON projects.organization_id = boards.organization_id
         WHERE projects.id = NEW.project_id AND boards.is_default = 1
         LIMIT 1)
      ),
      stage_id = (
        SELECT stages.id
        FROM workflow_stages stages
        WHERE stages.board_id = COALESCE(
          NEW.board_id,
          (SELECT boards.id
           FROM workflow_boards boards
           JOIN projects ON projects.organization_id = boards.organization_id
           WHERE projects.id = NEW.project_id AND boards.is_default = 1
           LIMIT 1)
        )
          AND stages.type = CASE
            WHEN NEW.status = 'completed' THEN 'done'
            WHEN NEW.approval_status = 'pending' THEN 'approval'
            WHEN NEW.status = 'in_progress' THEN 'doing'
            ELSE 'ready'
          END
        LIMIT 1
      )
  WHERE id = NEW.id;
END;
