-- Era files: tools of the trade, ANSI art packs and pieces (16colo.rs), classic demos (scene.org)
-- and BBS-culture t-files (textfiles.com). All linked: ext_url points at the official source and the
-- board streams it through /dl/ (and the on-line viewer fetches it for text and ANSI).
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, content, ctype) VALUES (1, 'TOOLS.NFO', 'READ ME: modern tools for old-school computing', 1878, 'SysOp', 1792630732579, 'approved', 1, '==============================================================================
        T H E   S E P T I C   T A N K Z   ::   T O O L S   O F   T H E
                  T R A D E   (rebuilt for modern Macs and PCs)
==============================================================================

 All free, all open source or freeware, all straight from their makers.
 None of them cost you ratio. Grab the one for your machine.

 SYNCTERM  (SYNCTRM-WIN.ZIP / SYNCTRM-MAC.ZIP)
   A real BBS terminal, from the folks behind Synchronet. Telnet to the
   boards that are still answering (see 716LIST.TXT in Text Files) and get
   proper ANSI, CP437 and even modem-speed emulation. The closest thing to
   your old Telix or QModem.

 DOSBOX STAGING  (DOSBOX-WIN.ZIP / DOSBOX-MAC.DMG)
   A PC from 1993 in a window. Runs the demos in DEMOS.NFO, the old DOS
   shareware you still have on floppies, and anything else that wants a
   Sound Blaster and 640K. GNU GPL.

 MOEBIUS  (MOEBIUS-WIN.EXE / MOEBIUS-MAC.DMG)
   A modern ANSI editor from Blocktronics: draw in CP437 blocks with the
   16 colors, half-blocks and all, and save real .ANS files. Draw yourself
   a logo and upload it.

 PABLODRAW  (PABLODRW-WIN.MSI / PABLODRW-MAC.DMG)
   The other great ANSI editor, by Curtis Wensley. Draws ANSI, ASCII and
   RIPscrip, opens almost every art format from the era, and lets several
   artists draw on one canvas at once, like the old joint pieces. MIT
   license.

 WHAT GOES WITH WHAT
   Art packs in ANSI & Graphics .... view on-line here, or open in Moebius
                                     or PabloDraw
   Demos in Miscellaneous .......... DOSBox Staging (see DEMOS.NFO)
   Calling other boards ............ SyncTERM + 716LIST.TXT

 MAC USERS: the first time, right-click the app and choose Open.
==============================================================================
', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (1, 'SYNCTRM-WIN.ZIP', 'SyncTERM: call real BBSes, for Windows', 7922503, 'SysOp', 1792630722578, 'approved', 1, 'https://syncterm.bbsdev.net/syncterm64.zip', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (1, 'SYNCTRM-MAC.ZIP', 'SyncTERM: call real BBSes, for Mac', 10741799, 'SysOp', 1792630722577, 'approved', 1, 'https://syncterm.bbsdev.net/SyncTERM-macOS-fat.zip', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (1, 'DOSBOX-WIN.ZIP', 'DOSBox Staging 0.83 for Windows: a DOS PC (GPL)', 37986031, 'SysOp', 1792630722576, 'approved', 1, 'https://github.com/dosbox-staging/dosbox-staging/releases/download/v0.83.0/dosbox-staging-windows-x64-v0.83.0.zip', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (1, 'DOSBOX-MAC.DMG', 'DOSBox Staging 0.83 for Mac: a DOS PC (GPL)', 44531761, 'SysOp', 1792630722575, 'approved', 1, 'https://github.com/dosbox-staging/dosbox-staging/releases/download/v0.83.0/dosbox-staging-macOS-v0.83.0.dmg', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (1, 'MOEBIUS-WIN.EXE', 'Moebius 1.0.29 ANSI editor for Windows', 90978965, 'SysOp', 1792630722574, 'approved', 1, 'https://github.com/blocktronics/moebius/releases/download/1.0.29/Moebius.exe', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (1, 'MOEBIUS-MAC.DMG', 'Moebius 1.0.29 ANSI editor for Mac', 68337115, 'SysOp', 1792630722573, 'approved', 1, 'https://github.com/blocktronics/moebius/releases/download/1.0.29/Moebius.dmg', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (1, 'PABLODRW-WIN.MSI', 'PabloDraw 3.3 ANSI/RIP editor, Windows (MIT)', 64172032, 'SysOp', 1792630722572, 'approved', 1, 'https://github.com/cwensley/pablodraw/releases/download/3.3.14-beta/PabloDraw-win-x64.msi', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (1, 'PABLODRW-MAC.DMG', 'PabloDraw 3.3 ANSI/RIP editor, Mac (MIT)', 24689858, 'SysOp', 1792630722571, 'approved', 1, 'https://github.com/cwensley/pablodraw/releases/download/3.3.14-beta/PabloDraw-mac-universal.dmg', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, content, ctype) VALUES (4, 'ANSI.NFO', 'READ ME: the ANSI art scene and where this is from', 1215, 'SysOp', 1792630732570, 'approved', 1, '==============================================================================
         A N S I   &   G R A P H I C S   ::   from the art scene
==============================================================================

 In the early ''90s, ANSI art groups like ACiD (ANSI Creators in Demand),
 iCE (Insane Creators Enterprise) and Fire released monthly "art packs":
 zips full of logos, login screens and big scrolling pieces, drawn one
 character at a time in 16 colors. Every elite board wanted its own ACiD
 login screen. The packs spread from board to board on their own; that was
 the point.

 The ART PACKS here are the original zips, exactly as released, and the
 single pieces can be viewed right here on-line: pick one and hit V. Each
 description names the piece, the artist and the group.

 Everything is linked from 16colo.rs, the archive that has kept nearly
 every pack from 1990 on. Go browse it. You''ll lose an evening.

 The art belongs to the artists. It''s here because they made it to be
 spread around, the same way it was on the boards.

 Want to draw your own? Moebius and PabloDraw are in the Utilities area.
==============================================================================
', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'ACDU0794.ZIP', 'ACiD Productions pack, 07/1994', 1226323, 'SysOp', 1792630722569, 'approved', 1, 'https://16colo.rs/archive/1994/acdu0794.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'ICE-9412.ZIP', 'iCE pack, 12/1994', 1000749, 'SysOp', 1792630722568, 'approved', 1, 'https://16colo.rs/archive/1994/ice-9412.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'ICE-9506.ZIP', 'iCE pack, 06/1995', 1255919, 'SysOp', 1792630722567, 'approved', 1, 'https://16colo.rs/archive/1995/ice-9506.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'ACDU0895.ZIP', 'ACiD Productions pack, 08/1995', 1732253, 'SysOp', 1792630722566, 'approved', 1, 'https://16colo.rs/archive/1995/acdu0895.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'ACID-50A.ZIP', 'ACiD Productions pack #50, 1996', 1290421, 'SysOp', 1792630722565, 'approved', 1, 'https://16colo.rs/archive/1996/acid-50a.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'FIRE0796.ZIP', 'Fire pack, 07/1996', 938076, 'SysOp', 1792630722564, 'approved', 1, 'https://16colo.rs/archive/1996/fire0796.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'BK-DI.ANS', 'The Darkest Illusion - Bad Karma (ACiD ''94)', 23609, 'SysOp', 1792630722563, 'approved', 1, 'https://16colo.rs/pack/acdu0794/raw/BK-DI.ANS', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'SX-CH01.ANS', 'Channel Zer0 - Sushi X (ACiD ''94)', 15049, 'SysOp', 1792630722562, 'approved', 1, 'https://16colo.rs/pack/acdu0794/raw/SX-CH01.ANS', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'CL-HUMA.ANS', 'Huma - Crime Lord (ACiD ''95)', 36684, 'SysOp', 1792630722561, 'approved', 1, 'https://16colo.rs/pack/acdu0895/raw/CL-HUMA.ANS', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'LD-FS1.ANS', 'Freak Scene - Lord Jazz (ACiD ''95)', 57243, 'SysOp', 1792630722560, 'approved', 1, 'https://16colo.rs/pack/acdu0895/raw/LD-FS1.ANS', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'P1-WNC.ANS', 'Wind Ninja Chronicles - prisonernumberone', 39470, 'SysOp', 1792630722559, 'approved', 1, 'https://16colo.rs/pack/acdu0895/raw/P1-WNC.ANS', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'TR-RUST.ANS', 'Rust - Tripe (ACiD ''95)', 40875, 'SysOp', 1792630722558, 'approved', 1, 'https://16colo.rs/pack/acdu0895/raw/TR-RUST.ANS', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'KM-FIFTY.ANS', 'Fifty to Infinity - King Midas (ACiD ''96)', 29378, 'SysOp', 1792630722557, 'approved', 1, 'https://16colo.rs/pack/acid-50a/raw/KM-FIFTY.ANS', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'LD-TNW1.ANS', 'The Never World - Lord Jazz (ACiD ''96)', 24330, 'SysOp', 1792630722556, 'approved', 1, 'https://16colo.rs/pack/acid-50a/raw/LD-TNW1.ANS', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'SE-JELLO.ANS', 'Jellomite - Sensei (ACiD ''96)', 48524, 'SysOp', 1792630722555, 'approved', 1, 'https://16colo.rs/pack/acid-50a/raw/SE-JELLO.ANS', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'PH-MOOSE.ANS', 'Moose City - Pharcyde (ACiD ''96)', 26029, 'SysOp', 1792630722554, 'approved', 1, 'https://16colo.rs/pack/acid-50a/raw/PH-MOOSE.ANS', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'HAL-CYTO.ANS', 'Cybertopia - Halaster (Fire ''96)', 21179, 'SysOp', 1792630722553, 'approved', 1, 'https://16colo.rs/pack/fire0796/raw/HAL-CYTO.ANS', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'TE-APOC1.ANS', 'Apocalypse - The Extremist (Fire ''96)', 40336, 'SysOp', 1792630722552, 'approved', 1, 'https://16colo.rs/pack/fire0796/raw/TE-APOC1.ANS', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'CC-TCI2.ANS', 'The Castle of Illusion - CybeR ChrisT (iCE ''95)', 11411, 'SysOp', 1792630722551, 'approved', 1, 'https://16colo.rs/pack/ice-9506/raw/CC-TCI2.ICE', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (4, 'IM-SHRN1.ANS', 'The Shrine - Image (iCE ''95)', 27926, 'SysOp', 1792630722550, 'approved', 1, 'https://16colo.rs/pack/ice-9506/raw/IM-SHRN1.ICE', 'application/octet-stream');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, content, ctype) VALUES (15, 'DEMOS.NFO', 'READ ME: the demos and how to run them in DOSBox', 1759, 'SysOp', 1792630732549, 'approved', 1, '==============================================================================
              D E M O S   ::   the PC demoscene, 1992 - 1995
==============================================================================

 Demos were real-time music videos made by teenagers in Finland, Norway,
 Sweden and everywhere else, showing off what a 386 or 486 could do in
 code. Groups competed at parties like Assembly and The Party, then
 released them for free, and boards carried them everywhere.

 SECOND REALITY ...... Future Crew, Assembly ''93. THE demo.
 UNREAL .............. Future Crew, 1992.
 CRYSTAL DREAM 2 ..... Triton, 1993.
 HEARTQUAKE .......... Iguana, Assembly ''94.
 VERSES .............. EMF, Assembly ''94.
 STARS ............... NoooN, "Stars: Wonders of the World", 1995.
 DOPE ................ Complex, 1995.
 JUICE ............... Psychic Link, 1995.

 HOW TO WATCH THEM (DOSBox Staging is in Utilities)
   1. Make a folder, say  demos , and unzip each demo into its own
      folder inside it.
   2. Start DOSBox Staging and type:
         mount c ~/demos        (Windows: mount c C:\demos)
         c:
         cd 2nd_real            (whatever the folder is called)
         dir                    (find the .EXE)
         second                 (run it)
   3. Most of these want a Gravis Ultrasound or a Sound Blaster. DOSBox
      Staging emulates both; when a demo asks, pick GUS (port 240, IRQ 5,
      DMA 3) or Sound Blaster (port 220, IRQ 7, DMA 1). If it stutters,
      press Ctrl+F12 a few times to give it more speed.

 Every demo is linked from scene.org, the scene''s own archive, exactly as
 the groups released them. Credits stay with the groups.
==============================================================================
', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (15, '2NDREAL.ZIP', 'Second Reality, Future Crew (Assembly ''93)', 2122910, 'SysOp', 1792630722548, 'approved', 1, 'https://files.scene.org/get/parties/1993/assembly93/demo/2nd_real.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (15, 'UNREAL.ZIP', 'Unreal 1.1, Future Crew (1992)', 1337312, 'SysOp', 1792630722547, 'approved', 1, 'https://files.scene.org/get/demos/groups/future_crew/demos/unreal11.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (15, 'CD2.ZIP', 'Crystal Dream 2, Triton (1993)', 2074898, 'SysOp', 1792630722546, 'approved', 1, 'https://files.scene.org/get/demos/groups/triton/cd2-trn.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (15, 'HEARTQ.ZIP', 'HeartQuake, Iguana (Assembly ''94)', 1946860, 'SysOp', 1792630722545, 'approved', 1, 'https://files.scene.org/get/parties/1994/assembly94/demo/heartq.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (15, 'VERSES.ZIP', 'Verses, EMF (Assembly ''94)', 509344, 'SysOp', 1792630722544, 'approved', 1, 'https://files.scene.org/get/parties/1994/assembly94/demo/emf_vrs2.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (15, 'STARS.ZIP', 'Stars: Wonders of the World, NoooN (1995)', 1164723, 'SysOp', 1792630722543, 'approved', 1, 'https://files.scene.org/get/demos/groups/nooon/nooonstf.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (15, 'DOPE.ZIP', 'Dope, Complex (1995)', 910933, 'SysOp', 1792630722542, 'approved', 1, 'https://files.scene.org/get/demos/groups/complex/clx_dope.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (15, 'JUICE.ZIP', 'Juice, Psychic Link (1995)', 868789, 'SysOp', 1792630722541, 'approved', 1, 'https://files.scene.org/get/mirrors/hornet/demos/1995/j/juice11.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, content, ctype) VALUES (6, 'DEMOS.NFO', 'READ ME: PC demos and how to run them in DOSBox', 1759, 'SysOp', 1792630732540, 'approved', 1, '==============================================================================
              D E M O S   ::   the PC demoscene, 1992 - 1995
==============================================================================

 Demos were real-time music videos made by teenagers in Finland, Norway,
 Sweden and everywhere else, showing off what a 386 or 486 could do in
 code. Groups competed at parties like Assembly and The Party, then
 released them for free, and boards carried them everywhere.

 SECOND REALITY ...... Future Crew, Assembly ''93. THE demo.
 UNREAL .............. Future Crew, 1992.
 CRYSTAL DREAM 2 ..... Triton, 1993.
 HEARTQUAKE .......... Iguana, Assembly ''94.
 VERSES .............. EMF, Assembly ''94.
 STARS ............... NoooN, "Stars: Wonders of the World", 1995.
 DOPE ................ Complex, 1995.
 JUICE ............... Psychic Link, 1995.

 HOW TO WATCH THEM (DOSBox Staging is in Utilities)
   1. Make a folder, say  demos , and unzip each demo into its own
      folder inside it.
   2. Start DOSBox Staging and type:
         mount c ~/demos        (Windows: mount c C:\demos)
         c:
         cd 2nd_real            (whatever the folder is called)
         dir                    (find the .EXE)
         second                 (run it)
   3. Most of these want a Gravis Ultrasound or a Sound Blaster. DOSBox
      Staging emulates both; when a demo asks, pick GUS (port 240, IRQ 5,
      DMA 3) or Sound Blaster (port 220, IRQ 7, DMA 1). If it stutters,
      press Ctrl+F12 a few times to give it more speed.

 Every demo is linked from scene.org, the scene''s own archive, exactly as
 the groups released them. Credits stay with the groups.
==============================================================================
', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (6, '2NDREAL.ZIP', 'Second Reality, Future Crew (Assembly ''93)', 2122910, 'SysOp', 1792630722539, 'approved', 1, 'https://files.scene.org/get/parties/1993/assembly93/demo/2nd_real.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (6, 'UNREAL.ZIP', 'Unreal 1.1, Future Crew (1992)', 1337312, 'SysOp', 1792630722538, 'approved', 1, 'https://files.scene.org/get/demos/groups/future_crew/demos/unreal11.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (6, 'CD2.ZIP', 'Crystal Dream 2, Triton (1993)', 2074898, 'SysOp', 1792630722537, 'approved', 1, 'https://files.scene.org/get/demos/groups/triton/cd2-trn.zip', 'application/zip');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, content, ctype) VALUES (3, 'TFILES.NFO', 'READ ME: classic BBS-culture t-files', 1176, 'SysOp', 1792630732536, 'approved', 1, '==============================================================================
         T - F I L E S   ::   BBS culture, straight off the boards
==============================================================================

 Before the web, people wrote text files and passed them from board to
 board: rules, rants, guides, jokes. These are a few classics about BBS
 life itself, as they were written (typos and all).

   12COMMND.TXT .... The Twelve Commandments of BBS Users
   30COMMND.ASC .... The 30 Commandments of BBSing
   BBSMNRS.TXT ..... Some Hints on General BBS Etiquette
   DLJUNKIE.TXT .... Confessions of a Download Junkie
   BBSPEAK.TXT ..... BBS Speak: the abbreviations (some are rude)
   BAUD-BPS.TXT .... Baud is Not Equal to BPS (1990)
   AT-CMDS.TXT ..... A Rundown of the Hayes AT Command Set
   CBBSBRTH.TXT .... Ward Christensen on how the first BBS came to be
   BBSHIST.TXT ..... The History of BBSes, by Thomas (a rant)

 All of them come from textfiles.com, Jason Scott''s archive of thousands
 of these files from the 1980s and ''90s. The credits are in each file.
==============================================================================
', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (3, '12COMMND.TXT', 'The Twelve Commandments of BBS Users', 1152, 'SysOp', 1792630722535, 'approved', 1, 'http://www.textfiles.com/bbs/12budord.txt', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (3, '30COMMND.ASC', 'The 30 Commandments of BBSing', 3310, 'SysOp', 1792630722534, 'approved', 1, 'http://www.textfiles.com/bbs/bbs30.asc', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (3, 'BBSMNRS.TXT', 'Some Hints on General BBS Etiquette', 8704, 'SysOp', 1792630722533, 'approved', 1, 'http://www.textfiles.com/bbs/bbs_mnrs.txt', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (3, 'DLJUNKIE.TXT', 'Confessions of a Download Junkie', 3257, 'SysOp', 1792630722532, 'approved', 1, 'http://www.textfiles.com/bbs/dljunkie.txt', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (3, 'BBSPEAK.TXT', 'BBS Speak: the abbreviations (some rude)', 4121, 'SysOp', 1792630722531, 'approved', 1, 'http://www.textfiles.com/bbs/bbspeak.txt', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (3, 'BAUD-BPS.TXT', 'Baud is Not Equal to BPS (1990)', 4428, 'SysOp', 1792630722530, 'approved', 1, 'http://www.textfiles.com/bbs/baud-bps.txt', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (3, 'AT-CMDS.TXT', 'A Rundown of the Hayes AT Command Set', 9693, 'SysOp', 1792630722529, 'approved', 1, 'http://www.textfiles.com/bbs/at_set.txt', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (3, 'CBBSBRTH.TXT', 'Ward Christensen: how CBBS, the first BBS, began', 3428, 'SysOp', 1792630722528, 'approved', 1, 'http://www.textfiles.com/bbs/cbbsbrth.msg', 'text/plain');
INSERT INTO files (area_id, filename, descr, size, uploader, uploaded_at, status, free, ext_url, ctype) VALUES (3, 'BBSHIST.TXT', 'The History of BBSes, by Thomas (a rant)', 5665, 'SysOp', 1792630722527, 'approved', 1, 'http://www.textfiles.com/bbs/bbshist.txt', 'text/plain');
