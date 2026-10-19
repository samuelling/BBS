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
- Message bases: General Chat, Tech & Modems, For Sale / Wanted, Games & Doors, SysOp Feedback
- File areas: Utilities, Games, Text Files, ANSI & Graphics, Music, Miscellaneous
- Private e-mail between users, a one-liner wall, last callers, who's online, user list
- Bulletins and a door game, *Escape the Tank*
- Text, NFO and ANSI files can be read on-line for free, and ANSI art renders in color

**The Cesspool**
- Reached by typing the secret handle and password at the normal login prompt,
  then logging in with an account that has Cesspool access
- Users without access can apply. Applications land in the SysOp console.
- Separate file areas, message bases, last callers and a Top Couriers chart

**Ratios**
- New users start with 2,048K of main-board credit
- Main board: every byte uploaded earns 5 bytes of download credit (1:5)
- The Cesspool: 1:3 and no starting credit
- Credit is granted when the SysOp validates an upload, not before
- The SysOp can mark files FREE; downloading those costs nothing

**SysOp console** (`[!]` on the menus, SysOp only)
- Validate uploads: approve, approve as free, reject, or download to inspect first
- Approve or deny Cesspool applications (the applicant gets an e-mail)
- Users: grant or revoke Cesspool access, ban, adjust credit
- Change the secret entry handle and password
- Kick a caller off a line

The first account ever created becomes the SysOp. Call in and make yours
right after the first deploy.

## How it's built

| Piece | What it is |
| --- | --- |
| `worker/index.js` | The board server, a Cloudflare Worker. Enforces lines, accounts, ratios and validation. |
| `migrations/` | D1 (SQLite) schema and seed data: areas, bases, built-in text files |
| `web/` | The terminal page: `shell.html` (markup and CSS) and `app.js` |
| `build.py` | Generates the ASCII art and builds `public/index.html` (served by the Worker) and `index.html` (GitHub Pages copy) |
| `wrangler.jsonc` | Worker config and board settings |
| `.github/workflows/deploy.yml` | Deploys to Cloudflare on every push to `main` |

Files live in an R2 bucket, everything else in a D1 database.

## Setting it up on Cloudflare

You need a free Cloudflare account. Then:

1. **Turn on Workers and R2.** In the Cloudflare dashboard, open *Workers & Pages* once
   so the account gets a `workers.dev` subdomain. Then open *R2 Object Storage* and
   enable it. R2 is free up to 10 GB of storage, but Cloudflare may ask for a payment
   method to switch it on.
2. **Make an API token.** *My Profile → API Tokens → Create Token*, start from the
   **Edit Cloudflare Workers** template, and add one more permission:
   *Account → D1 → Edit*. Create it and copy the token.
3. **Find your account ID.** It's on the right side of the Workers & Pages overview page.
4. **Add two repository secrets** in GitHub: *Settings → Secrets and variables → Actions →
   New repository secret*:
   - `CLOUDFLARE_API_TOKEN` — the token from step 2
   - `CLOUDFLARE_ACCOUNT_ID` — the ID from step 3
5. **Deploy.** *Actions → Deploy board → Run workflow*. The run summary shows the
   board's address, `https://septic-tankz.<your-subdomain>.workers.dev`.
6. **Claim the SysOp account.** Dial in and create the first account.
7. **Change the secret entry.** The default (`FLUSH` / `BACKFLOW`) is in this public
   repo. Change it from the SysOp console under *Secret entry*.

After that, every push to `main` redeploys automatically.

To make the GitHub Pages copy (`samuelling.github.io/BBS`) talk to the board,
put the Worker's address in `bbs.config.json` as `api_base` and run `python3 build.py`.

## Settings

In `wrangler.jsonc` under `vars`:

| Setting | Default | What it does |
| --- | --- | --- |
| `PHONE_LINES` | 1 | Callers allowed on at once (max 16) |
| `TIME_LIMIT_MIN` | 60 | Minutes per call |
| `MAX_UPLOAD_MB` | 50 | Largest single upload (Cloudflare's free plan caps requests at 100 MB) |
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
