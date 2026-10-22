-- The 716 List: a Logan's List-style board list (replaces the old joke BBSLIST.TXT).
DELETE FROM files WHERE filename = 'BBSLIST.TXT' AND content IS NOT NULL;
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, content, ctype) VALUES (3, '716LIST.TXT', 'The 716 List: boards worth calling (Oct 2026)', 3061, 'SysOp', 1792629021125, 'approved', 1, '===============================================================================
       T H E   7 1 6   L I S T   ::   boards worth calling, updated monthly
     in the tradition of Logan''s List, which was on every board in Rochester
===============================================================================
 Compiled by the SysOp of The Septic Tankz.  Last update: October 2026.
 Want your board on the list, or one''s gone dead?  Leave the SysOp a comment.

 KEY:  Nodes = how many callers at once.  "telnet" = no modem needed, point a
       telnet client (SyncTERM, NetRunner, or plain telnet) at the address.

-------------------------------------------------------------------------------
 WESTERN NEW YORK (716 / 585)
-------------------------------------------------------------------------------
 THE SEPTIC TANKZ ......................................... 1-716-555-2455
   Speeds: 300 to 56k, or Ethernet.   Nodes: 1 (or 2 when the SysOp feels
   fancy).   Software: homegrown.   Messages, files with ratios (1:5 main),
   door games: Usurper, Red Drain, Trade Wipes 2002, Zork, Colossal Cave.
   Elite side if you know where to knock.   Validation required.
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
 LISTED BUT NOT RECOMMENDED
-------------------------------------------------------------------------------
 THE GREASE TRAP .......................... private, 2400 baud, ask around
 MOM''S HOUSE .............................. NOT A BBS.  Stop calling it.
===============================================================================
', 'text/plain');
