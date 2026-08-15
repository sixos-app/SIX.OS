-- Existing integration secrets were stored in plaintext. Rebuild the table with
-- tenant-scoped uniqueness and require every provider to be configured again
-- through the encrypted API.
CREATE TABLE external_integrations_secure (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('slack', 'runrunit')),
  config_json TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, provider)
);

INSERT OR IGNORE INTO external_integrations_secure (id, organization_id, provider, config_json, is_active, updated_at)
SELECT lower(hex(randomblob(16))), ei.organization_id, ei.provider, '', 0, CURRENT_TIMESTAMP
FROM external_integrations ei
JOIN organizations organization ON organization.id = ei.organization_id
WHERE ei.provider IN ('slack', 'runrunit');

DROP TABLE external_integrations;
ALTER TABLE external_integrations_secure RENAME TO external_integrations;
CREATE INDEX idx_external_integrations_org ON external_integrations(organization_id, provider);

INSERT OR IGNORE INTO permissions (code, module, action, description, sensitivity)
VALUES ('integrations.manage', 'integrations', 'manage', 'Configurar integrações externas e seus segredos.', 'critical');

INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope)
SELECT id, 'integrations.manage', 'all'
FROM access_profiles
WHERE code = 'admin_tech';
