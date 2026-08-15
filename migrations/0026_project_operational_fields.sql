ALTER TABLE projects ADD COLUMN visual_tone TEXT NOT NULL DEFAULT 'lime' CHECK (visual_tone IN ('lime', 'purple', 'orange'));
ALTER TABLE projects ADD COLUMN next_step TEXT NOT NULL DEFAULT 'Definir o próximo movimento.';
ALTER TABLE projects ADD COLUMN activity TEXT NOT NULL DEFAULT 'Projeto criado.';
