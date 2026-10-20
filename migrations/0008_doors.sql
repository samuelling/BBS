-- Door games: one saved game per caller per single-player door, and each caller's best score.
CREATE TABLE door_saves (
  user_id INTEGER NOT NULL,
  game TEXT NOT NULL,
  data TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (user_id, game)
);
CREATE TABLE door_scores (
  game TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  handle TEXT NOT NULL,
  score INTEGER NOT NULL,
  detail TEXT,
  at INTEGER NOT NULL,
  PRIMARY KEY (game, user_id)
);
CREATE INDEX door_scores_top ON door_scores(game, score DESC);
