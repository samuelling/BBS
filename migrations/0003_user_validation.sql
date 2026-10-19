-- New-user validation: what the caller wrote on their application.
-- Level 5 = signed up, waiting for the SysOp; 10 = validated user; 255 = SysOp.
ALTER TABLE users ADD COLUMN app TEXT NOT NULL DEFAULT '';
