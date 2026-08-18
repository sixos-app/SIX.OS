-- 0044_close_orphan_active_timers.sql
-- Encerra com segurança quaisquer registros abertos de time_entries (timer)
-- que estejam associados a missões canceladas, concluídas ou inexistentes.

-- 1. Encerrar timers abertos de missões canceladas ou concluídas
UPDATE time_entries
SET
  ended_at = COALESCE(
    (SELECT updated_at FROM missions WHERE missions.id = time_entries.mission_id),
    time_entries.created_at,
    datetime('now')
  ),
  duration_seconds = MAX(0, CAST((strftime('%s', COALESCE((SELECT updated_at FROM missions WHERE missions.id = time_entries.mission_id), time_entries.created_at, datetime('now'))) - strftime('%s', time_entries.started_at)) AS INTEGER)),
  hours = MAX(0, CAST((strftime('%s', COALESCE((SELECT updated_at FROM missions WHERE missions.id = time_entries.mission_id), time_entries.created_at, datetime('now'))) - strftime('%s', time_entries.started_at)) AS INTEGER)) / 3600,
  minutes = (MAX(0, CAST((strftime('%s', COALESCE((SELECT updated_at FROM missions WHERE missions.id = time_entries.mission_id), time_entries.created_at, datetime('now'))) - strftime('%s', time_entries.started_at)) AS INTEGER)) % 3600) / 60
WHERE entry_type = 'timer'
  AND ended_at IS NULL
  AND mission_id IN (
    SELECT id FROM missions WHERE status IN ('cancelled', 'completed')
  );

-- 2. Encerrar timers abertos de missões inexistentes ou órfãs
UPDATE time_entries
SET
  ended_at = COALESCE(time_entries.created_at, datetime('now')),
  duration_seconds = 0,
  hours = 0,
  minutes = 0
WHERE entry_type = 'timer'
  AND ended_at IS NULL
  AND mission_id IS NOT NULL
  AND mission_id NOT IN (SELECT id FROM missions);

-- 3. Índice parcial para garantir rápida recuperação e unicidade lógica do timer ativo por usuário
CREATE INDEX IF NOT EXISTS idx_time_entries_active_user_timer
ON time_entries (organization_id, user_id, entry_type)
WHERE ended_at IS NULL AND entry_type = 'timer';
