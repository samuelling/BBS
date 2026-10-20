-- Trade Wipes 2002: a shared universe for the door game. The universe itself (warps) lives in
-- tw_meta as JSON and is generated on first use from a stored seed.
CREATE TABLE tw_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE tw_ports (
  sector INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  class INTEGER NOT NULL,
  s0 INTEGER NOT NULL, s1 INTEGER NOT NULL, s2 INTEGER NOT NULL,
  m0 INTEGER NOT NULL, m1 INTEGER NOT NULL, m2 INTEGER NOT NULL,
  day TEXT NOT NULL
);
CREATE TABLE tw_players (
  user_id INTEGER PRIMARY KEY,
  handle TEXT NOT NULL,
  sector INTEGER NOT NULL DEFAULT 1,
  ship INTEGER NOT NULL DEFAULT 0,
  holds INTEGER NOT NULL,
  c0 INTEGER NOT NULL DEFAULT 0, c1 INTEGER NOT NULL DEFAULT 0, c2 INTEGER NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL,
  fighters INTEGER NOT NULL,
  shields INTEGER NOT NULL,
  torps INTEGER NOT NULL DEFAULT 0,
  turns INTEGER NOT NULL,
  turns_day TEXT NOT NULL,
  exp INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  explored TEXT NOT NULL DEFAULT '',
  deal TEXT,
  last_seen INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX tw_players_sector ON tw_players(sector);
CREATE TABLE tw_fighters (sector INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE tw_planets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sector INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  colonists INTEGER NOT NULL,
  p0 INTEGER NOT NULL DEFAULT 0, p1 INTEGER NOT NULL DEFAULT 0, p2 INTEGER NOT NULL DEFAULT 0,
  fighters INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX tw_planets_sector ON tw_planets(sector);
CREATE TABLE tw_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  text TEXT NOT NULL,
  target_id INTEGER
);
CREATE INDEX tw_news_target ON tw_news(target_id, at);
