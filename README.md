# The Septic Tankz

A real dial-up style BBS that runs in the browser. Callers dial in through a
virtual modem, make an account, post in message bases, send each other e-mail,
and trade files under an upload/download ratio. There are only a few phone
lines (one by default): while they're all in use, everyone else gets a busy
signal.

Behind a secret login sits **The Cesspool**, an elite side with its own file
areas, message bases and a stricter ratio. Only users the SysOp lets in can get
past its door.

## What's on the board

**Main board**
- Message bases: General Chat, Tech & Modems, For Sale / Wanted, Games & Doors, SysOp Feedback, megaZINE Submissions
- **megaZINE Submissions** is how outsiders get work into [megaZINE](https://megazine.org/): once the SysOp validates their account, they post one message per piece using the template in the base's first post. Each new submission notifies the SysOp right away (Slack/Telegram).
- File areas: Utilities, Games, Text Files, ANSI & Graphics, Music, Miscellaneous
- Private e-mail between users, a one-liner wall, last callers, who's online, user list
- **Q-Slodem 4.51**, the board's own QModem-style terminal program: a blue startup screen with an
  "unregistered evaluation copy" nag, then a dialing directory with a highlight bar.
- **Full screen**: the FULL button or Alt+Enter, like a DOS box. On iPhone, Share → Add to Home Screen
  opens the board with no browser chrome at all.
- **Modems from 300 baud to 56k, or Ethernet.** Pick one with `[S]` on the dialing screen. Each has its own
  handshake song and `CONNECT` string, and screens and transfer meters run at that speed (tap to fast-forward).
  Ethernet skips the modem and connects like telnet. The choice is remembered per browser.
- Bulletins and a whole wall of door games (see below)
- **Teleconference**: a live group chat room for everyone online (the Cesspool has its own)
- **Page the SysOp**: callers page you, your status bar flashes and beeps, and you answer into a live one-on-one chat
- Text, NFO and ANSI files can be read on-line for free, and ANSI art renders in color
- Free disk space shows at login, like a real board

**The Cesspool**
- Reached by typing the secret handle and password at the normal login prompt,
  then logging in with an account that has Cesspool access
- Users without access can apply. Applications land in the SysOp console.
- Separate file areas, message bases, last callers and a Top Couriers chart

**Ratios**
- New users get 2,048K of main-board credit once the SysOp validates them
- Main board: every byte uploaded earns 5 bytes of download credit (1:5)
- The Cesspool: 1:3 and no starting credit
- Credit is granted when the SysOp validates an upload, not before
- The SysOp can mark files FREE; downloading those costs nothing

**SysOp console** (`[!]` on the menus, SysOp only)
- Validate new users: read their sign-up answers, then validate (full access plus starting credit) or delete
- Validate uploads: approve, approve as free, reject, or download to inspect first
- Approve or deny Cesspool applications (the applicant gets an e-mail)
- Users: grant or revoke Cesspool access, ban, adjust credit
- Change the secret entry handle and password
- Kick a caller off a line
- Phone lines: run a 1- to 8-line board. Callers who find line 1 busy roll over to the next free line
- Notify me: posts to a Slack channel (incoming webhook) and/or a Telegram bot when new users,
  uploads or Cesspool applications are waiting (the first right away, the rest bundled at most hourly
  by a 15-minute cron), and when a caller pages while you're off the board. The console walks you
  through making the Slack webhook or the Telegram bot.

**Stats dashboard.** `/sysop` on the board's address (for example
`https://bbs.samuelling.workers.dev/sysop/`) is a modern dashboard for the SysOp:
calls and busy signals per day, when people call (weekday × hour), transfer volume,
modem mix, community activity, top downloads, callers and uploaders, storage, and
what's waiting for you. Sign in with the SysOp handle and password; the session lasts
12 hours in that browser tab. Usage is logged from the moment this shipped, and
entries older than about 400 days are pruned.

**Local console.** On the dialing directory, `[L]` logs the SysOp in at the board
itself. It doesn't use a phone line and has no time or idle limit, so you can sit
there waiting for pages while callers dial in. It shows up as `LCL` in Who's Online.

The first account ever created becomes the SysOp. Call in and make yours
right after the first deploy.

## Door games

`[D]` on the main menu. Each door is one file in `web/doors/`; the shared worlds also
have a module in `worker/doors/` and their own tables.

**Shared worlds.** One world everyone plays, a few turns a day, with attacks on players
who are offline and a daily news page. They open once the SysOp validates you. All rules
and dice run on the board's server.

| Door | What it is |
| --- | --- |
| Usurper | The real Usurper, converted from Jakob Dangarden's GPL Pascal source (see below) |
| Legend of the Red Drain | Original LORD-style RPG: Leach Field fights, 12 masters, the Red Drain Dragon |
| Trade Wipes 2002 | Original TradeWars-style space trading: 300 sectors, haggling, fighters, planets |
| Barren Drains Elite | Original BRE-style empire game: build, recruit, attack, spy, sign pacts |

**Classic adventures, the real games.**
- **Zork I, II and III** run Infocom's original story files on the board's own Z-machine
  interpreter (`web/doors/zmachine.js`). The source and story files were released by
  Microsoft under the MIT License in 2025 (github.com/historicalsource). Zork is a
  trademark of its owner; it's named here to identify the games.
- **Colossal Cave Adventure** is Eric S. Raymond's Open Adventure (BSD-2-Clause), the
  faithful C version of Will Crowther and Don Woods's game, compiled to WebAssembly.
  `scripts/build_advent.sh` rebuilds it.
- SAVE and RESTORE (RESUME in Colossal Cave) keep one saved game per caller on the board.

**BASIC classics**, new code following the 1970s rules: Hunt the Wumpus (after Gregory
Yob), Deep Space Patrol (after Mike Mayfield's 1971 Star Trek), Hammurabi (after Doug
Dyment and David Ahl) and Lunar Lander (Jim Storer's 1969 physics). High scores are kept
per caller (`[H]` on the door menu).

**Usurper** is converted from the original Pascal source (github.com/rickparrish/Usurper):
USURPER (c) 1993-2009 Jakob Dangarden, ported by Rick Parrish, bug fixes by Dan Zingaro.
It's free software under the GNU GPL v2 or later. The core game is here (Main Street,
dungeons 1-100 with Usurper's own 1,001 monsters and item tables, shops, inn, dormitory,
bank, Level Masters, player fights, news and mail); `docs/USURPER.md` says what came
from which source file and what's left to port (gangs, the castle and king, gods...).

License texts for the bundled games are in `public/doors/`.

## License

Because the board bundles Usurper, the board is distributed under the GNU GPL v2 or later
(`COPYING`). Zork (MIT) and Open Adventure (BSD-2-Clause) keep their own licenses, which
are compatible.

## Flood protection

- Every API call: an approximate per-address limit (Cloudflare rate-limit binding: 240 a minute,
  uploads 6 a minute).
- Dialing: busy signals are free, so auto-redial never trips anything. 30 connects per 10 minutes
  per address, and one address holds at most 2 lines (a third call drops its oldest), so nobody can
  tie up every line.
- Logins: 3 bad passwords and the board hangs up; 10 bad passwords in 15 minutes locks out that
  address, and 10 against one account locks that account, for 15 minutes. The local console login
  counts too.
- Sign-ups: 3 per address per day, 15 per hour board-wide, and closed while 25 new users are
  already waiting for validation. No account is created sooner than 15 seconds after the call
  connects (people never notice; scripts slow to a crawl). Accounts the SysOp never validates are
  flushed after 14 days, and the new-user queue has a Flush all key for spam waves.
- Uploads: 15 per address per hour, at most 5 files or 100 MB per caller waiting for validation, on
  top of the daily upload allowance and the storage quota.
- Hitting a limit is logged (kind `throttle` in the events table).

## How it's built

| Piece | What it is |
| --- | --- |
| `worker/index.js` | The board server, a Cloudflare Worker. Enforces lines, accounts, ratios and validation. |
| `migrations/` | D1 (SQLite) schema and seed data: areas, bases, built-in text files |
| `web/` | The terminal page: `shell.html` (markup and CSS) and `app.js` |
| `build.py` | Generates the ASCII art and builds `public/index.html` (served by the Worker) and `index.html` (GitHub Pages copy) |
| `wrangler.jsonc` | Worker config and board settings |

Accounts, messages and the file list live in a D1 database. The files themselves
live wherever `FILE_STORE` points (see below).

## Deploying

The repo is connected to Cloudflare Workers Builds (Worker name `bbs`): every push
to `main` applies any new database migrations and redeploys. The build's deploy
command is:

```
npx wrangler d1 migrations apply septic-tankz --remote && npx wrangler deploy
```

The first account ever created becomes the SysOp. The default secret entry
(`FLUSH` / `BACKFLOW`) is visible in this public repo, so change it from the SysOp
console under *Secret entry*.

To make the GitHub Pages copy (`samuelling.github.io/BBS`) talk to the board,
put the Worker's address in `bbs.config.json` as `api_base` and run `python3 build.py`.

## File storage

`FILE_STORE` in `wrangler.jsonc` picks where uploads go. Only the bytes move;
everything else stays in D1, so switching later means copying the files across
and changing one setting.

| `FILE_STORE` | Where | Limits |
| --- | --- | --- |
| `kv` (current) | Workers KV namespace `septic-tankz-files` | Free plan: about 1 GB total, 25 MB per file, ~1,000 uploads a day |
| `r2` | An R2 bucket (uncomment `r2_buckets`) | 10 GB free, then pay as you go. Needs the R2 subscription. 100 MB per file. |
| `http` | Your own file server | Whatever your disk holds. 100 MB per file through Cloudflare. |

**Linked files.** A file row can carry an `ext_url` instead of stored bytes: the board streams it
from that address through its own `/dl/` link, so it looks like any other download and takes no
storage. The Game Pack in the Games area (Tyrian 2000 via OpenTyrian, Freedoom + Woof!, One Must
Fall 2097 via OpenOMF, for Windows and Mac) is linked to each project's official GitHub release.
On a home file server, copy them in and clear `ext_url`.

**Music.** The Music area holds 45 classic tracker modules (MOD, S3M, XM, IT) from the '90s
scene: Purple Motion and Skaven of Future Crew, Necros, Captain, Jester, Jogeir Liljedahl, Elwood
and more, linked from The Mod Archive and credited in MUSIC.NFO. No MIDI on purpose: most BBS-era
MIDI files were unlicensed covers of pop songs.

**Era files.** More linked files, streamed from their official homes:
- Utilities: SyncTERM (call the boards in 716LIST.TXT), DOSBox Staging (runs the demos),
  and the Moebius and PabloDraw ANSI editors, for Windows and Mac. See TOOLS.NFO.
- ANSI & Graphics: six original ACiD, iCE and Fire art packs (1994-96) and 14 single
  pieces you can view on-line, all from 16colo.rs. See ANSI.NFO.
- Demos: eight classic PC demos from scene.org (Second Reality, Unreal, Crystal Dream 2,
  HeartQuake, Verses, Stars, Dope, Juice) in the Cesspool's Demos & Intros, with three of
  them in Miscellaneous. DEMOS.NFO says how to run them in DOSBox.
- Text Files: nine BBS-culture t-files from textfiles.com. See TFILES.NFO.

The on-line viewer emulates an 80-column ANSI screen and shows art in the IBM VGA font
(Web437_IBM_VGA_8x16 from VileR's Ultimate Oldschool PC Font Pack, CC BY-SA 4.0,
public/fonts/).

**Bundled files.** `ext_url` can also be `asset:/files/NAME`, a file shipped with the board in
`public/files/`. The Orders of Magnitude demos (Demoseed 4K and 40K, from samuelling/DemoVoyager)
live there; Big Apple Sam's screen savers link to its GitHub release.

`STORAGE_QUOTA_MB` caps the board's total storage (900 MB by default on KV) so
uploads fail politely with "hard drive is full" instead of hitting a hidden limit.
Callers see the free space at login.

### Your own file server

With `FILE_STORE` set to `http`, the Worker talks to any server that does three
things under `FILE_SERVER_URL`, each with `Authorization: Bearer <FILE_SERVER_TOKEN>`:

- `PUT /<key>` stores the request body
- `GET /<key>` returns it
- `DELETE /<key>` removes it

Set `FILE_SERVER_TOKEN` as an encrypted secret in the Cloudflare dashboard
(Worker → Settings → Variables and Secrets), never in this repo. A home machine can
be exposed safely with a Cloudflare Tunnel, so no ports need opening on your router.

## Settings

In `wrangler.jsonc` under `vars`:

| Setting | Default | What it does |
| --- | --- | --- |
| `PHONE_LINES` | 1 | Starting number of phone lines. After that, set it from the SysOp console (1-8). |
| `TIME_LIMIT_MIN` | 60 | Minutes per call |
| `REQUIRE_VALIDATION` | 1 | New users wait for SysOp validation before they can post, upload or download (0 = instant access) |
| `FILE_STORE` | kv | `kv`, `r2` or `http` (see above) |
| `MAX_UPLOAD_MB` | 25 | Largest single upload (capped by the storage backend) |
| `STORAGE_QUOTA_MB` | 900 | Board-wide storage cap (0 = none) |
| `DAILY_UPLOAD_MB` | 200 | Per-user upload allowance per 24 hours |
| `MAIN_RATIO` | 5 | Credit earned per byte uploaded on the main board |
| `ELITE_RATIO` | 3 | Credit earned per byte uploaded in the Cesspool |
| `START_CREDIT_KB` | 2048 | Main-board credit for new users |

## Running it locally

```
npm install
pip install pyfiglet
python3 build.py
npx wrangler d1 migrations apply septic-tankz --local
npx wrangler dev
```

Then open http://localhost:8787.

## Hosting responsibility

The board stores whatever users upload, on your Cloudflare account. That's why
nothing goes live until the SysOp approves it: reject anything you don't want
to host, including malware and files people don't have the right to share.
