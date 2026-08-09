

BEGIN TRANSACTION;

-- 1. evaluation_debriefs
CREATE TABLE IF NOT EXISTS evaluation_debriefs_new (
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
INSERT INTO evaluation_debriefs_new SELECT * FROM evaluation_debriefs;
DROP TABLE evaluation_debriefs;
ALTER TABLE evaluation_debriefs_new RENAME TO evaluation_debriefs;
CREATE INDEX IF NOT EXISTS idx_eval_debriefs_org ON evaluation_debriefs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_eval_debriefs_subject ON evaluation_debriefs(subject_user_id);


-- 2. development_plans
CREATE TABLE IF NOT EXISTS development_plans_new (
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
INSERT INTO development_plans_new SELECT * FROM development_plans;
DROP TABLE development_plans;
ALTER TABLE development_plans_new RENAME TO development_plans;
CREATE INDEX IF NOT EXISTS idx_dev_plans_org ON development_plans(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_dev_plans_subject ON development_plans(subject_user_id);


-- 3. development_goals
CREATE TABLE IF NOT EXISTS development_goals_new (
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
INSERT INTO development_goals_new SELECT * FROM development_goals;
DROP TABLE development_goals;
ALTER TABLE development_goals_new RENAME TO development_goals;
CREATE INDEX IF NOT EXISTS idx_dev_goals_plan ON development_goals(plan_id);


-- 4. development_actions
CREATE TABLE IF NOT EXISTS development_actions_new (
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
INSERT INTO development_actions_new SELECT * FROM development_actions;
DROP TABLE development_actions;
ALTER TABLE development_actions_new RENAME TO development_actions;
CREATE INDEX IF NOT EXISTS idx_dev_actions_goal ON development_actions(goal_id);


-- 5. development_evidence
CREATE TABLE IF NOT EXISTS development_evidence_new (
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
INSERT INTO development_evidence_new SELECT * FROM development_evidence;
DROP TABLE development_evidence;
ALTER TABLE development_evidence_new RENAME TO development_evidence;


-- 6. development_checkins
CREATE TABLE IF NOT EXISTS development_checkins_new (
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
INSERT INTO development_checkins_new SELECT * FROM development_checkins;
DROP TABLE development_checkins;
ALTER TABLE development_checkins_new RENAME TO development_checkins;
CREATE INDEX IF NOT EXISTS idx_dev_checkins_plan ON development_checkins(plan_id);


-- 7. development_checkin_entries
CREATE TABLE IF NOT EXISTS development_checkin_entries_new (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  checkin_id TEXT NOT NULL REFERENCES development_checkins(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  entry_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO development_checkin_entries_new SELECT * FROM development_checkin_entries;
DROP TABLE development_checkin_entries;
ALTER TABLE development_checkin_entries_new RENAME TO development_checkin_entries;
CREATE INDEX IF NOT EXISTS idx_dev_checkin_entries_checkin ON development_checkin_entries(checkin_id);

COMMIT;


