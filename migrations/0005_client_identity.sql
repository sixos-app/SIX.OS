ALTER TABLE clients ADD COLUMN short_code TEXT;
ALTER TABLE clients ADD COLUMN image_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_organization_short_code ON clients(organization_id, short_code) WHERE short_code IS NOT NULL;

UPDATE clients
SET short_code = CASE id
  WHEN 'client-shopping-uberaba' THEN 'SHO'
  WHEN 'client-sicredi' THEN 'SIC'
  WHEN 'client-radio-cultura' THEN 'RDC'
  ELSE short_code
END
WHERE short_code IS NULL;
