-- The board is now MEGAzine BBS; the elite side (formerly the Cesspool) is the Septic Tank.
UPDATE bases SET name = 'The Septic Tank' WHERE id = 11 AND name = 'The Cesspool';
UPDATE posts SET subj = 'Welcome to MEGAzine' WHERE base_id = 1 AND subj = 'Welcome to the Tank';
UPDATE posts SET body = REPLACE(body, 'Lurkers will be flushed.', 'Lurkers will be recycled.') WHERE base_id = 1;
UPDATE posts SET body = REPLACE(body, 'New board, old basement.', 'New board, old photocopier.') WHERE base_id = 1;
UPDATE files SET area_id = 13, content = '=====================================================================
  CARE AND FEEDING OF YOUR SEPTIC SYSTEM
  a public service text from the Septic Tank
=====================================================================

HOW IT WORKS
  Everything from the house flows into the tank and separates into
  three layers:

    SCUM ........ grease and light stuff that floats on top
    EFFLUENT .... the mostly-clear liquid in the middle
    SLUDGE ...... the heavy solids that sink to the bottom

  Only the middle layer leaves the tank, through the outlet tee, and
  soaks away into the leach field. Bacteria in the tank slowly break
  down the rest.

KEEP IT HAPPY
  * Have it pumped every 3 to 5 years, more often for a big family.
  * Spread out laundry. Ten loads on Saturday floods the leach field.
  * Fix running toilets. A trickle all day is a lot of water.
  * Don''t drive or park on the leach field.

NEVER FLUSH
  * Grease and cooking oil
  * "Flushable" wipes (they are not)
  * Paint, solvents, or medicines
  * Floppy disks (you know who you are)

SIGNS OF TROUBLE
  Slow drains, gurgling pipes, a soggy lawn over the leach field, or a
  smell outside. Call a pro before it calls you.

                                         -- ThE PLuMBeR, your SysOp
', size = 1272 WHERE filename = 'SEPTIC.TXT' AND content IS NOT NULL;
UPDATE files SET filename = 'SEPTIC.NFO', descr = 'Board NFO for the Septic Tank', content = ' .--=[ THE SEPTIC TANK ]=-------------------------------=[ ELiTE ]=--.
 |                                                                    |
 |   the bottom of MEGAzine BBS                                       |
 |                                                                    |
 |   nodes ......... 1, so be quick                                   |
 |   ratio ......... 1:3, no starting credit, upload or rot           |
 |   access ........ by invite or application only                    |
 |   validation .... every upload checked by the SysOp                |
 |                                                                    |
 |   no lamers  ::  no narcs  ::  no viruses  ::  no bullshit         |
 |                                                                    |
 ''--------------------------------------------------------------------''
', size = 863 WHERE filename = 'CESSPOOL.NFO' AND content IS NOT NULL;
UPDATE files SET content = 'UPLOAD/DOWNLOAD RATIOS ON MEGAZINE BBS
=====================================

This board runs on ratios, like every good board does. You earn
download credit by uploading.

THE MAIN BOARD
  * New users start with 2,048K of download credit.
  * Every byte you upload earns 5 bytes of credit (1:5).
  * Credit is added when the SysOp validates your upload, not before.
  * Files marked FREE cost nothing to download.
  * Reading text files on-line is always free.

UPLOADING
  * Upload from the file area you want the file to go in.
  * New uploads wait in the SysOp''s validation queue. Junk, viruses
    and anything we don''t want to host get shredded without credit.
  * Give your file a real description. "cool file" is not one.

YOUR STATS
  Check [Y] Your Stats on the main menu any time to see your
  uploads, downloads and remaining credit.

Leeches will be recycled.
', size = 873 WHERE filename = 'RATIOS.TXT' AND content IS NOT NULL;
UPDATE files SET content = '===============================================================================
       T H E   7 1 6   L I S T   ::   boards worth calling, updated monthly
     in the tradition of Logan''s List, which was on every board in Rochester
===============================================================================
 Compiled by the SysOp of MEGAzine BBS.  Last update: October 2026.
 Want your board on the list, or one''s gone dead?  Leave the SysOp a comment.

 KEY:  Nodes = how many callers at once.  "telnet" = no modem needed, point a
       telnet client (SyncTERM, NetRunner, or plain telnet) at the address.

-------------------------------------------------------------------------------
 WESTERN NEW YORK (716 / 585)
-------------------------------------------------------------------------------
 MEGAZINE BBS ............................................. 1-716-555-2455
   Speeds: 300 to 56k, or Ethernet.   Nodes: 1 (or 2 when the SysOp feels
   fancy).   Software: homegrown.   Messages, files with ratios (1:5 main),
   door games: Usurper, Red Drain, Trade Wipes 2002, Zork, Colossal Cave.
   The zine''s home board: submissions, back issues. Elite side (the
   Septic Tank) if you know where to knock.   Validation required.
   You are here.

 SILICON UNDERGROUND ........................ telnet  siliconu.com
   Rochester, NY.  Running since the late ''80s through Fidonet days and
   now on the net.  WHQ for ProBoard; co-founded StormNet.  10 nodes.
   A real Rochester board you can still call.

-------------------------------------------------------------------------------
 LONG DISTANCE (still answering, all by telnet)
-------------------------------------------------------------------------------
 VERTRAUEN ................................. telnet  vert.synchro.net
   Riverside County, CA.  Since 1988.  Home board of Synchronet, run by
   Digital Man.  Huge message networks, tons of doors.

 BLACK FLAG ................................ telnet  blackflag.acid.org
   Hudson, FL.  Since 1995.  The ACiD art board: ANSI, ASCII and RIP art
   shows, plus L.O.R.D., Trade Wars 2002 and Barren Realms Elite (the real
   ones our doors are making fun of).

 LEVEL 29 .................................. telnet  bbs.fozztexx.com
   Also dial-up: 916-965-1701.  A retro-computing board you can call from
   real old hardware with a real modem.

 OPEN TW SERVER ........................... telnet  games.opentw.org:2002
   Not a BBS, just Trade Wars 2002 servers.  If Trade Wipes made you want
   the real thing, here it is.

 THE OASIS ............................. telnet  oasisbbs.hopto.org:6400
   Commodore 64 board (Color 64 software).  PETSCII graphics: use a
   C64-friendly terminal.

-------------------------------------------------------------------------------
 THE WAY IT WAS: ROCHESTER BOARDS, 1982-1997
-------------------------------------------------------------------------------
 Pulled from old BBS lists archived at textfiles.com. This is history, not a
 dialing guide: Rochester left 716 for 585 in 2001, and these numbers have
 long since gone to somebody''s kitchen phone. DON''T DIAL THEM.
 Called one of these back then? Tell the SysOp what it was like.

   NUMBER        BOARD                        TOWN         NOTES
   716-244-9531  CBBS RAMS                    Rochester    ''82-''84, CP/M
   716-425-1785  Rochester RBBS               Rochester    ''83, CP/M
   716-377-3985  5th Generation Systems       Fairport     Amiga, 2 nodes
   716-586-9335  The Bit Twiddler             Pittsford    ''88
   716-865-9339  Honds On Computer System     Rochester    ''89
   716-385-9669  Gorgar''s Castle              Rochester    ''90, 80 megs!
   716-424-2576  The Rochester HUG BBS        W. Henrietta ''90, Heath users
   716-458-8638  The Ware House               Rochester    ''90
   716-544-8327  Station Rochester            Rochester    RBBS
   716-723-8489  (PC)^3 BBS                   Rochester    2400
   716-265-4547  Skid Row BBS                 E. Rochester 2400
   716-359-8629  Drag City                    Henrietta    2400
   716-224-0078  Rochester Astro Info Network Rochester    stargazers
   716-663-0130  G.R.O.W. Great Lakes Ecology Rochester    9600
   716-621-9409  The Corner Bar               Rochester    14.4
   716-544-1863  The Vector Board             Rochester    ham radio
   716-659-2734  The Casino BBS               Rochester    gamblers'' info
   716-328-3405  Source4Source                Rochester    ''92, 160 megs
   716-342-2673  Irond                        Rochester    QuickBBS
   716-359-4730  Matrix Data Bank             Rochester    later 334-6541
   716-334-3582  Infinity BBS                 Rochester    9600
   716-383-1321  Intele-comm                  Rochester    9600
   716-473-5204  The Panic Zone               Rochester    3 lines
   716-482-2592  Crystal Palace               Rochester    190 megs
   716-865-2106  Knight Moves                 Rochester    200 megs
   716-461-1924  FROG Pond                    Rochester    FidoNet
   716-889-2016  Flower City Central          Chili        FidoNet, Opus
   716-262-2612  The Pigeon Coop              Rochester    Phoenix
   716-461-5201  The Recovery Room            Rochester    dual standard
   716-436-2759  The Private Exchange         Rochester    FidoNet
   716-442-8144  I''m Crushing Your Head       Rochester    a.k.a. Uplink
   716-271-6323  The Flaming Chalice          Rochester    14.4
   716-247-9056  Mac''s Last Stand             Rochester    Macs, 14.4
   716-359-0871  Kraut Haus                   Rochester    9600
   716-359-4736  WinterParadise               Henrietta    150 megs
   716-594-5440  The Oracle                   N. Chili     later 594-4227
   716-787-1155  The Viper''s Lair             Penfield     3 nodes
   716-872-3911  Golden Phoenix               Penfield     2400
   716-872-0128  Mike''s Maze                  Webster      Genesis
   716-964-8475  The Light House              Hamlin       9600
   716-964-7595  The Wild Hog                 Hamlin       FidoNet
   716-223-0412  Goose''s Roost                Fairport     Apple II
   716-225-7446  The Magic Carpet             Rochester    HST
   716-288-0299  Runt''s Madhouse              Rochester    Spitfire, 19.2
   716-288-5848  The Shack (TOO)              Rochester    still up in ''97
   716-235-4336  Hobie''s Fun House            Rochester    PCBoard
   716-723-0386  The Bit Bank                 Rochester    PCBoard
   716-723-0060  Vinnie''s BBS                 Rochester    HST
   716-458-2638  APEX BBS                     Rochester    Atari ST
   716-271-7864  Animal House                 Rochester    FidoNet
   716-473-6344  The Door Into Summer         Rochester    FidoNet
   716-224-9709  The Crystal Palace           Rochester    28.8 V.FC
   716-381-8538  The Rochester Lab            Pittsford    dual standard
   716-381-4749  The Mountains of Shadow      Pittsford    dual standard
   716-436-9497  NightWorX                    Rochester    dual standard
   716-482-5401  The Wayward Wind             Rochester    dual standard
   716-475-3044  The Garden South             Henrietta    V.32
   716-594-1804  Micro Science                Chili        dual standard
   716-426-5202  Xerox National PC-Board      Rochester    HST
   716-395-2173  SUNY Brockport               Brockport    PCBoard
   716-889-3353  The Vanishing Point          Rochester    ''93, UltraBBS
   716-473-2017  FreeSpirit Commune           Rochester    9600 HST
   716-334-3541  The Ebony BBS                Rochester    ''97, 28.8
   716-352-1629  Free File Farm               Spencerport  ''97, 2 lines

-------------------------------------------------------------------------------
 LISTED BUT NOT RECOMMENDED
-------------------------------------------------------------------------------
 THE GREASE TRAP .......................... private, 2400 baud, ask around
 MOM''S HOUSE .............................. NOT A BBS.  Stop calling it.
===============================================================================
', size = 8054 WHERE filename = '716LIST.TXT' AND content IS NOT NULL;
UPDATE files SET content = '==============================================================================
              M E G A Z I N E   B B S   ::   G A M E   P A C K
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
', size = 3207 WHERE filename = 'GAMEPACK.TXT' AND content IS NOT NULL;
UPDATE files SET content = REPLACE(REPLACE(REPLACE(content, 'The Septic Tankz', 'MEGAzine BBS'), 'THE SEPTIC TANKZ', 'MEGAZINE BBS'), 'the Cesspool', 'the Septic Tank') WHERE content IS NOT NULL;
UPDATE files SET descr = REPLACE(descr, 'Cesspool', 'Septic Tank') WHERE descr LIKE '%Cesspool%';
UPDATE files SET size = 4283 WHERE filename = 'DMSEED4K.ZIP';
UPDATE files SET size = 25869 WHERE filename = 'DMSEED40.ZIP';
