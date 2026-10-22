-- Game Pack: classic shareware/freeware rebuilt for modern Macs and PCs.
-- The zips aren't stored on the board: ext_url points at each project's official release, and
-- the board streams it through its own /dl/ link, so to callers it looks like any other download.
-- (Once there's a home file server, these can be copied in and ext_url cleared.)
ALTER TABLE files ADD COLUMN ext_url TEXT;
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, content, ctype) VALUES (2, 'GAMEPACK.TXT', 'READ ME FIRST: the free classic games pack', 3211, 'SysOp', 1792628588992, 'approved', 1, '==============================================================================
          T H E   S E P T I C   T A N K Z   ::   G A M E   P A C K
         classic shareware & freeware, rebuilt to run on modern PCs
==============================================================================

These are all FREE downloads (they don''t touch your ratio). Every one is
legal to pass around: the engines are open source, and the game data is
either freeware or a free replacement. Grab the one for your machine.

------------------------------------------------------------------------------
 TYRIAN 2000                     OTYRIAN-WIN.ZIP / OTYRIAN-MAC.ZIP
------------------------------------------------------------------------------
 The best vertical shooter on the PC, from 1995. The full game went freeware
 in 2004. OpenTyrian (GNU GPL) is a port of the original code that runs on
 Windows and Mac, with the freeware game data packed in. Unzip and run.

------------------------------------------------------------------------------
 DOOM, MINUS THE COPYRIGHT       FREEDOOM.ZIP + WOOF-WIN.ZIP / WOOF-MAC.ZIP
------------------------------------------------------------------------------
 id Software opened the Doom engine source in 1997. Freedoom is a complete
 replacement for Doom''s levels, art and sound, made by volunteers and free
 under a BSD license. Woof! (GNU GPL) is a faithful modern Doom engine.
 You need BOTH: unzip Woof, unzip Freedoom, and put freedoom1.wad (Phase 1,
 the episodes) or freedoom2.wad (Phase 2, one long campaign) next to Woof.
 Got your old DOOM1.WAD from a shareware disk? Woof plays that too.

------------------------------------------------------------------------------
 ONE MUST FALL 2097              OPENOMF-WIN.ZIP / OPENOMF-MAC.ZIP
------------------------------------------------------------------------------
 Giant robots punching each other, 1994. The original was released as
 freeware in 1999; OpenOMF (MIT license) is an open-source remake of the
 engine. The Mac build is for Apple Silicon (M1 and later), macOS 14+.

------------------------------------------------------------------------------
 MAC USERS
------------------------------------------------------------------------------
 These apps aren''t from the App Store, so the first time you open one, macOS
 may refuse. Right-click (or Control-click) the app, choose Open, then Open
 again. If it still says the app is damaged, open Terminal and run:
     xattr -dr com.apple.quarantine /path/to/the.app

------------------------------------------------------------------------------
 CREDITS
------------------------------------------------------------------------------
 Tyrian: Jason Emery, Alexander Brandon, Daniel Cook (World Tree Games)
   OpenTyrian: github.com/opentyrian/opentyrian
 Doom: id Software.  Freedoom: freedoom.github.io
   Woof!: github.com/fabiangreffrath/woof
 One Must Fall 2097: Diversions Entertainment / Epic MegaGames
   OpenOMF: github.com/omf2097/openomf

 Each zip is the project''s own unmodified release, with its license inside.
 Report broken files to the SysOp. Flush responsibly.
==============================================================================
', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (2, 'OTYRIAN-WIN.ZIP', 'Tyrian 2000 (OpenTyrian) for Windows, full game', 5810000, 'SysOp', 1792628588991, 'approved', 1, 'https://github.com/opentyrian/opentyrian/releases/download/v2.1.20260913/opentyrian-v2.1.20260913-windows-x86_64.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (2, 'OTYRIAN-MAC.ZIP', 'Tyrian 2000 (OpenTyrian) for Mac, full game', 6880000, 'SysOp', 1792628588990, 'approved', 1, 'https://github.com/opentyrian/opentyrian/releases/download/v2.1.20260913/opentyrian-v2.1.20260913-macos-universal.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (2, 'FREEDOOM.ZIP', 'Freedoom 0.13: free Doom levels, art, sound (BSD)', 23000000, 'SysOp', 1792628588989, 'approved', 1, 'https://github.com/freedoom/freedoom/releases/download/v0.13.0/freedoom-0.13.0.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (2, 'WOOF-WIN.ZIP', 'Woof! 16 Doom engine for Windows (GPL)', 5540000, 'SysOp', 1792628588988, 'approved', 1, 'https://github.com/fabiangreffrath/woof/releases/download/woof_16.0.0/Woof-16.0.0-win64.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (2, 'WOOF-MAC.ZIP', 'Woof! 16 Doom engine for Mac (GPL)', 15700000, 'SysOp', 1792628588987, 'approved', 1, 'https://github.com/fabiangreffrath/woof/releases/download/woof_16.0.0/Woof-16.0.0-uni.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (2, 'OPENOMF-WIN.ZIP', 'One Must Fall 2097 (OpenOMF) for Windows', 22000000, 'SysOp', 1792628588986, 'approved', 1, 'https://github.com/omf2097/openomf/releases/download/0.8.6/openomf_0.8.6_windows.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (2, 'OPENOMF-MAC.ZIP', 'One Must Fall 2097 (OpenOMF), Apple Silicon Mac', 18800000, 'SysOp', 1792628588985, 'approved', 1, 'https://github.com/omf2097/openomf/releases/download/0.8.6/openomf_0.8.6_macos14_arm.zip', 'application/zip');
