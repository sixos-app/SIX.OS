-- Migration corretiva: documenta e normaliza o gap da duplicata 0022
--
-- Contexto:
--   0022_auth_login_attempts.sql (id=22) e 0022_security_hardening.sql (id=23)
--   compartilham o prefixo 0022. Ambas foram aplicadas com sucesso em produção
--   em 2026-08-11 03:27:51 na ordem alfabética natural.
--
--   A primeira criou auth_login_attempts SEM DEFAULT CURRENT_TIMESTAMP em updated_at.
--   A segunda tentou CREATE TABLE IF NOT EXISTS (sem efeito) e adicionou o índice.
--
--   SQLite não suporta ALTER COLUMN para corrigir o DEFAULT retroativamente,
--   mas o backend já fornece o valor explicitamente em todas as escritas.
--
--   Esta migration é puramente defensiva: garante que o índice existe
--   independentemente da ordem de aplicação das 0022, e serve como
--   documentação permanente para futuros desenvolvedores.
--
-- Impacto: NENHUM — operação idempotente somente de leitura/criação condicional.

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_updated
  ON auth_login_attempts(updated_at);
