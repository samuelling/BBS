-- USURPER (c) 1993-2009 Jakob Dangarden. Ported by Rick Parrish, bug fixes by Dan Zingaro.
-- Free software under the GNU GPL v2 or later. Converted for MEGAzine BBS.
--
-- Phase 3: relations, marriage, children and homes; the Gods, the Altar and the Supreme Being;
-- the Gym, wrestling, brawls, the Marketplace and sending items.
-- Additive only: existing characters keep working (new character fields live in the JSON
-- `data` with defaults filled in by the game).
--
-- usurper_players.location also uses 8 = asleep at home.

-- Personal relations between two characters (RELATION.PAS RelationRec). a < b always;
-- ab = how a feels about b, ba = how b feels about a, using the CMS.PAS relation constants
-- (10 married, 20 love, 30 passion, 40 friendship, 50 trust, 60 respect, 70 normal,
-- 80 suspicious, 90 anger, 100 enemy, 110 hate).
CREATE TABLE usurper_relations (
  a INTEGER NOT NULL,
  b INTEGER NOT NULL,
  ab INTEGER NOT NULL DEFAULT 70,
  ba INTEGER NOT NULL DEFAULT 70,
  married_times INTEGER NOT NULL DEFAULT 0,
  married_on TEXT,
  kids INTEGER NOT NULL DEFAULT 0,
  banned INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (a, b)
);
CREATE INDEX usurper_relations_b ON usurper_relations(b);

-- Children (CHILDREN.PAS ChildRec); the rest of the record is JSON in `data`.
-- location: 0 = home, 1 = the Royal Orphanage.
CREATE TABLE usurper_children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  mother_id INTEGER,
  father_id INTEGER,
  location INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL
);
CREATE INDEX usurper_children_mother ON usurper_children(mother_id, deleted);
CREATE INDEX usurper_children_father ON usurper_children(father_id, deleted);

-- Requests that wait for the other player to answer next time they play (MAIL.PAS mail
-- requests: dates, gifts, family time, gym cards ...).
CREATE TABLE usurper_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_id INTEGER NOT NULL,
  from_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  at INTEGER NOT NULL
);
CREATE INDEX usurper_requests_to ON usurper_requests(to_id);

-- Logs kept apart from the Daily News (GENNEWS.PAS Generic_News): kind = 'love' (marriages
-- and divorces), 'child' (births and children leaving home), 'heroes' (the game completed).
CREATE TABLE usurper_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  day TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE INDEX usurper_history_kind ON usurper_history(kind, id);

-- Immortals (INITGODS.PAS GodRec): players who defeated the Supreme Being and chose to become
-- a God. user_id is the board account that plays the God.
CREATE TABLE usurper_gods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  sex INTEGER NOT NULL DEFAULT 1,
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 1,
  deeds INTEGER NOT NULL DEFAULT 5,
  day TEXT,
  darkness INTEGER NOT NULL DEFAULT 0,
  goodness INTEGER NOT NULL DEFAULT 0,
  created TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX usurper_gods_user ON usurper_gods(user_id);
