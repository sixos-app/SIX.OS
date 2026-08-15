CREATE TABLE IF NOT EXISTS agency_feed (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  target_name TEXT NOT NULL,
  xp_amount INTEGER,
  link TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  organization_id TEXT
);

-- Operational feed entries are created by authenticated application events.
-- Production migrations intentionally contain no demo activity.
