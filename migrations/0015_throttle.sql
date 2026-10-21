-- Flood protection: fixed-window counters (signups, dials, bad logins, uploads). Expired rows are swept by the cron.
CREATE TABLE throttle (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  reset INTEGER NOT NULL
);
