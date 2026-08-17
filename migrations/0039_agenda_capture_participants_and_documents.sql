ALTER TABLE calendar_events ADD COLUMN mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL;
ALTER TABLE calendar_events ADD COLUMN attachment_name TEXT;
ALTER TABLE calendar_events ADD COLUMN attachment_key TEXT;
ALTER TABLE calendar_events ADD COLUMN attachment_content_type TEXT;
ALTER TABLE calendar_events ADD COLUMN attachment_size INTEGER;

CREATE TABLE IF NOT EXISTS calendar_event_participants (
  event_id TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_participants_user
  ON calendar_event_participants(organization_id, user_id, event_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_mission
  ON calendar_events(organization_id, mission_id, starts_at);
