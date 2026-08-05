ALTER TABLE calendar_events ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE calendar_events ADD COLUMN client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE calendar_events ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE calendar_events ADD COLUMN location TEXT;
ALTER TABLE calendar_events ADD COLUMN visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'team'));
ALTER TABLE calendar_events ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_calendar_events_owner ON calendar_events(owner_user_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_visibility ON calendar_events(organization_id, visibility, starts_at);

INSERT OR IGNORE INTO calendar_events (
  id, organization_id, project_id, client_id, owner_user_id, title, starts_at, ends_at,
  event_type, description, location, visibility
) VALUES
  (
    'agenda-briefing-shopping', 'org-six', 'project-shopping-uberaba', 'client-shopping-uberaba', 'team-guilherme',
    'Reunião de briefing', datetime('now', 'start of day', '+10 hours'), datetime('now', 'start of day', '+10 hours', '+45 minutes'),
    'meeting', 'Alinhamento final do briefing e das expectativas para a campanha de Dia dos Pais.', 'Sala Norte', 'team'
  ),
  (
    'agenda-revisao-manifesto', 'org-six', 'project-sicredi', 'client-sicredi', 'team-guilherme',
    'Revisão do manifesto', datetime('now', 'start of day', '+11 hours', '+30 minutes'), datetime('now', 'start of day', '+12 hours'),
    'appointment', 'Refinar o argumento central e validar a narrativa do vídeo manifesto.', 'Sala Norte', 'team'
  ),
  (
    'agenda-toro-ideias', 'org-six', 'project-radio-cultura', 'client-radio-cultura', 'team-guilherme',
    'Toró de ideias', datetime('now', 'start of day', '+14 hours', '+30 minutes'), datetime('now', 'start of day', '+15 hours', '+30 minutes'),
    'appointment', 'Explorar territórios para a campanha de Primavera da Rádio Cultura.', 'Sala Criativa', 'team'
  );
