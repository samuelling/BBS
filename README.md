# The Septic Tankz

A virtual dial-up BBS. You dial in through a fake modem (DTMF tones, ringing,
handshake screech), and the board has a limited number of phone lines: while a
caller is connected, everyone else gets a busy signal.

- **Mainstream side:** message bases, one-liner wall, last callers, bulletins,
  shareware file areas, and a door game (*Escape the Tank*, a text adventure).
- **Elite side:** log in with the secret handle and password (see the config
  block at the top of the script) to reach **The Cesspool**, a parody 90s warez
  board with 0-day listings, NFOs, t-files, affils, couriers, and a 1:3 ratio.

## Files

- `index.html` — the built page (open it, or serve it with GitHub Pages)
- `template.html` — page source; `ART` is injected at build time
- `build.py` — generates the ASCII logos (pyfiglet) and art, writes `index.html`

```
pip install pyfiglet
python3 build.py
```

## Config

At the top of the script in `template.html`:

| Setting | What it does |
| --- | --- |
| `PHONE_LINES` | How many callers can be connected at once |
| `SECRET_HANDLE` / `SECRET_PASS` | The login that opens the elite side |
| `TIME_LIMIT_MIN` / `IDLE_LIMIT_MIN` | Per-call time cap and idle hang-up |
| `CPS` | Text speed (1440 ≈ 14.4k) |

## Where the shared parts work

The busy signal, Who's Online, message bases, one-liners and last callers need
a shared backend. In the Claude-hosted version they run on the artifact's
`room` (live presence) and `db` (shared storage) capabilities. A plain copy
(this repo on GitHub Pages, or the file opened locally) runs as a **local
node**: everything works, but you're always the only caller and posts aren't
shared.
