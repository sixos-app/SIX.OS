PRAGMA foreign_keys = ON;

-- Cada colaborador que efetivamente conclui uma etapa recebe o XP integral
-- quando a missão inteira é aprovada. A restrição UNIQUE (mission_id, user_id)
-- de xp_awards impede crédito duplicado se alguém atuar em mais de uma etapa.
UPDATE xp_rules
SET recipient_mode = 'participants_each', version = version + 1, updated_at = CURRENT_TIMESTAMP
WHERE recipient_mode <> 'participants_each';
