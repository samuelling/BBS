-- Live chat: teleconference rooms, SysOp pages, and the SysOp's local console (line node 0).
ALTER TABLE line ADD COLUMN room TEXT;

CREATE TABLE chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL,
  user_id INTEGER,
  handle TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'msg',      -- msg | join | leave
  text TEXT NOT NULL DEFAULT '',
  at INTEGER NOT NULL
);
CREATE INDEX chat_room ON chat(room, id);

CREATE TABLE pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  handle TEXT NOT NULL,
  node INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  at INTEGER NOT NULL,
  answered INTEGER NOT NULL DEFAULT 0
);
