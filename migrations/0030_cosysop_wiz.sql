-- Wiz (Matt Crump) is co-SysOp, with access to the Septic Tank. Does nothing until an account called Wiz exists;
-- after that, the SysOp console's Users screen ({S}) grants or removes co-SysOp.
UPDATE users SET level = 255, elite = 1 WHERE LOWER(handle) = 'wiz' AND banned = 0;
