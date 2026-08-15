-- Historical migrations built a demonstration tenant so later schema changes
-- could be exercised. Remove only those known records; do not touch customer
-- data or the technical administrator created by migration 0004.
DELETE FROM calendar_events
WHERE id IN ('agenda-briefing-shopping', 'agenda-revisao-manifesto', 'agenda-toro-ideias');

DELETE FROM projects
WHERE id IN ('project-shopping-uberaba', 'project-sicredi', 'project-radio-cultura');

DELETE FROM clients
WHERE id IN ('client-shopping-uberaba', 'client-sicredi', 'client-radio-cultura');

DELETE FROM users
WHERE id IN ('team-guilherme', 'team-lorraine', 'team-mateus', 'team-vitoria', 'team-rafael');
