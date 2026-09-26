CREATE TABLE IF NOT EXISTS rooms (
 code TEXT PRIMARY KEY,
 version INTEGER NOT NULL DEFAULT 0,
 payload TEXT NOT NULL,
 status TEXT NOT NULL,
 scenario TEXT NOT NULL,
 team_name TEXT NOT NULL,
 score INTEGER NOT NULL DEFAULT 0,
 listed INTEGER NOT NULL DEFAULT 0,
 report_id TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS rooms_board ON rooms(listed,status,score DESC);
CREATE INDEX IF NOT EXISTS rooms_expiration ON rooms(expires_at);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires_at INTEGER NOT NULL);
