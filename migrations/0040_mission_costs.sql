PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN hourly_rate REAL NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0);
ALTER TABLE missions ADD COLUMN realized_cost REAL NOT NULL DEFAULT 0 CHECK (realized_cost >= 0);
ALTER TABLE time_entries ADD COLUMN cost REAL NOT NULL DEFAULT 0 CHECK (cost >= 0);

UPDATE users SET hourly_rate = 50.0 WHERE username = 'agsix';
