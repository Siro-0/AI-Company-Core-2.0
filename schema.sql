CREATE TABLE IF NOT EXISTS company_store (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_heartbeat_at TEXT,
  cycle_count INTEGER NOT NULL DEFAULT 0,
  runtime_version TEXT NOT NULL DEFAULT '7.0.2-self-evolving-company-os-free-only'
);

INSERT OR IGNORE INTO runtime_meta (
  id,
  last_heartbeat_at,
  cycle_count,
  runtime_version
)
VALUES (
  1,
  NULL,
  0,
  '7.0.2-self-evolving-company-os-free-only'
);

CREATE INDEX IF NOT EXISTS idx_company_store_updated_at
ON company_store(updated_at);

CREATE TABLE IF NOT EXISTS runtime_locks (
  name TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runtime_locks_expires_at
ON runtime_locks(expires_at);
