-- The Septic Tankz: core schema

CREATE TABLE config (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 10,          -- 10 user, 255 sysop
  elite INTEGER NOT NULL DEFAULT 0,           -- has Cesspool access
  banned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_call INTEGER,
  calls INTEGER NOT NULL DEFAULT 0,
  ul_bytes INTEGER NOT NULL DEFAULT 0,
  ul_files INTEGER NOT NULL DEFAULT 0,
  dl_bytes INTEGER NOT NULL DEFAULT 0,
  dl_files INTEGER NOT NULL DEFAULT 0,
  credit_main INTEGER NOT NULL DEFAULT 0,     -- bytes you may still download on the main side
  credit_elite INTEGER NOT NULL DEFAULT 0,    -- bytes you may still download in the Cesspool
  posts INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT
);

-- One row per phone line. A caller holds a line while their heartbeat is fresh.
CREATE TABLE line (
  node INTEGER PRIMARY KEY,
  token TEXT,
  user_id INTEGER,
  handle TEXT,
  activity TEXT,
  since INTEGER NOT NULL DEFAULT 0,
  beat INTEGER NOT NULL DEFAULT 0,
  backdoor INTEGER NOT NULL DEFAULT 0,
  elite_ok INTEGER NOT NULL DEFAULT 0,
  fails INTEGER NOT NULL DEFAULT 0,
  posted INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT
);

CREATE TABLE areas (
  id INTEGER PRIMARY KEY,
  side TEXT NOT NULL,                         -- 'main' or 'elite'
  name TEXT NOT NULL,
  descr TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  descr TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL,
  uploader_id INTEGER,
  uploader TEXT NOT NULL DEFAULT '',
  uploaded_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',     -- pending | approved
  free INTEGER NOT NULL DEFAULT 0,            -- downloads don't cost credit
  downloads INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT,                                -- stored in R2, or...
  content TEXT,                               -- ...small built-in text files stored inline
  ctype TEXT NOT NULL DEFAULT 'application/octet-stream'
);
CREATE INDEX files_area ON files(area_id, status);
CREATE INDEX files_uploader ON files(uploader_id, uploaded_at);

CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  file_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE bases (
  id INTEGER PRIMARY KEY,
  side TEXT NOT NULL,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_id INTEGER NOT NULL,
  from_id INTEGER,
  from_handle TEXT NOT NULL,
  to_handle TEXT NOT NULL DEFAULT 'All',
  subj TEXT NOT NULL,
  body TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX posts_base ON posts(base_id, id);

CREATE TABLE mail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_id INTEGER NOT NULL,
  from_id INTEGER,
  from_handle TEXT NOT NULL,
  subj TEXT NOT NULL,
  body TEXT NOT NULL,
  at INTEGER NOT NULL,
  read INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX mail_to ON mail(to_id, id);

CREATE TABLE oneliners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  handle TEXT NOT NULL,
  text TEXT NOT NULL,
  at INTEGER NOT NULL
);

CREATE TABLE callers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  handle TEXT NOT NULL,
  node INTEGER NOT NULL,
  at INTEGER NOT NULL,
  elite INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  handle TEXT NOT NULL,
  text TEXT NOT NULL,
  at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
);
