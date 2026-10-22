-- Open enrollment: new callers skip SysOp validation (toggle in the SysOp console). Starts ON.
INSERT OR REPLACE INTO config (k, v) VALUES ('open_enrollment', '1');
