PRAGMA foreign_keys = ON;

-- Garante que cada assignment_id só possa ter uma response
CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluation_responses_unique_assignment ON evaluation_responses(assignment_id);
