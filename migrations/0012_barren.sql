-- Barren Drains Elite: a shared-world empire door. One realm per caller.
CREATE TABLE bde_realms (
  user_id INTEGER PRIMARY KEY,
  handle TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  ver INTEGER NOT NULL DEFAULT 0,       -- bumped on every write, so two writes can't trample each other
  day TEXT NOT NULL,                    -- last calendar day (New York) turns were handed out
  turns INTEGER NOT NULL,
  years INTEGER NOT NULL DEFAULT 0,     -- turns played; every turn is a year
  prot INTEGER NOT NULL DEFAULT 1,      -- 0 once the realm attacks someone (gives up protection early)
  land INTEGER NOT NULL,
  farms INTEGER NOT NULL,
  outhouses INTEGER NOT NULL,
  bunks INTEGER NOT NULL,
  towers INTEGER NOT NULL,
  thrones INTEGER NOT NULL,
  peasants INTEGER NOT NULL,
  food INTEGER NOT NULL,
  gold INTEGER NOT NULL,
  tax INTEGER NOT NULL,
  plungers INTEGER NOT NULL,
  slingers INTEGER NOT NULL,
  wagons INTEGER NOT NULL,
  sniffers INTEGER NOT NULL,
  spy_day TEXT NOT NULL DEFAULT '',
  spies INTEGER NOT NULL DEFAULT 0,     -- sniffers sent today
  hit_day TEXT NOT NULL DEFAULT '',
  hits INTEGER NOT NULL DEFAULT 0,      -- times attacked today
  networth INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX bde_realms_nw ON bde_realms(networth DESC);

CREATE TABLE bde_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  text TEXT NOT NULL
);

-- What happened to your realm while you were away.
CREATE TABLE bde_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  at INTEGER NOT NULL,
  text TEXT NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX bde_reports_user ON bde_reports(user_id, seen);

-- a offered a pact to b. Two realms are allies when both rows exist.
CREATE TABLE bde_pacts (
  a INTEGER NOT NULL,
  b INTEGER NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (a, b)
);
