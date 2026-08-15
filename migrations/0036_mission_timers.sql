PRAGMA foreign_keys = ON;

ALTER TABLE missions ADD COLUMN started_at TEXT;

ALTER TABLE time_entries ADD COLUMN mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL;
ALTER TABLE time_entries ADD COLUMN started_at TEXT;
ALTER TABLE time_entries ADD COLUMN ended_at TEXT;
ALTER TABLE time_entries ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0);

CREATE INDEX IF NOT EXISTS idx_time_entries_mission
  ON time_entries(mission_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_one_active_timer_per_user
  ON time_entries(organization_id, user_id)
  WHERE entry_type = 'timer' AND started_at IS NOT NULL AND ended_at IS NULL;
