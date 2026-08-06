-- Alter tables to support profile information
ALTER TABLE gamification_profiles ADD COLUMN social_name TEXT;
ALTER TABLE gamification_profiles ADD COLUMN custom_role TEXT;
ALTER TABLE gamification_profiles ADD COLUMN bio TEXT;
ALTER TABLE gamification_profiles ADD COLUMN highlight_color TEXT DEFAULT '#c6ff38';
ALTER TABLE gamification_profiles ADD COLUMN banner_url TEXT;
ALTER TABLE gamification_profiles ADD COLUMN internal_networks TEXT;
ALTER TABLE gamification_profiles ADD COLUMN signature TEXT;
ALTER TABLE gamification_profiles ADD COLUMN stickers TEXT DEFAULT '[]';

-- Create organization_settings table for Admin configuration of XP, levels and rewards
CREATE TABLE IF NOT EXISTS organization_settings (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  xp_multiplier REAL NOT NULL DEFAULT 1.0,
  level_config TEXT,
  rewards_config TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings for existing organization
INSERT OR IGNORE INTO organization_settings (organization_id, xp_multiplier, level_config, rewards_config)
VALUES (
  'org-six',
  1.0,
  '[{"name":"Criador","target":0,"detail":"Transforma intenção em entrega."},{"name":"Visionário","target":8700,"detail":"Enxerga possibilidades antes do óbvio."},{"name":"Catalisador","target":12000,"detail":"Move pessoas e ideias para a frente."}]',
  '[{"id":"reward-1","title":"Kudos no Feed","xpCost":100},{"id":"reward-2","title":"Adesivo Personalizado","xpCost":500},{"id":"reward-3","title":"Folga de Meio Período","xpCost":2000}]'
);
