-- USURPER (c) 1993-2009 Jakob Dangarden. Ported by Rick Parrish, bug fixes by Dan Zingaro.
-- Free software under the GNU GPL v2 or later. Converted for The Septic Tankz.
--
-- One row per character. The full character sheet lives in `data` (JSON); the columns
-- beside it are copies used for lists (who sleeps where, rankings).
CREATE TABLE usurper_players (
  user_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
  location INTEGER NOT NULL DEFAULT 0,   -- 0 = Dormitory, 1-4 = Inn room floor
  hps INTEGER NOT NULL DEFAULT 1,
  allowed INTEGER NOT NULL DEFAULT 1,
  data TEXT NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX usurper_players_exp ON usurper_players(exp DESC);

-- The Daily News ("newsy" in NEWS.PAS). day = calendar day in New York, e.g. 2026-10-20.
CREATE TABLE usurper_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  at INTEGER NOT NULL,
  head TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE INDEX usurper_news_day ON usurper_news(day, id);

-- In-game mail (MAIL.PAS "post"): death notices, robberies, after-fight notes.
CREATE TABLE usurper_mail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_id INTEGER NOT NULL,
  at INTEGER NOT NULL,
  head TEXT NOT NULL,
  body TEXT NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX usurper_mail_to ON usurper_mail(to_id, seen);
