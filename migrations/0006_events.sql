-- Usage log for the SysOp's stats dashboard.
-- kind: dial_ok | dial_busy | call_end (value = ms on line) | download (value = bytes, ref = file id) | upload (value = bytes, ref = file id)
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  user_id INTEGER,
  node INTEGER,
  modem TEXT,
  value INTEGER NOT NULL DEFAULT 0,
  ref INTEGER
);
CREATE INDEX events_at ON events(at);
ALTER TABLE line ADD COLUMN modem TEXT;
