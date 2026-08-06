CREATE TABLE IF NOT EXISTS external_integrations (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  config_json TEXT NOT NULL,
  is_active INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  organization_id TEXT
);

-- Seed initial records for the providers
INSERT INTO external_integrations (id, provider, config_json, is_active, organization_id) VALUES
('int-runrunit', 'runrunit', '{"token":"","orgId":""}', 0, 'org-six-os'),
('int-slack', 'slack', '{"webhookUrl":"","channel":""}', 0, 'org-six-os'),
('int-google', 'google', '{"clientEmail":"","calendarId":""}', 0, 'org-six-os'),
('int-outlook', 'outlook', '{"tenantId":"","clientId":""}', 0, 'org-six-os');
