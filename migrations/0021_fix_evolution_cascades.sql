-- Rebuild the Evolution/Development hierarchy without triggering ON DELETE
-- cascades. Backup tables intentionally have no foreign keys, so dropping the
-- old parent tables cannot remove the copied child rows. D1 executes each
-- migration atomically and rejects explicit BEGIN/COMMIT statements.

CREATE TABLE evaluation_debriefs_backup AS SELECT * FROM evaluation_debriefs;
CREATE TABLE development_plans_backup AS SELECT * FROM development_plans;
CREATE TABLE development_goals_backup AS SELECT * FROM development_goals;
CREATE TABLE development_actions_backup AS SELECT * FROM development_actions;
CREATE TABLE development_evidence_backup AS SELECT * FROM development_evidence;
CREATE TABLE development_checkins_backup AS SELECT * FROM development_checkins;
CREATE TABLE development_checkin_entries_backup AS SELECT * FROM development_checkin_entries;

-- Children must be removed before their parents while foreign keys are active.
DROP TABLE development_checkin_entries;
DROP TABLE development_evidence;
DROP TABLE development_actions;
DROP TABLE development_goals;
DROP TABLE development_checkins;
DROP TABLE development_plans;
DROP TABLE evaluation_debriefs;

CREATE TABLE evaluation_debriefs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cycle_id TEXT REFERENCES evaluation_cycles(id) ON DELETE SET NULL,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  subject_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'completed', 'cancelled')),
  notes TEXT,
  meeting_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE development_plans (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subject_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  source_cycle_id TEXT REFERENCES evaluation_cycles(id) ON DELETE SET NULL,
  source_debrief_id TEXT REFERENCES evaluation_debriefs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE development_goals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES development_plans(id) ON DELETE CASCADE,
  competency_id TEXT REFERENCES competencies(id) ON DELETE SET NULL,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  title TEXT NOT NULL,
  description TEXT,
  success_criteria TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
  target_date TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE development_actions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES development_goals(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
  target_date TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE development_evidence (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  goal_id TEXT REFERENCES development_goals(id) ON DELETE CASCADE,
  action_id TEXT REFERENCES development_actions(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  title TEXT NOT NULL,
  text_content TEXT,
  link_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  CHECK (goal_id IS NOT NULL OR action_id IS NOT NULL)
);

CREATE TABLE development_checkins (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES development_plans(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  meeting_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE development_checkin_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  checkin_id TEXT NOT NULL REFERENCES development_checkins(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  entry_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Restore parents before children so every foreign key is valid at insert time.
INSERT INTO evaluation_debriefs SELECT * FROM evaluation_debriefs_backup;
INSERT INTO development_plans SELECT * FROM development_plans_backup;
INSERT INTO development_goals SELECT * FROM development_goals_backup;
INSERT INTO development_actions SELECT * FROM development_actions_backup;
INSERT INTO development_evidence SELECT * FROM development_evidence_backup;
INSERT INTO development_checkins SELECT * FROM development_checkins_backup;
INSERT INTO development_checkin_entries SELECT * FROM development_checkin_entries_backup;

DROP TABLE evaluation_debriefs_backup;
DROP TABLE development_plans_backup;
DROP TABLE development_goals_backup;
DROP TABLE development_actions_backup;
DROP TABLE development_evidence_backup;
DROP TABLE development_checkins_backup;
DROP TABLE development_checkin_entries_backup;

CREATE INDEX idx_eval_debriefs_org ON evaluation_debriefs(organization_id, status);
CREATE INDEX idx_eval_debriefs_subject ON evaluation_debriefs(subject_user_id);
CREATE INDEX idx_dev_plans_org ON development_plans(organization_id, status);
CREATE INDEX idx_dev_plans_subject ON development_plans(subject_user_id);
CREATE INDEX idx_dev_goals_plan ON development_goals(plan_id);
CREATE INDEX idx_dev_actions_goal ON development_actions(goal_id);
CREATE INDEX idx_dev_checkins_plan ON development_checkins(plan_id);
CREATE INDEX idx_dev_checkin_entries_checkin ON development_checkin_entries(checkin_id);
