-- USURPER (c) 1993-2009 Jakob Dangarden. Ported by Rick Parrish, bug fixes by Dan Zingaro.
-- Free software under the GNU GPL v2 or later. Converted for The Septic Tankz.
--
-- Phase 2: gangs, the Castle and the throne, prison, bounties and royal quests.
-- Additive only: phase-1 character rows keep working (new character fields live in the JSON
-- `data` with defaults filled in by the game).
--
-- usurper_players.location now also uses 5 = asleep in the Castle (the ruler), 6 = in prison,
-- 7 = asleep at the Beggars Wall (0 = Dormitory and 1-4 = Inn floors as before).

-- A character's gang, copied out of `data` so members can be found quickly.
ALTER TABLE usurper_players ADD COLUMN team TEXT NOT NULL DEFAULT '';
CREATE INDEX usurper_players_team ON usurper_players(team);

-- Gangs (TCORNER.PAS). pw is a hash of the team password; turf = controls the town.
CREATE TABLE usurper_teams (
  name TEXT PRIMARY KEY COLLATE NOCASE,
  pw TEXT NOT NULL,
  founder INTEGER,
  created INTEGER NOT NULL,
  turf INTEGER NOT NULL DEFAULT 0,
  turf_day TEXT,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0
);

-- The realm: k = 'king' holds the KingRec (INIT.PAS) as JSON.
CREATE TABLE usurper_realm (
  k TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

-- History of Monarchs.
CREATE TABLE usurper_monarchs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  sex INTEGER NOT NULL DEFAULT 1,
  race INTEGER NOT NULL DEFAULT 0,
  crowned TEXT NOT NULL,
  ended TEXT,
  days INTEGER NOT NULL DEFAULT 0,
  how TEXT
);

-- Wanted posters (BOUNTY.PAS / WANTEDSC.PAS).
CREATE TABLE usurper_wanted (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER NOT NULL,
  target TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  by_id INTEGER NOT NULL,
  by_name TEXT NOT NULL,
  anon INTEGER NOT NULL DEFAULT 0,
  gold INTEGER NOT NULL,
  at INTEGER NOT NULL,
  collected INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX usurper_wanted_target ON usurper_wanted(target_id, collected);

-- Royal quests (RQUESTS.PAS / PLYQUEST.PAS): the QuestRec as JSON.
CREATE TABLE usurper_quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  occupier INTEGER,
  done INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE INDEX usurper_quests_open ON usurper_quests(done, occupier);
