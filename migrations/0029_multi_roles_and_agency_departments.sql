PRAGMA foreign_keys = ON;

-- Um colaborador pode acumular ate cinco cargos. O primeiro permanece como
-- cargo principal para compatibilidade com integracoes e telas legadas.
CREATE TABLE user_role_assignments_v2 (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL REFERENCES role_definitions(code) ON DELETE RESTRICT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_code)
);

INSERT OR IGNORE INTO user_role_assignments_v2 (user_id, role_code, is_primary, assigned_at)
SELECT user_id, role_code, 1, assigned_at
FROM user_role_assignments;

DROP TABLE user_role_assignments;
ALTER TABLE user_role_assignments_v2 RENAME TO user_role_assignments;

CREATE INDEX idx_user_role_assignments_role ON user_role_assignments(role_code);
CREATE UNIQUE INDEX idx_user_role_assignments_primary
  ON user_role_assignments(user_id)
  WHERE is_primary = 1;

CREATE TRIGGER user_role_assignments_max_five
BEFORE INSERT ON user_role_assignments
WHEN (SELECT COUNT(*) FROM user_role_assignments WHERE user_id = NEW.user_id) >= 5
BEGIN
  SELECT RAISE(ABORT, 'Um colaborador pode ter no maximo cinco cargos');
END;

-- Atendimento continua sendo uma area/departamento. O antigo perfil de
-- permissao Atendimento passa a se chamar Planejamento.
UPDATE role_definitions
SET name = 'Planejamento',
    description = 'Planejamento de clientes, projetos, briefings e acompanhamento.'
WHERE code = 'service';

UPDATE access_profiles
SET name = 'Planejamento',
    description = 'Planejamento de clientes, projetos, briefings e acompanhamento.',
    updated_at = CURRENT_TIMESTAMP
WHERE code = 'service';

-- Estrutura-base solicitada, criada para cada organizacao sem remover areas
-- adicionais que a empresa ja tenha configurado.
INSERT OR IGNORE INTO departments (id, organization_id, code, name, description)
SELECT 'dept-' || id || '-atendimento', id, 'atendimento', 'Atendimento', 'Relacionamento e atendimento aos clientes.'
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM departments d
  WHERE d.organization_id = organizations.id AND lower(d.name) = 'atendimento'
);

INSERT OR IGNORE INTO departments (id, organization_id, code, name, description)
SELECT 'dept-' || id || '-planejamento', id, 'planejamento', 'Planejamento', 'Estrategia, briefing e planejamento de entregas.'
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM departments d
  WHERE d.organization_id = organizations.id AND lower(d.name) = 'planejamento'
);

INSERT OR IGNORE INTO departments (id, organization_id, code, name, description)
SELECT 'dept-' || id || '-criacao', id, 'criacao', 'Criação', 'Direcao de arte, design e criacao.'
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM departments d
  WHERE d.organization_id = organizations.id AND lower(d.name) = 'criação'
);

INSERT OR IGNORE INTO departments (id, organization_id, code, name, description)
SELECT 'dept-' || id || '-social-midia', id, 'social_midia', 'Social Mídia', 'Conteudo, comunidade e canais sociais.'
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM departments d
  WHERE d.organization_id = organizations.id AND lower(d.name) = 'social mídia'
);

INSERT OR IGNORE INTO departments (id, organization_id, code, name, description)
SELECT 'dept-' || id || '-audiovisual', id, 'audiovisual', 'Audiovisual', 'Producao, captacao e pos-producao audiovisual.'
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM departments d
  WHERE d.organization_id = organizations.id AND lower(d.name) = 'audiovisual'
);
