PRAGMA foreign_keys = ON;

-- 1. Adicionar referência ao template no ciclo para fixar a estrutura
ALTER TABLE evaluation_cycles ADD COLUMN template_id TEXT REFERENCES evaluation_templates(id) ON DELETE SET NULL;

-- 2. Adicionar configurações de privacidade no próprio ciclo para ditar como os assignments serão gerados
ALTER TABLE evaluation_cycles ADD COLUMN self_confidential INTEGER NOT NULL DEFAULT 0;
ALTER TABLE evaluation_cycles ADD COLUMN manager_confidential INTEGER NOT NULL DEFAULT 0;
ALTER TABLE evaluation_cycles ADD COLUMN peer_confidential INTEGER NOT NULL DEFAULT 1;
ALTER TABLE evaluation_cycles ADD COLUMN direct_report_confidential INTEGER NOT NULL DEFAULT 1;

-- 3. Adicionar configuração de auto_assign
-- Controla se ao ativar o ciclo o sistema gera avaliações para self, manager e direct_report.
ALTER TABLE evaluation_cycles ADD COLUMN auto_assign_self INTEGER NOT NULL DEFAULT 1;
ALTER TABLE evaluation_cycles ADD COLUMN auto_assign_manager INTEGER NOT NULL DEFAULT 1;
ALTER TABLE evaluation_cycles ADD COLUMN auto_assign_direct_report INTEGER NOT NULL DEFAULT 1;
