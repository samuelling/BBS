// The Septic Tankz — board server (Cloudflare Worker + D1, files in KV / R2 / your own server)
//
// Every caller holds a "phone line": a row in the `line` table with a random
// token and a heartbeat. No line, no service. Accounts, ratios, uploads and the
// validation queue are all enforced here, never in the browser.

import { doorRoute } from "./doors/index.js";

const BEAT_MS = 75_000;          // a line is dropped this long after its last heartbeat
const TICKET_MS = 10 * 60_000;   // download links last 10 minutes
const TEXT_EXT = /\.(txt|nfo|diz|asc|ans|doc|1st|me|faq|lst|bbs)$/i;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-line, x-area, x-filename, x-desc",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-max-age": "86400",
};

class BoardError extends Error {
  constructor(message, status = 400, extra = {}) { super(message); this.status = status; this.extra = extra; }
}
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...CORS } });

const MAX_LINES = 8;   // an 8-line board was serious business

const STORE_CAP_MB = { kv: 25, r2: 100, http: 100 };   // largest single file each backend takes

function settings(env) {
  const n = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);
  const store = storeKind(env);
  return {
    store,
    quota: n(env.STORAGE_QUOTA_MB, store === "kv" ? 900 : 0) * 1048576,   // 0 = no board-wide limit
    board: env.BOARD_NAME || "The Septic Tankz",
    lines: Math.min(MAX_LINES, n(env.PHONE_LINES, 1)),
    timeMin: n(env.TIME_LIMIT_MIN, 60),
    maxUpload: Math.min(n(env.MAX_UPLOAD_MB, 25), STORE_CAP_MB[store]) * 1048576,
    dailyUpload: n(env.DAILY_UPLOAD_MB, 200) * 1048576,
    mainRatio: n(env.MAIN_RATIO, 5),
    eliteRatio: n(env.ELITE_RATIO, 3),
    startCredit: n(env.START_CREDIT_KB, 2048) * 1024,
    requireValidation: String(env.REQUIRE_VALIDATION ?? "1") !== "0",
  };
}

// ---------------------------------------------------------------- file storage
// FILE_STORE picks where uploaded files live:
//   "kv"   Workers KV (binding FILES_KV). Free, about 1 GB, 25 MB per file.
//   "r2"   an R2 bucket (binding FILES).
//   "http" your own file server: PUT / GET / DELETE {FILE_SERVER_URL}/{key},
//          with "Authorization: Bearer {FILE_SERVER_TOKEN}" (set that as a Worker secret).
function storeKind(env) {
  const k = String(env.FILE_STORE || "kv").toLowerCase();
  return STORE_CAP_MB[k] ? k : "kv";
}
function storage(env) {
  const kind = storeKind(env);
  if (kind === "r2") {
    if (!env.FILES) throw new BoardError("The file drive isn't connected (no R2 bucket).", 503);
    return {
      put: (key, body, size, ctype) => env.FILES.put(key, body, { httpMetadata: { contentType: ctype } }),
      stream: async key => { const o = await env.FILES.get(key); return o && o.body; },
      bytes: async key => { const o = await env.FILES.get(key); return o && new Uint8Array(await o.arrayBuffer()); },
      del: key => env.FILES.delete(key),
    };
  }
  if (kind === "http") {
    const base = String(env.FILE_SERVER_URL || "").replace(/\/$/, "");
    if (!base) throw new BoardError("The file drive isn't connected (no FILE_SERVER_URL).", 503);
    const auth = { authorization: "Bearer " + (env.FILE_SERVER_TOKEN || "") };
    const url = key => base + "/" + key.split("/").map(encodeURIComponent).join("/");
    return {
      put: async (key, body, size, ctype) => {
        const r = await fetch(url(key), { method: "PUT", body, headers: { ...auth, "content-type": ctype, "content-length": String(size) } });
        if (!r.ok) throw new Error("file server PUT " + r.status);
      },
      stream: async key => { const r = await fetch(url(key), { headers: auth }); return r.ok ? r.body : null; },
      bytes: async key => { const r = await fetch(url(key), { headers: auth }); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; },
      del: async key => { await fetch(url(key), { method: "DELETE", headers: auth }); },
    };
  }
  if (!env.FILES_KV) throw new BoardError("The file drive isn't connected (no KV namespace).", 503);
  return {
    put: (key, body) => env.FILES_KV.put(key, body),
    stream: key => env.FILES_KV.get(key, { type: "stream" }),
    bytes: async key => { const b = await env.FILES_KV.get(key, { type: "arrayBuffer" }); return b && new Uint8Array(b); },
    del: key => env.FILES_KV.delete(key),
  };
}
async function diskUsed(env) {
  const r = await env.DB.prepare("SELECT COALESCE(SUM(size),0) b FROM files WHERE content IS NULL AND ext_url IS NULL").first();
  return r.b;
}

export default {
  async fetch(req, env, ctx) {
    // Work that can finish after the response (phone notifications) goes through env.later().
    env = { ...env, later: p => ctx.waitUntil(Promise.resolve(p).catch(e => console.error(e))) };
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      if (url.pathname.startsWith("/dl/")) return await serveTicket(env, url.pathname.slice(4));
      if (url.pathname.startsWith("/api/")) {
        if (req.method !== "POST") throw new BoardError("Use POST.", 405);
        const ip = req.headers.get("cf-connecting-ip") || "local";
        const rl = url.pathname === "/api/upload" ? env.RL_UPLOAD : env.RL_API;
        if (rl) {
          const { success } = await rl.limit({ key: ip });
          if (!success) throw new BoardError("Whoa, slow down. The board's modem can't keep up.", 429);
        }
        return await route(url.pathname.slice(5), req, env);
      }
      return env.ASSETS.fetch(req);
    } catch (e) {
      if (e instanceof BoardError) return json({ error: e.message, ...e.extra }, e.status);
      console.error(e && e.stack || e);
      return json({ error: "Line noise. Something broke on the board's end." }, 500);
    }
  },
  // Every 15 minutes: send the SysOp the bundled "things are waiting" notification if one is due.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(notifyFlush(env).catch(e => console.error(e)));
    ctx.waitUntil(sweepThrottle(env).catch(e => console.error(e)));
  },
};

// ---------------------------------------------------------------- SysOp phone notifications (Telegram)
// The SysOp makes a Telegram bot with @BotFather, pastes its token into the SysOp console and
// says hi to it; the board then messages that chat. New users, uploads and Cesspool applications
// are bundled: the first one pings right away, anything else within the hour is rolled into one
// summary that the cron sends when the hour is up. Pages ping right away, but only when the SysOp
// isn't already on the board.
const NOTIFY_GAP = 60 * 60_000;
async function setConfig(env, k, v) {
  await env.DB.prepare("INSERT OR REPLACE INTO config (k, v) VALUES (?, ?)").bind(k, String(v)).run();
}
async function delConfig(env, ...keys) {
  for (const k of keys) await env.DB.prepare("DELETE FROM config WHERE k = ?").bind(k).run();
}
async function tg(env, method, payload, token) {
  token = token || await config(env, "tg_token");
  if (!token) throw new Error("no bot token");
  const base = (await config(env, "tg_api")) || "https://api.telegram.org";   // tg_api is only for local testing
  const r = await fetch(base + "/bot" + token + "/" + method, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload || {}),
    signal: AbortSignal.timeout(6000),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error("Telegram " + r.status + (d.description ? ": " + String(d.description).slice(0, 120) : ""));
  return d.result;
}
const htmlEsc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Slack: an incoming-webhook URL the SysOp pastes in (it posts into the channel picked when making it).
const SLACK_HOOK = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/;
async function slack(env, hook, title, message) {
  const link = await config(env, "board_url");
  const e = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const r = await fetch(hook, {
    method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(6000),
    body: JSON.stringify({ text: "*" + e(title) + "*\n" + e(message) + (link ? "\n<" + link + "|Open the board>" : ""), unfurl_links: false }),
  });
  if (!r.ok) throw new Error("Slack " + r.status + ": " + (await r.text().catch(() => "")).slice(0, 80));
}
const MEGAZINE_BASE = "megaZINE Submissions";
async function notifyOn(env) {
  return !!((await config(env, "slack_hook")) || ((await config(env, "tg_chat")) && (await config(env, "tg_token"))));
}
// Sends to every channel that's set up. Returns how many got it; throws only if all of them failed.
async function notifySend(env, title, message) {
  const sends = [];
  const hook = await config(env, "slack_hook");
  if (hook) sends.push(slack(env, hook, title, message));
  const chat = await config(env, "tg_chat");
  if (chat && (await config(env, "tg_token"))) {
    const link = await config(env, "board_url");
    sends.push(tg(env, "sendMessage", {
      chat_id: chat, parse_mode: "HTML", disable_web_page_preview: true,
      text: "<b>" + htmlEsc(title) + "</b>\n" + htmlEsc(message) + (link ? '\n<a href="' + htmlEsc(link) + '">Open the board</a>' : ""),
    }));
  }
  const res = await Promise.allSettled(sends);
  const ok = res.filter(x => x.status === "fulfilled").length;
  if (sends.length && !ok) throw res[0].reason;
  return ok;
}
async function waitingCounts(env) {
  const r = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) n FROM users WHERE level < ? AND banned = 0").bind(VALIDATED),
    env.DB.prepare("SELECT COUNT(*) n FROM files WHERE status = 'pending'"),
    env.DB.prepare("SELECT COUNT(*) n FROM apps WHERE status = 'open'"),
  ]);
  return { users: r[0].results[0].n, uploads: r[1].results[0].n, apps: r[2].results[0].n };
}
function waitingText(w) {
  const bits = [];
  if (w.users) bits.push(w.users + " new user" + (w.users > 1 ? "s" : ""));
  if (w.uploads) bits.push(w.uploads + " upload" + (w.uploads > 1 ? "s" : ""));
  if (w.apps) bits.push(w.apps + " Cesspool application" + (w.apps > 1 ? "s" : ""));
  return bits.length ? bits.join(", ") + " waiting for you." : "";
}
async function notifySummary(env) {
  const text = waitingText(await waitingCounts(env));
  await setConfig(env, "notify_pending", "0");
  if (!text) return;   // the SysOp already dealt with it
  if (await notifySend(env, "The Septic Tankz", text)) await setConfig(env, "notify_last", now());
}
// Something new landed in a SysOp queue.
async function notifyQueue(env) {
  if (!(await notifyOn(env))) return;
  const last = +(await config(env, "notify_last") || 0);
  if (now() - last < NOTIFY_GAP) return setConfig(env, "notify_pending", "1");
  await notifySummary(env);
}
async function notifyFlush(env) {
  if ((await config(env, "notify_pending")) !== "1") return;
  if (now() - +(await config(env, "notify_last") || 0) < NOTIFY_GAP) return;
  await notifySummary(env);
}

// ---------------------------------------------------------------- flood protection
// Two layers. A cheap, approximate per-address limit on every API call (Cloudflare's rate-limit
// binding, if configured), and exact fixed-window counters in D1 for the things worth hammering:
// signing up, dialing, guessing passwords and uploading.
const LIMITS = {
  dialIp:      { n: 30, win: 10 * 60_000, msg: "Too many calls from your number. Wait a few minutes and try again." },   // connects only
  signupIp:    { n: 3,  win: 24 * 3600_000, msg: "Too many new accounts from your phone number today." },
  signupAll:   { n: 15, win: 3600_000, msg: "Lots of new users this hour. The SysOp's queue needs a breather; try again later." },
  badLoginIp:  { n: 10, win: 15 * 60_000, msg: "Too many bad logins from your number. Wait 15 minutes." },
  badLoginAcct:{ n: 10, win: 15 * 60_000, msg: "That account is locked for 15 minutes after too many bad passwords." },
  uploadIp:    { n: 15, win: 3600_000, msg: "That's a lot of uploads for one hour. Try again later." },
};
const MAX_PENDING_USERS = 25;           // unvalidated accounts waiting on the SysOp, board-wide
const MAX_PENDING_FILES_USER = 5;       // a caller's uploads waiting for validation
const MAX_PENDING_BYTES_USER = 100 * 1048576;
const MAX_LINES_PER_IP = 2;             // a third call from the same address bumps its oldest line

function retryText(ms) { const m = Math.max(1, Math.ceil(ms / 60_000)); return m >= 90 ? Math.ceil(m / 60) + " hours" : m + " minute" + (m > 1 ? "s" : ""); }
// Counts one hit. Throws (429) when the window's limit is passed.
async function hit(env, kind, key, { peek = false } = {}) {
  const L = LIMITS[kind], t = now(), k = kind + ":" + key;
  let row;
  if (peek) row = await env.DB.prepare("SELECT n, reset FROM throttle WHERE k = ? AND reset > ?").bind(k, t).first();
  else row = await env.DB.prepare(
    "INSERT INTO throttle (k, n, reset) VALUES (?1, 1, ?2 + ?3) ON CONFLICT (k) DO UPDATE SET " +
    "n = CASE WHEN reset <= ?2 THEN 1 ELSE n + 1 END, reset = CASE WHEN reset <= ?2 THEN ?2 + ?3 ELSE reset END RETURNING n, reset"
  ).bind(k, t, L.win).first();
  if (!peek && row && row.n === L.n) await logEvent(env, "throttle", { value: row.n, modem: kind.slice(0, 12) });   // once, as the limit is reached
  if (row && (peek ? row.n >= L.n : row.n > L.n)) {
    throw new BoardError(L.msg + (L.win >= 3600_000 ? " (Try again in " + retryText(row.reset - t) + ".)" : ""), 429);
  }
  return row ? row.n : 0;
}
async function sweepThrottle(env) {
  await env.DB.prepare("DELETE FROM throttle WHERE reset < ?").bind(now()).run();
  // New accounts the SysOp never got to are flushed after 14 days, so a spam wave can't sit in the queue forever.
  await env.DB.prepare("DELETE FROM users WHERE level < ? AND banned = 0 AND created_at < ?").bind(VALIDATED, now() - 14 * 86_400_000).run();
}

// ---------------------------------------------------------------- helpers
const now = () => Date.now();
function randomHex(bytes) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return [...a].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function hashPass(pass, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 10000 }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
// Printable text only; keeps newlines when asked.
function clean(v, max, { lines = false } = {}) {
  let s = typeof v === "string" ? v : "";
  s = s.replace(/\r\n?/g, "\n").replace(lines ? /[^\n\x20-\x7e -￿]/g : /[^\x20-\x7e -￿]/g, "");
  s = s.replace(/[{}]/g, "");
  return s.slice(0, max).trim();
}
async function config(env, k) {
  const r = await env.DB.prepare("SELECT v FROM config WHERE k = ?").bind(k).first();
  return r ? r.v : null;
}
// How many phone lines the board has. The SysOp sets it from the console; PHONE_LINES is the default.
async function phoneLines(env) {
  const v = +(await config(env, "phone_lines"));
  return v >= 1 ? Math.min(MAX_LINES, Math.trunc(v)) : settings(env).lines;
}
async function ipHash(env, req) {
  const ip = req.headers.get("cf-connecting-ip") || "local";
  return sha256(ip + "|" + (await config(env, "pepper") || ""));
}
function publicUser(u) {
  return {
    id: u.id, handle: u.handle, location: u.location, level: u.level, sysop: u.level >= 255, validated: u.level >= 10,
    elite: !!u.elite, calls: u.calls, created_at: u.created_at, last_call: u.last_call,
    ul_bytes: u.ul_bytes, ul_files: u.ul_files, dl_bytes: u.dl_bytes, dl_files: u.dl_files,
    credit_main: u.credit_main, credit_elite: u.credit_elite, posts: u.posts,
  };
}

// The caller's line. Refreshes the heartbeat in the same statement.
async function getLine(env, req, activity) {
  const token = req.headers.get("x-line");
  if (!token) throw new BoardError("NO CARRIER", 410, { carrier: false });
  const s = settings(env), t = now();
  const line = await env.DB.prepare(
    "UPDATE line SET beat = ?1, activity = COALESCE(?5, activity) WHERE token = ?2 AND beat > ?3 AND (node = 0 OR since > ?4) RETURNING *"
  ).bind(t, token, t - BEAT_MS, t - s.timeMin * 60_000, activity ?? null).first();
  if (!line) throw new BoardError("NO CARRIER", 410, { carrier: false });
  return line;
}
async function getUser(env, line) {
  if (!line.user_id) throw new BoardError("Log in first.", 401);
  const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(line.user_id).first();
  if (!u || u.banned) {
    await hangupToken(env, line.token);
    throw new BoardError("Your account has been flushed.", 403, { carrier: false });
  }
  return u;
}
async function hangupToken(env, token) {
  await env.DB.prepare(
    "UPDATE line SET token = NULL, user_id = NULL, handle = NULL, activity = NULL, beat = 0, backdoor = 0, elite_ok = 0 WHERE token = ?"
  ).bind(token).run();
}
function canSee(line, user, side) {
  if (side === "main") return true;
  return side === "elite" && (!!line.elite_ok || user.level >= 255);
}
function requireSide(line, user, side) {
  if (!canSee(line, user, side)) throw new BoardError("Unknown area.", 404);
}
// New users sit at level 5 until the SysOp validates them: they can read, but not post, upload or download.
const VALIDATED = 10;
function requireValidated(user) {
  if (user.level < VALIDATED) throw new BoardError("Not yet. The SysOp hasn't validated your account. You can look around until then.", 403);
}
function requireSysop(user) {
  if (user.level < 255) throw new BoardError("SysOp only.", 403);
}

// ---------------------------------------------------------------- router
async function route(path, req, env) {
  if (path === "upload") return upload(req, env);
  let body = {};
  const len = +(req.headers.get("content-length") || 0);
  if (len > 65536) throw new BoardError("Message too long.", 413);
  try { body = await req.json(); } catch { body = {}; }
  if (!body || typeof body !== "object") body = {};

  switch (path) {
    case "info": return info(env);
    case "dial": return dial(req, env, body);
    case "stats/login": return statsLogin(env, body);
    case "stats": return stats(req, env, body);
    case "hangup": {
      const t = req.headers.get("x-line");
      if (t) {
        const l = await env.DB.prepare("SELECT * FROM line WHERE token = ?").bind(t).first();
        if (l) await logCallEnd(env, l, now());
        await hangupToken(env, t);
      }
      return json({ ok: true });
    }
    case "beat": {
      const line = await getLine(env, req, clean(body.act, 30) || null);
      let pages = 0;
      if (line.user_id) {
        const u = await env.DB.prepare("SELECT level FROM users WHERE id = ?").bind(line.user_id).first();
        if (u && u.level >= 255) pages = (await waitingPages(env)).length;
      }
      return json({ ok: true, timeLeft: timeLeft(env, line), pages });
    }
    case "local": return localLogin(req, env, body);
    case "login": return login(req, env, body);
    case "newuser": return newUser(req, env, body);
    case "apply": return apply(req, env, body);
  }

  const line = await getLine(env, req);
  const user = await getUser(env, line);
  const s = settings(env);
  const db = env.DB;

  if (path.startsWith("door/")) {
    const fail = (message, status = 400) => { throw new BoardError(message, status); };
    return json(await doorRoute(path.slice(5), body, {
      env, db, line, user, now, clean, fail, log: (kind, f) => logEvent(env, kind, { user_id: user.id, node: line.node, ...f }),
    }));
  }

  switch (path) {
    case "me": {
      const unread = await db.prepare("SELECT COUNT(*) n FROM mail WHERE to_id = ? AND read = 0").bind(user.id).first();
      return json({ user: publicUser(user), unread: unread.n, timeLeft: timeLeft(env, line), eliteOk: !!line.elite_ok,
        rules: { mainRatio: s.mainRatio, eliteRatio: s.eliteRatio, maxUpload: s.maxUpload, dailyUpload: s.dailyUpload } });
    }
    case "who": {
      const t = now();
      const rows = (await db.prepare("SELECT node, handle, activity, elite_ok FROM line WHERE token IS NOT NULL AND beat > ? ORDER BY node")
        .bind(t - BEAT_MS).all()).results;
      return json({ lines: await phoneLines(env), nodes: rows.map(r => ({
        node: r.node, local: r.node === 0, handle: r.handle || "(logging in)",
        activity: r.elite_ok && !line.elite_ok ? "Reading bulletins" : (r.activity || ""),
        you: r.node === line.node })) });
    }
    case "oneliners": {
      if (body.text !== undefined) {
        requireValidated(user);
        const text = clean(body.text, 60);
        if (!text) throw new BoardError("Write something.");
        if (line.posted >= 20) throw new BoardError("That's enough posting for one call.");
        await db.batch([
          db.prepare("INSERT INTO oneliners (user_id, handle, text, at) VALUES (?, ?, ?, ?)").bind(user.id, user.handle, text, now()),
          db.prepare("UPDATE line SET posted = posted + 1 WHERE node = ?").bind(line.node),
        ]);
      }
      const rows = (await db.prepare("SELECT handle, text, at FROM oneliners ORDER BY id DESC LIMIT 10").all()).results;
      return json({ rows: rows.reverse() });
    }
    case "callers": {
      const elite = body.side === "elite";
      if (elite) requireSide(line, user, "elite");
      const rows = (await db.prepare("SELECT handle, node, at FROM callers WHERE elite = ? ORDER BY id DESC LIMIT 15").bind(elite ? 1 : 0).all()).results;
      return json({ rows });
    }
    case "userlist": {
      const rows = (await db.prepare("SELECT handle, location, calls, ul_files, dl_files, last_call FROM users WHERE banned = 0 ORDER BY handle COLLATE NOCASE LIMIT 500").all()).results;
      return json({ rows });
    }
    case "couriers": {
      requireSide(line, user, "elite");
      const rows = (await db.prepare("SELECT handle, ul_bytes, ul_files FROM users WHERE (elite = 1 OR level >= 255) AND banned = 0 AND ul_files > 0 ORDER BY ul_bytes DESC LIMIT 10").all()).results;
      return json({ rows });
    }

    // ---------------- files
    case "areas": {
      const side = body.side === "elite" ? "elite" : "main";
      requireSide(line, user, side);
      const rows = (await db.prepare(
        "SELECT a.id, a.name, a.descr, COUNT(f.id) files, COALESCE(SUM(f.size),0) bytes FROM areas a LEFT JOIN files f ON f.area_id = a.id AND f.status = 'approved' WHERE a.side = ? GROUP BY a.id ORDER BY a.sort"
      ).bind(side).all()).results;
      return json({ rows });
    }
    case "files": {
      const area = await db.prepare("SELECT * FROM areas WHERE id = ?").bind(+body.area || 0).first();
      if (!area) throw new BoardError("Unknown area.", 404);
      requireSide(line, user, area.side);
      const rows = (await db.prepare(
        "SELECT id, filename, descr, size, uploader, uploaded_at, downloads, free, ctype FROM files WHERE area_id = ? AND status = 'approved' ORDER BY uploaded_at DESC, id DESC LIMIT 200"
      ).bind(area.id).all()).results;
      return json({ area, rows: rows.map(f => ({ ...f, viewable: TEXT_EXT.test(f.filename) && f.size <= 65536 })) });
    }
    case "view": {
      const f = await fileForUser(env, line, user, +body.id);
      if (!(TEXT_EXT.test(f.filename) && f.size <= 65536)) throw new BoardError("That file can't be viewed on-line.");
      let bytes;
      if (f.content != null) bytes = new TextEncoder().encode(f.content);
      else {
        bytes = await storage(env).bytes(f.r2_key);
        if (!bytes) throw new BoardError("File is missing from the drive.", 404);
      }
      let bin = "";
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return json({ filename: f.filename, b64: btoa(bin) });
    }
    case "download": {
      requireValidated(user);
      const f = await fileForUser(env, line, user, +body.id);
      const col = f.side === "elite" ? "credit_elite" : "credit_main";
      const cost = f.free || user.level >= 255 ? 0 : f.size;
      const r = await db.prepare(
        `UPDATE users SET ${col} = ${col} - ?1, dl_bytes = dl_bytes + ?2, dl_files = dl_files + 1 WHERE id = ?3 AND ${col} >= ?1 RETURNING ${col} AS credit`
      ).bind(cost, f.size, user.id).first();
      if (!r) return json({ ratio: false, cost, credit: user[col] });
      const ticket = randomHex(20), t = now();
      await db.batch([
        db.prepare("INSERT INTO tickets (id, file_id, user_id, expires) VALUES (?, ?, ?, ?)").bind(ticket, f.id, user.id, t + TICKET_MS),
        db.prepare("INSERT INTO events (at, kind, user_id, node, modem, value, ref) VALUES (?, 'download', ?, ?, ?, ?, ?)").bind(t, user.id, line.node, line.modem, f.size, f.id),
        db.prepare("UPDATE files SET downloads = downloads + 1 WHERE id = ?").bind(f.id),
        db.prepare("DELETE FROM tickets WHERE expires < ?").bind(t),
      ]);
      return json({ ok: true, url: "/dl/" + ticket, cost, credit: r.credit, size: f.size, filename: f.filename });
    }

    // ---------------- messages
    case "bases": {
      const side = body.side === "elite" ? "elite" : "main";
      requireSide(line, user, side);
      const rows = (await db.prepare(
        "SELECT b.id, b.name, COUNT(p.id) msgs, MAX(p.at) last FROM bases b LEFT JOIN posts p ON p.base_id = b.id WHERE b.side = ? GROUP BY b.id ORDER BY b.sort"
      ).bind(side).all()).results;
      return json({ rows });
    }
    case "posts": {
      const base = await baseForUser(env, line, user, +body.base);
      const rows = (await db.prepare(
        "SELECT * FROM (SELECT id, from_handle, to_handle, subj, body, at FROM posts WHERE base_id = ? ORDER BY id DESC LIMIT 300) ORDER BY id"
      ).bind(base.id).all()).results;
      return json({ base, rows });
    }
    case "post": {
      const base = await baseForUser(env, line, user, +body.base);
      if (base.name !== "SysOp Feedback") requireValidated(user);
      const subj = clean(body.subj, 40), text = clean(body.body, 4000, { lines: true });
      const to = clean(body.to, 20) || "All";
      if (!subj || !text) throw new BoardError("Needs a subject and a message.");
      if (line.posted >= 20) throw new BoardError("That's enough posting for one call.");
      const t = now();
      await db.batch([
        db.prepare("INSERT INTO posts (base_id, from_id, from_handle, to_handle, subj, body, at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(base.id, user.id, user.handle, to, subj, text, t),
        db.prepare("UPDATE users SET posts = posts + 1 WHERE id = ?").bind(user.id),
        db.prepare("UPDATE line SET posted = posted + 1 WHERE node = ?").bind(line.node),
      ]);
      // megaZINE submissions are rare and worth hearing about right away.
      if (base.name === MEGAZINE_BASE && user.level < 255 && (await notifyOn(env))) {
        try { await notifySend(env, "megaZINE submission", user.handle + ": " + subj); } catch (e) {}
      }
      return json({ ok: true, post: { from_handle: user.handle, to_handle: to, subj, body: text, at: t } });
    }

    // ---------------- e-mail
    case "inbox": {
      const rows = (await db.prepare("SELECT id, from_handle, subj, body, at, read FROM mail WHERE to_id = ? ORDER BY id DESC LIMIT 50").bind(user.id).all()).results;
      return json({ rows });
    }
    case "mailread": {
      await db.prepare("UPDATE mail SET read = 1 WHERE id = ? AND to_id = ?").bind(+body.id, user.id).run();
      return json({ ok: true });
    }
    case "maildel": {
      await db.prepare("DELETE FROM mail WHERE id = ? AND to_id = ?").bind(+body.id, user.id).run();
      return json({ ok: true });
    }
    case "mailsend": {
      requireValidated(user);
      const to = await db.prepare("SELECT id, handle FROM users WHERE handle = ? AND banned = 0").bind(clean(body.to, 20)).first();
      if (!to) throw new BoardError("No user by that handle.");
      const subj = clean(body.subj, 40), text = clean(body.body, 4000, { lines: true });
      if (!subj || !text) throw new BoardError("Needs a subject and a message.");
      if (line.posted >= 20) throw new BoardError("That's enough posting for one call.");
      await db.batch([
        db.prepare("INSERT INTO mail (to_id, from_id, from_handle, subj, body, at) VALUES (?, ?, ?, ?, ?, ?)").bind(to.id, user.id, user.handle, subj, text, now()),
        db.prepare("UPDATE line SET posted = posted + 1 WHERE node = ?").bind(line.node),
      ]);
      return json({ ok: true, to: to.handle });
    }

    // ---------------- live chat
    case "chat/poll": {
      const room = await chatRoomFor(env, line, user, body.room);
      const after = Math.max(0, Math.trunc(+body.after) || 0);
      const t = now();
      if (line.room !== room) {
        const stmts = [db.prepare("UPDATE line SET room = ? WHERE node = ?").bind(room, line.node),
          db.prepare("INSERT INTO chat (room, user_id, handle, kind, at) VALUES (?, ?, ?, 'join', ?)").bind(room, user.id, user.handle, t)];
        if (line.room) stmts.push(db.prepare("INSERT INTO chat (room, user_id, handle, kind, at) VALUES (?, ?, ?, 'leave', ?)").bind(line.room, user.id, user.handle, t));
        await db.batch(stmts);
      }
      const msgs = after
        ? (await db.prepare("SELECT id, handle, kind, text, at FROM chat WHERE room = ? AND id > ? ORDER BY id LIMIT 100").bind(room, after).all()).results
        : (await db.prepare("SELECT * FROM (SELECT id, handle, kind, text, at FROM chat WHERE room = ? ORDER BY id DESC LIMIT 15) ORDER BY id").bind(room).all()).results;
      const members = (await db.prepare("SELECT handle, node FROM line WHERE room = ? AND token IS NOT NULL AND beat > ? ORDER BY node").bind(room, t - BEAT_MS).all()).results;
      return json({ room, msgs, members: members.map(m => m.handle || "?") });
    }
    case "chat/say": {
      const room = await chatRoomFor(env, line, user, body.room);
      if (room === "tele" || room === "pool") requireValidated(user);
      const text = clean(body.text, 200);
      if (!text) return json({ ok: true });
      const t = now();
      const last = await db.prepare("SELECT at FROM chat WHERE user_id = ? AND kind = 'msg' ORDER BY id DESC LIMIT 1").bind(user.id).first();
      if (last && t - last.at < 600) throw new BoardError("Slow down. One line at a time.", 429);
      await db.prepare("INSERT INTO chat (room, user_id, handle, kind, text, at) VALUES (?, ?, ?, 'msg', ?, ?)").bind(room, user.id, user.handle, text, t).run();
      if (Math.random() < 0.02) await db.prepare("DELETE FROM chat WHERE at < ?").bind(t - 7 * 86_400_000).run();
      return json({ ok: true });
    }
    case "chat/leave": {
      if (line.room) await db.batch([
        db.prepare("UPDATE line SET room = NULL WHERE node = ?").bind(line.node),
        db.prepare("INSERT INTO chat (room, user_id, handle, kind, at) VALUES (?, ?, ?, 'leave', ?)").bind(line.room, user.id, user.handle, now()),
      ]);
      return json({ ok: true });
    }
    case "chat/page": {
      const reason = clean(body.reason, 60);
      const t = now();
      const recent = await db.prepare("SELECT COUNT(*) n FROM pages WHERE user_id = ? AND at > ?").bind(user.id, t - 10 * 60_000).first();
      if (recent.n >= 3) throw new BoardError("You've paged three times already. Leave the SysOp a comment instead.");
      const r = await db.prepare("INSERT INTO pages (user_id, handle, node, reason, at) VALUES (?, ?, ?, ?, ?) RETURNING id").bind(user.id, user.handle, line.node, reason, t).first();
      const sysop = await db.prepare("SELECT l.node FROM line l JOIN users u ON u.id = l.user_id WHERE u.level >= 255 AND l.token IS NOT NULL AND l.beat > ?").bind(t - BEAT_MS).first();
      if (!sysop && recent.n === 0) env.later(notifySend(env, user.handle + " is paging you",
        (reason ? "\u201c" + reason + "\u201d " : "") + "On node " + line.node + " right now. Pages expire after 5 minutes."));
      return json({ id: r.id, sysopOnline: !!sysop });
    }
    case "chat/pagestatus": {
      const pg = await db.prepare("SELECT answered FROM pages WHERE id = ? AND user_id = ?").bind(+body.id, user.id).first();
      return json({ answered: !!(pg && pg.answered) });
    }
    case "chat/pages": {
      requireSysop(user);
      return json({ rows: await waitingPages(env) });
    }
    case "chat/answer": {
      requireSysop(user);
      const pg = await db.prepare("UPDATE pages SET answered = 1 WHERE id = ? RETURNING *").bind(+body.id).first();
      if (!pg) throw new BoardError("That page is gone.");
      return json({ room: "page:" + pg.id, handle: pg.handle });
    }

    // ---------------- sysop
    case "sysop/queue": {
      requireSysop(user);
      const rows = (await db.prepare(
        "SELECT f.id, f.filename, f.descr, f.size, f.uploader, f.uploaded_at, a.name area, a.side FROM files f JOIN areas a ON a.id = f.area_id WHERE f.status = 'pending' ORDER BY f.id LIMIT 100"
      ).all()).results;
      return json({ rows });
    }
    case "sysop/validate": {
      requireSysop(user);
      const f = await db.prepare("SELECT f.*, a.side FROM files f JOIN areas a ON a.id = f.area_id WHERE f.id = ? AND f.status = 'pending'").bind(+body.id).first();
      if (!f) throw new BoardError("Not in the queue.");
      if (body.action === "reject") {
        if (f.r2_key) await storage(env).del(f.r2_key);
        await db.prepare("DELETE FROM files WHERE id = ?").bind(f.id).run();
        return json({ ok: true, rejected: true });
      }
      const elite = f.side === "elite";
      const credit = f.size * (elite ? s.eliteRatio : s.mainRatio);
      await db.batch([
        db.prepare("UPDATE files SET status = 'approved', free = ?, uploaded_at = ? WHERE id = ?").bind(body.free ? 1 : 0, now(), f.id),
        db.prepare(`UPDATE users SET ${elite ? "credit_elite" : "credit_main"} = ${elite ? "credit_elite" : "credit_main"} + ?, ul_bytes = ul_bytes + ?, ul_files = ul_files + 1 WHERE id = ?`).bind(credit, f.size, f.uploader_id),
      ]);
      return json({ ok: true, credited: credit, uploader: f.uploader });
    }
    case "sysop/fileget": {
      requireSysop(user);
      const f = await db.prepare("SELECT * FROM files WHERE id = ?").bind(+body.id).first();
      if (!f) throw new BoardError("No such file.");
      const ticket = randomHex(20);
      await db.prepare("INSERT INTO tickets (id, file_id, user_id, expires) VALUES (?, ?, ?, ?)").bind(ticket, f.id, user.id, now() + TICKET_MS).run();
      return json({ url: "/dl/" + ticket, filename: f.filename });
    }
    case "sysop/delfile": {
      requireSysop(user);
      const f = await db.prepare("SELECT * FROM files WHERE id = ?").bind(+body.id).first();
      if (!f) throw new BoardError("No such file.");
      if (f.r2_key) await storage(env).del(f.r2_key);
      await db.prepare("DELETE FROM files WHERE id = ?").bind(f.id).run();
      return json({ ok: true });
    }
    case "sysop/users": {
      requireSysop(user);
      const rows = (await db.prepare("SELECT * FROM users ORDER BY id LIMIT 500").all()).results;
      return json({ rows: rows.map(u => ({ ...publicUser(u), banned: !!u.banned })) });
    }
    case "sysop/setuser": {
      requireSysop(user);
      const u = await db.prepare("SELECT * FROM users WHERE id = ?").bind(+body.id).first();
      if (!u) throw new BoardError("No such user.");
      if (u.id === user.id && (body.banned || body.level !== undefined)) throw new BoardError("You can't do that to yourself.");
      const elite = body.elite === undefined ? u.elite : (body.elite ? 1 : 0);
      const banned = body.banned === undefined ? u.banned : (body.banned ? 1 : 0);
      const level = body.level === undefined ? u.level : Math.max(0, Math.min(255, +body.level || 10));
      const cm = Math.max(0, u.credit_main + (Math.trunc(+body.addMain) || 0));
      const ce = Math.max(0, u.credit_elite + (Math.trunc(+body.addElite) || 0));
      await db.prepare("UPDATE users SET elite = ?, banned = ?, level = ?, credit_main = ?, credit_elite = ? WHERE id = ?")
        .bind(elite, banned, level, cm, ce, u.id).run();
      if (banned) await db.prepare("UPDATE line SET token = NULL, user_id = NULL, handle = NULL, beat = 0 WHERE user_id = ?").bind(u.id).run();
      return json({ ok: true });
    }
    case "sysop/newusers": {
      requireSysop(user);
      const rows = (await db.prepare("SELECT id, handle, location, created_at, calls, app FROM users WHERE level < ? AND banned = 0 ORDER BY id LIMIT 100").bind(VALIDATED).all()).results;
      return json({ rows });
    }
    case "sysop/purgenew": {
      requireSysop(user);
      const ids = (await db.prepare("SELECT id FROM users WHERE level < ? AND banned = 0").bind(VALIDATED).all()).results.map(r => r.id);
      for (const id of ids) await db.batch([
        db.prepare("DELETE FROM users WHERE id = ?").bind(id),
        db.prepare("UPDATE line SET token = NULL, user_id = NULL, handle = NULL, beat = 0 WHERE user_id = ?").bind(id),
      ]);
      return json({ ok: true, flushed: ids.length });
    }
    case "sysop/validateuser": {
      requireSysop(user);
      const u = await db.prepare("SELECT * FROM users WHERE id = ? AND level < ?").bind(+body.id, VALIDATED).first();
      if (!u) throw new BoardError("That user isn't waiting for validation.");
      if (!body.approve) {
        await db.batch([
          db.prepare("DELETE FROM users WHERE id = ?").bind(u.id),
          db.prepare("UPDATE line SET token = NULL, user_id = NULL, handle = NULL, beat = 0 WHERE user_id = ?").bind(u.id),
        ]);
        return json({ ok: true, deleted: true });
      }
      await db.batch([
        db.prepare("UPDATE users SET level = ?, credit_main = credit_main + ? WHERE id = ?").bind(VALIDATED, s.startCredit, u.id),
        db.prepare("INSERT INTO mail (to_id, from_id, from_handle, subj, body, at) VALUES (?, ?, ?, ?, ?, ?)").bind(
          u.id, user.id, user.handle, "You've been validated",
          `Welcome aboard. You now have full access, plus ${Math.round(s.startCredit / 1024)}K of download credit to get started.\n\nRead RATIOS.TXT in the Text Files area, then go upload something.`, now()),
      ]);
      return json({ ok: true, credited: s.startCredit });
    }
    case "sysop/apps": {
      requireSysop(user);
      const rows = (await db.prepare("SELECT ap.*, u.ul_files, u.calls FROM apps ap JOIN users u ON u.id = ap.user_id WHERE ap.status = 'open' ORDER BY ap.id").all()).results;
      return json({ rows });
    }
    case "sysop/decide": {
      requireSysop(user);
      const ap = await db.prepare("SELECT * FROM apps WHERE id = ? AND status = 'open'").bind(+body.id).first();
      if (!ap) throw new BoardError("No such application.");
      const ok = !!body.approve;
      const stmts = [db.prepare("UPDATE apps SET status = ? WHERE id = ?").bind(ok ? "approved" : "denied", ap.id)];
      if (ok) stmts.push(db.prepare("UPDATE users SET elite = 1 WHERE id = ?").bind(ap.user_id));
      stmts.push(db.prepare("INSERT INTO mail (to_id, from_id, from_handle, subj, body, at) VALUES (?, ?, ?, ?, ?, ?)").bind(
        ap.user_id, user.id, user.handle, ok ? "You're in" : "Application",
        ok ? "Your application was approved. You know how to get in." : "Your application was turned down. Upload more and try again.", now()));
      await db.batch(stmts);
      return json({ ok: true });
    }
    case "sysop/secret": {
      requireSysop(user);
      const word = clean(body.word, 20), pass = clean(body.pass, 30);
      if (!word || !pass) {
        return json({ word: await config(env, "secret_word"), pass: await config(env, "secret_pass") });
      }
      const clash = await db.prepare("SELECT id FROM users WHERE handle = ?").bind(word).first();
      if (clash) throw new BoardError("A user already has that handle.");
      await db.batch([
        db.prepare("UPDATE config SET v = ? WHERE k = 'secret_word'").bind(word),
        db.prepare("UPDATE config SET v = ? WHERE k = 'secret_pass'").bind(pass),
      ]);
      return json({ ok: true, word, pass });
    }
    case "sysop/notify": {
      requireSysop(user);
      if (body.op === "token") {
        const tok = String(body.token || "").trim();
        if (!/^\d{5,15}:[A-Za-z0-9_-]{30,50}$/.test(tok)) throw new BoardError("That doesn't look like a bot token. BotFather's look like 123456789:ABCdef...");
        let me;
        try { me = await tg(env, "getMe", {}, tok); } catch (e) { throw new BoardError("Telegram didn't accept that token (" + e.message + ")."); }
        await setConfig(env, "tg_token", tok);
        await setConfig(env, "tg_bot", me.username || "");
        await delConfig(env, "tg_chat", "tg_name");
        await setConfig(env, "board_url", new URL(req.url).origin);
      }
      if (body.op === "find") {
        let ups;
        try { ups = await tg(env, "getUpdates", { limit: 50, allowed_updates: ["message"] }); } catch (e) { throw new BoardError(e.message); }
        const msg = ups.map(u => u.message).filter(m => m && m.chat && m.chat.type === "private").pop();
        if (!msg) throw new BoardError("No message yet. Open your bot in Telegram, tap Start (or send it anything), then try again.");
        await setConfig(env, "tg_chat", String(msg.chat.id));
        await setConfig(env, "tg_name", msg.chat.first_name || msg.chat.username || "");
        try { await notifySend(env, "The Septic Tankz", "Connected. The board will ping you here when things need your attention."); }
        catch (e) { throw new BoardError("Found you, but couldn't send: " + e.message); }
      }
      if (body.op === "test") {
        let sent;
        try { sent = await notifySend(env, "The Septic Tankz", "Test ping from the SysOp console. If you can read this, you're wired up."); }
        catch (e) { throw new BoardError("Couldn't send (" + e.message + ")."); }
        if (!sent) throw new BoardError("Finish setting it up first.");
      }
      if (body.op === "off") await delConfig(env, "tg_token", "tg_bot", "tg_chat", "tg_name");
      if (body.op === "slack") {
        const hook = String(body.hook || "").trim();
        if (!hook) await delConfig(env, "slack_hook");
        else {
          const testing = (await config(env, "tg_api")) && /^http:\/\/127\.0\.0\.1:\d+\//.test(hook);   // local tests only
          if (!SLACK_HOOK.test(hook) && !testing) throw new BoardError("That isn't a Slack webhook URL. They start with https://hooks.slack.com/services/");
          await setConfig(env, "board_url", new URL(req.url).origin);
          try { await slack(env, hook, "The Septic Tankz", "Connected. The board will post here when things need your attention."); }
          catch (e) { throw new BoardError("Slack didn't take it (" + e.message + ")."); }
          await setConfig(env, "slack_hook", hook);
        }
      }
      const [bot, chat, name, tok, hook] = await Promise.all(["tg_bot", "tg_chat", "tg_name", "tg_token", "slack_hook"].map(k => config(env, k)));
      return json({ bot: bot || null, hasToken: !!tok, tgOn: !!(chat && tok), name: name || null, slackOn: !!hook, waiting: await waitingCounts(env) });
    }
    case "sysop/lines": {
      requireSysop(user);
      const want = Math.trunc(+body.count);
      if (!(want >= 1 && want <= MAX_LINES)) throw new BoardError(`Between 1 and ${MAX_LINES} lines.`);
      await db.prepare("INSERT OR REPLACE INTO config (k, v) VALUES ('phone_lines', ?)").bind(String(want)).run();
      // Callers on lines that were just disconnected finish their call; nobody new can dial in on them.
      return json({ ok: true, lines: want });
    }
    case "sysop/delpost": {
      requireSysop(user);
      await db.prepare("DELETE FROM posts WHERE id = ?").bind(+body.id).run();
      return json({ ok: true });
    }
    case "sysop/kick": {
      requireSysop(user);
      await db.prepare("UPDATE line SET token = NULL, user_id = NULL, handle = NULL, beat = 0 WHERE node = ? AND node != ?").bind(+body.node, line.node).run();
      return json({ ok: true });
    }
  }
  throw new BoardError("Unknown command.", 404);
}

function timeLeft(env, line) {
  return Math.max(0, Math.floor((line.since + settings(env).timeMin * 60_000 - now()) / 60_000));
}

// Which chat room a caller may be in: the main teleconference, the Cesspool's, or a SysOp page chat.
async function chatRoomFor(env, line, user, room) {
  room = String(room || "");
  if (room === "tele") return room;
  if (room === "pool") { requireSide(line, user, "elite"); return room; }
  const m = /^page:(\d+)$/.exec(room);
  if (m) {
    const pg = await env.DB.prepare("SELECT * FROM pages WHERE id = ?").bind(+m[1]).first();
    if (pg && (pg.user_id === user.id || user.level >= 255)) return room;
  }
  throw new BoardError("No such chat room.", 404);
}
// Pages from the last 5 minutes nobody has answered, from callers still on the line.
async function waitingPages(env) {
  const t = now();
  return (await env.DB.prepare(
    "SELECT p.id, p.handle, p.node, p.reason, p.at FROM pages p JOIN line l ON l.user_id = p.user_id AND l.token IS NOT NULL AND l.beat > ? WHERE p.answered = 0 AND p.at > ? ORDER BY p.id"
  ).bind(t - BEAT_MS, t - 5 * 60_000).all()).results;
}

async function fileForUser(env, line, user, id) {
  const f = await env.DB.prepare("SELECT f.*, a.side FROM files f JOIN areas a ON a.id = f.area_id WHERE f.id = ?").bind(id || 0).first();
  if (!f || (f.status !== "approved" && user.level < 255)) throw new BoardError("No such file.", 404);
  requireSide(line, user, f.side);
  return f;
}
async function baseForUser(env, line, user, id) {
  const b = await env.DB.prepare("SELECT * FROM bases WHERE id = ?").bind(id || 0).first();
  if (!b) throw new BoardError("Unknown message base.", 404);
  requireSide(line, user, b.side);
  return b;
}

// ---------------------------------------------------------------- calling in
async function info(env) {
  const s = settings(env);
  const r = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) n FROM users"),
    env.DB.prepare("SELECT COUNT(*) n, COALESCE(SUM(size),0) b FROM files f JOIN areas a ON a.id = f.area_id WHERE status = 'approved' AND a.side = 'main'"),
    env.DB.prepare("SELECT COUNT(*) n FROM posts p JOIN bases b ON b.id = p.base_id WHERE b.side = 'main'"),
    env.DB.prepare("SELECT COUNT(*) n FROM callers"),
    env.DB.prepare("SELECT COALESCE(SUM(size),0) b FROM files WHERE content IS NULL AND ext_url IS NULL"),
  ]);
  return json({
    board: s.board, lines: await phoneLines(env), timeMin: s.timeMin, users: r[0].results[0].n,
    files: r[1].results[0].n, bytes: r[1].results[0].b, posts: r[2].results[0].n, callers: r[3].results[0].n,
    rules: { mainRatio: s.mainRatio, eliteRatio: s.eliteRatio, startCredit: s.startCredit, maxUpload: s.maxUpload },
    fresh: r[0].results[0].n === 0,
    requireValidation: s.requireValidation,
    diskFree: s.quota ? Math.max(0, s.quota - r[4].results[0].b) : null,
  });
}

// Usage log for the stats dashboard. Never lets a logging hiccup break the board.
async function logEvent(env, kind, f = {}) {
  try {
    await env.DB.prepare("INSERT INTO events (at, kind, user_id, node, modem, value, ref) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(f.at ?? now(), kind, f.user_id ?? null, f.node ?? null, f.modem ?? null, Math.max(0, Math.round(f.value || 0)), f.ref ?? null).run();
    if (Math.random() < 0.01) await env.DB.prepare("DELETE FROM events WHERE at < ?").bind(now() - 400 * 86_400_000).run();
  } catch (e) { console.error("event log", e); }
}
async function logCallEnd(env, l, endAt) {
  if (!l || !l.token || !l.since || l.node === 0) return;
  await logEvent(env, "call_end", { at: endAt, user_id: l.user_id, node: l.node, modem: l.modem, value: Math.max(0, endAt - l.since) });
}

async function dial(req, env, body = {}) {
  const s = settings(env), t = now(), db = env.DB;
  const modem = clean(body.modem, 8) || null;
  const lines = await phoneLines(env);
  const nodes = Array.from({ length: lines }, (_, i) => i + 1);
  await db.prepare(`INSERT OR IGNORE INTO line (node) VALUES ${nodes.map(() => "(?)").join(",")}`).bind(...nodes).run();
  const token = randomHex(24), ih = await ipHash(env, req);
  await hit(env, "dialIp", ih, { peek: true });   // only connects count; busy signals (auto-redial) are free
  // One address can hold at most MAX_LINES_PER_IP lines: calling again drops its oldest call
  // (a reloaded page, or a script trying to tie up every line).
  const mine = (await db.prepare("SELECT * FROM line WHERE node > 0 AND ip_hash = ? AND token IS NOT NULL AND beat > ? ORDER BY since").bind(ih, t - BEAT_MS).all()).results;
  if (lines > 1 && mine.length >= MAX_LINES_PER_IP) {
    const old = mine[0];
    await logCallEnd(env, old, t);
    await hangupToken(env, old.token);
  }
  for (const n of nodes) {
    const prev = await db.prepare("SELECT * FROM line WHERE node = ? AND token IS NOT NULL AND (beat < ? OR since < ?)").bind(n, t - BEAT_MS, t - s.timeMin * 60_000).first();
    const r = await db.prepare(
      "UPDATE line SET token = ?1, user_id = NULL, handle = NULL, activity = 'Logging in', since = ?2, beat = ?2, backdoor = 0, elite_ok = 0, fails = 0, posted = 0, ip_hash = ?3, room = NULL, modem = ?7 " +
      "WHERE node = ?4 AND (token IS NULL OR beat < ?5 OR since < ?6)"
    ).bind(token, t, ih, n, t - BEAT_MS, t - s.timeMin * 60_000, modem).run();
    if (r.meta.changes) {
      await hit(env, "dialIp", ih).catch(() => {});
      if (prev) await logCallEnd(env, prev, Math.min(prev.beat, prev.since + s.timeMin * 60_000));   // a caller who dropped without hanging up
      await logEvent(env, "dial_ok", { node: n, modem });
      return json({ node: n, token, lines, timeMin: s.timeMin });
    }
  }
  await logEvent(env, "dial_busy", { modem });
  return json({ busy: true, lines });
}

async function login(req, env, body) {
  const line = await getLine(env, req, "Logging in");
  if (line.user_id) throw new BoardError("Already logged in.");
  const db = env.DB;
  const handle = clean(body.handle, 30), pass = typeof body.password === "string" ? body.password.slice(0, 64) : "";
  await hit(env, "badLoginIp", line.ip_hash, { peek: true });
  await hit(env, "badLoginAcct", handle.toLowerCase(), { peek: true });

  // The secret entry: a special handle + password typed at the normal login prompt.
  if (!body.elite) {
    const [word, sp] = [await config(env, "secret_word"), await config(env, "secret_pass")];
    if (word && handle.toUpperCase() === word.toUpperCase() && timingSafeEq(pass.toUpperCase(), String(sp).toUpperCase())) {
      await db.prepare("UPDATE line SET backdoor = 1 WHERE node = ?").bind(line.node).run();
      return json({ backdoor: true });
    }
  } else if (!line.backdoor) {
    throw new BoardError("NO CARRIER", 410, { carrier: false });
  }

  const u = await db.prepare("SELECT * FROM users WHERE handle = ?").bind(handle).first();
  const ok = u && timingSafeEq(await hashPass(pass, u.salt), u.pass_hash);
  if (!ok) {
    await hit(env, "badLoginIp", line.ip_hash);
    if (u) await hit(env, "badLoginAcct", handle.toLowerCase());
    const fails = line.fails + 1;
    if (fails >= 3 || body.elite) {
      await hangupToken(env, line.token);
      return json({ error: body.elite ? "Access denied." : "Too many bad logins.", carrier: false }, 401);
    }
    await db.prepare("UPDATE line SET fails = ? WHERE node = ?").bind(fails, line.node).run();
    throw new BoardError("Bad handle or password.", 401);
  }
  if (u.banned) {
    await hangupToken(env, line.token);
    return json({ error: "Your account has been flushed.", carrier: false }, 403);
  }
  const eliteOk = !!body.elite && (u.elite || u.level >= 255);
  const t = now();
  await db.batch([
    db.prepare("UPDATE users SET calls = calls + 1, last_call = ? WHERE id = ?").bind(t, u.id),
    db.prepare("UPDATE line SET user_id = ?, handle = ?, elite_ok = ?, activity = ? WHERE node = ?").bind(u.id, u.handle, eliteOk ? 1 : 0, eliteOk ? "Lurking" : "Main menu", line.node),
    db.prepare("INSERT INTO callers (user_id, handle, node, at, elite) VALUES (?, ?, ?, ?, ?)").bind(u.id, u.handle, line.node, t, eliteOk ? 1 : 0),
  ]);
  const unread = await db.prepare("SELECT COUNT(*) n FROM mail WHERE to_id = ? AND read = 0").bind(u.id).first();
  const user = publicUser({ ...u, calls: u.calls + 1, last_call: u.last_call });
  if (body.elite && !eliteOk) return json({ notElite: true, user });
  return json({ user, eliteOk, unread: unread.n, timeLeft: timeLeft(env, line), lastCall: u.last_call });
}

// The SysOp's local console: logs in at the board itself (node 0), so it never takes a phone line.
async function localLogin(req, env, body) {
  const db = env.DB;
  const handle = clean(body.handle, 30), ih = await ipHash(env, req);
  await hit(env, "badLoginIp", ih, { peek: true });
  await hit(env, "badLoginAcct", handle.toLowerCase(), { peek: true });
  const u = await db.prepare("SELECT * FROM users WHERE handle = ?").bind(handle).first();
  const pass = typeof body.password === "string" ? body.password.slice(0, 64) : "";
  if (!u || u.level < 255 || u.banned || !timingSafeEq(await hashPass(pass, u.salt), u.pass_hash)) {
    await hit(env, "badLoginIp", ih);
    if (u) await hit(env, "badLoginAcct", handle.toLowerCase());
    throw new BoardError("Local login is for the SysOp only.", 401);
  }
  const token = randomHex(24), t = now();
  await db.batch([
    db.prepare("INSERT OR REPLACE INTO line (node, token, user_id, handle, activity, since, beat, backdoor, elite_ok, fails, posted, ip_hash, room) VALUES (0, ?, ?, ?, 'Local console', ?, ?, 1, 1, 0, 0, NULL, NULL)").bind(token, u.id, u.handle, t, t),
    db.prepare("UPDATE users SET last_call = ? WHERE id = ?").bind(t, u.id),
  ]);
  const unread = await db.prepare("SELECT COUNT(*) n FROM mail WHERE to_id = ? AND read = 0").bind(u.id).first();
  return json({ token, node: 0, user: publicUser(u), eliteOk: true, unread: unread.n, lastCall: u.last_call });
}

async function newUser(req, env, body) {
  const line = await getLine(env, req, "New user signup");
  if (line.user_id) throw new BoardError("Already logged in.");
  const s = settings(env), db = env.DB;
  const handle = clean(body.handle, 20).replace(/\|/g, "");
  const pass = typeof body.password === "string" ? body.password : "";
  const location = clean(body.location, 30);
  const app = clean(body.app, 600, { lines: true });
  if (handle.length < 2) throw new BoardError("Handles need at least 2 characters.");
  if (/^(new|sysop|all|guest)$/i.test(handle)) throw new BoardError("That handle is reserved.");
  const word = await config(env, "secret_word");
  if (word && handle.toUpperCase() === word.toUpperCase()) throw new BoardError("That handle is taken.");
  if (pass.length < 4 || pass.length > 64) throw new BoardError("Passwords need 4 to 64 characters.");
  if (await db.prepare("SELECT id FROM users WHERE handle = ?").bind(handle).first()) throw new BoardError("That handle is taken.");
  const t = now(), ih = line.ip_hash;
  const recent = await db.prepare("SELECT COUNT(*) n FROM users WHERE ip_hash = ? AND created_at > ?").bind(ih, t - 86_400_000).first();
  if (recent.n >= 3) throw new BoardError("Too many new accounts from your phone number today.", 429);
  const first = (await db.prepare("SELECT COUNT(*) n FROM users").first()).n === 0;
  const waits = !first && s.requireValidation;
  if (!first) {
    // A person dialing in and answering the sign-up questions takes a while; a script doesn't.
    // Instead of refusing a quick one (and making a fast typist start over), the board just makes
    // it wait: no account comes out sooner than 15 seconds after the call connected.
    const early = line.since + 15_000 - t;
    if (early > 0) await new Promise(r => setTimeout(r, early));
    if (waits) {
      const q = await db.prepare("SELECT COUNT(*) n FROM users WHERE level < ? AND banned = 0").bind(VALIDATED).first();
      if (q.n >= MAX_PENDING_USERS) throw new BoardError("The SysOp has a pile of new users to get through. New accounts are closed until the queue clears; call back tomorrow.", 429);
    }
    await hit(env, "signupIp", ih);
    await hit(env, "signupAll", "board");
  }
  const salt = randomHex(16);
  const u = await db.prepare(
    "INSERT INTO users (handle, pass_hash, salt, location, level, elite, created_at, last_call, calls, credit_main, ip_hash, app) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?) RETURNING *"
  ).bind(handle, await hashPass(pass, salt), salt, location, first ? 255 : waits ? 5 : VALIDATED, first ? 1 : 0, t, t, waits ? 0 : s.startCredit, ih, app).first();
  await db.batch([
    db.prepare("UPDATE line SET user_id = ?, handle = ?, activity = 'Main menu' WHERE node = ?").bind(u.id, u.handle, line.node),
    db.prepare("INSERT INTO callers (user_id, handle, node, at) VALUES (?, ?, ?, ?)").bind(u.id, u.handle, line.node, t),
  ]);
  if (first) env.later(setConfig(env, "board_url", new URL(req.url).origin));
  if (waits) env.later(notifyQueue(env));
  return json({ user: publicUser(u), sysop: first, pendingValidation: waits, unread: 0, timeLeft: timeLeft(env, line) });
}

async function apply(req, env, body) {
  const line = await getLine(env, req);
  const user = await getUser(env, line);
  if (!line.backdoor) throw new BoardError("Unknown command.", 404);
  const text = clean(body.text, 1000, { lines: true });
  if (!text) throw new BoardError("Write something.");
  const open = await env.DB.prepare("SELECT id FROM apps WHERE user_id = ? AND status = 'open'").bind(user.id).first();
  if (open) await env.DB.prepare("UPDATE apps SET text = ?, at = ? WHERE id = ?").bind(text, now(), open.id).run();
  else await env.DB.prepare("INSERT INTO apps (user_id, handle, text, at) VALUES (?, ?, ?, ?)").bind(user.id, user.handle, text, now()).run();
  await hangupToken(env, line.token);
  env.later(notifyQueue(env));
  return json({ ok: true });
}

// ---------------------------------------------------------------- transfers
async function upload(req, env) {
  const line = await getLine(env, req, "Uploading");
  const user = await getUser(env, line);
  requireValidated(user);
  const s = settings(env), db = env.DB;
  const area = await db.prepare("SELECT * FROM areas WHERE id = ?").bind(+(req.headers.get("x-area") || 0)).first();
  if (!area) throw new BoardError("Unknown area.", 404);
  requireSide(line, user, area.side);

  const size = +(req.headers.get("content-length") || 0);
  if (!size || !req.body) throw new BoardError("Empty file.");
  if (size > s.maxUpload) throw new BoardError(`Too big. The limit is ${Math.round(s.maxUpload / 1048576)} MB.`, 413);

  let name = decodeURIComponent(req.headers.get("x-filename") || "").split(/[\\/]/).pop();
  name = name.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9._-]/g, "").replace(/^\.+/, "").slice(-24);
  if (!name) throw new BoardError("Bad filename.");
  const descr = clean(decodeURIComponent(req.headers.get("x-desc") || ""), 50);
  if (!descr) throw new BoardError("Give it a description.");

  const sysop = user.level >= 255, t = now();
  if (!sysop) {
    await hit(env, "uploadIp", line.ip_hash || "?");
    const pend = await db.prepare("SELECT COUNT(*) n, COALESCE(SUM(size),0) b FROM files WHERE uploader_id = ? AND status = 'pending'").bind(user.id).first();
    if (pend.n >= MAX_PENDING_FILES_USER) throw new BoardError(`You have ${pend.n} uploads waiting for the SysOp already. Wait until they're checked.`, 429);
    if (pend.b + size > MAX_PENDING_BYTES_USER) throw new BoardError(`You have ${Math.round(pend.b / 1048576)} MB waiting for the SysOp already. Wait until it's checked.`, 429);
    const day = await db.prepare("SELECT COALESCE(SUM(size),0) b FROM files WHERE uploader_id = ? AND uploaded_at > ?").bind(user.id, t - 86_400_000).first();
    if (day.b + size > s.dailyUpload) throw new BoardError(`Daily upload limit is ${Math.round(s.dailyUpload / 1048576)} MB. Try tomorrow.`);
  }
  if (s.quota && (await diskUsed(env)) + size > s.quota) throw new BoardError("The board's hard drive is full. Tell the SysOp.", 507);
  const dupe = await db.prepare("SELECT f.id FROM files f JOIN areas a ON a.id = f.area_id WHERE a.side = ? AND f.filename = ?").bind(area.side, name).first();
  if (dupe) throw new BoardError("A file by that name already exists. Rename it and try again.");

  const ctype = TEXT_EXT.test(name) ? "text/plain" : "application/octet-stream";
  const row = await db.prepare(
    "INSERT INTO files (area_id, filename, descr, size, uploader_id, uploader, uploaded_at, status, ctype) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
  ).bind(area.id, name, descr, size, user.id, user.handle, t, sysop ? "approved" : "pending", ctype).first();
  const key = "f/" + row.id + "/" + name;
  try {
    const { readable, writable } = new FixedLengthStream(size);
    const pipe = req.body.pipeTo(writable);
    await storage(env).put(key, readable, size, ctype);
    await pipe;
  } catch (e) {
    await db.prepare("DELETE FROM files WHERE id = ?").bind(row.id).run();
    throw new BoardError("Transfer aborted. Line noise?", 400);
  }
  await db.prepare("UPDATE files SET r2_key = ? WHERE id = ?").bind(key, row.id).run();
  await logEvent(env, "upload", { user_id: user.id, node: line.node, modem: line.modem, value: size, ref: row.id });
  if (sysop) await db.prepare("UPDATE users SET ul_bytes = ul_bytes + ?, ul_files = ul_files + 1 WHERE id = ?").bind(size, user.id).run();
  if (!sysop) env.later(notifyQueue(env));
  return json({ ok: true, filename: name, size, pending: !sysop });
}

async function serveTicket(env, id) {
  const t = now();
  const tk = await env.DB.prepare("UPDATE tickets SET uses = uses + 1 WHERE id = ? AND expires > ? AND uses < 5 RETURNING *").bind(id, t).first();
  if (!tk) return new Response("This download link has expired. Call back in and download it again.\n", { status: 410, headers: { "content-type": "text/plain", ...CORS } });
  const f = await env.DB.prepare("SELECT * FROM files WHERE id = ?").bind(tk.file_id).first();
  if (!f) return new Response("File is gone.\n", { status: 404, headers: CORS });
  const headers = {
    ...CORS,
    "content-type": f.ctype || "application/octet-stream",
    "content-disposition": `attachment; filename="${f.filename}"`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  };
  if (f.content != null) return new Response(f.content, { headers });
  if (f.ext_url) {
    // A linked file: stream it from its official home through the board's own link.
    const r = await fetch(f.ext_url, { headers: { "user-agent": "SepticTankz-BBS" } });
    if (!r.ok || !r.body) return new Response("The file's home server didn't answer (" + r.status + "). Try again later.\n", { status: 502, headers: { "content-type": "text/plain", ...CORS } });
    const len = r.headers.get("content-length");
    if (len) headers["content-length"] = len;
    return new Response(r.body, { headers });
  }
  const body = await storage(env).stream(f.r2_key);
  if (!body) return new Response("File is missing from the drive.\n", { status: 404, headers: CORS });
  headers["content-length"] = String(f.size);
  return new Response(body, { headers });
}

// ---------------------------------------------------------------- SysOp stats dashboard (/sysop)
// Sign-in gives a stateless token: user id + expiry, HMAC-signed with the board's pepper.
async function hmac(env, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("stats:" + (await config(env, "pepper") || "")),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function statsLogin(env, body) {
  const u = await env.DB.prepare("SELECT * FROM users WHERE handle = ?").bind(clean(body.handle, 30)).first();
  const pass = typeof body.password === "string" ? body.password.slice(0, 64) : "";
  if (!u || u.level < 255 || u.banned || !timingSafeEq(await hashPass(pass, u.salt), u.pass_hash)) {
    throw new BoardError("That's not a SysOp login.", 401);
  }
  const exp = now() + 12 * 3600_000, msg = u.id + "." + exp;
  return json({ token: msg + "." + (await hmac(env, msg)), handle: u.handle, expires: exp });
}
async function stats(req, env, body) {
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [uid, exp, sig] = auth.split(".");
  if (!sig || +exp < now() || !timingSafeEq(sig, await hmac(env, uid + "." + exp))) throw new BoardError("Sign in again.", 401);
  const sysop = await env.DB.prepare("SELECT level FROM users WHERE id = ? AND banned = 0").bind(+uid).first();
  if (!sysop || sysop.level < 255) throw new BoardError("Sign in again.", 401);

  const s = settings(env), db = env.DB, t = now();
  const days = Math.min(400, Math.max(1, Math.trunc(+body.days) || 30));
  const since = t - days * 86_400_000;
  const all = (sql, ...b) => db.prepare(sql).bind(...b);
  const r = await db.batch([
    all("SELECT at, kind, value, modem, ref, user_id FROM events WHERE at > ? ORDER BY at LIMIT 50000", since),
    all("SELECT at, user_id, handle, node, elite FROM callers WHERE at > ? ORDER BY at LIMIT 50000", since),
    all("SELECT id, handle, created_at, level, elite, banned, calls, ul_files, ul_bytes, dl_files, dl_bytes, posts, last_call FROM users"),
    all("SELECT p.at, b.side FROM posts p JOIN bases b ON b.id = p.base_id WHERE p.at > ? AND p.from_id IS NOT NULL", since),
    all("SELECT at, room FROM chat WHERE at > ? AND kind = 'msg'", since),
    all("SELECT at FROM mail WHERE at > ?", since),
    all("SELECT at FROM oneliners WHERE at > ?", since),
    all("SELECT f.id, f.filename, f.size, f.downloads, f.status, a.name area, a.side FROM files f JOIN areas a ON a.id = f.area_id"),
    all("SELECT COALESCE(SUM(size),0) b FROM files WHERE content IS NULL AND ext_url IS NULL"),
    all("SELECT COUNT(*) n FROM apps WHERE status = 'open'"),
    all("SELECT at FROM pages WHERE at > ?", since),
    all("SELECT node, handle, activity, since FROM line WHERE token IS NOT NULL AND beat > ? ORDER BY node", t - BEAT_MS),
  ]);
  const rows = i => r[i].results;
  return json({
    now: t, days, lines: await phoneLines(env), quota: s.quota, used: rows(8)[0].b, openApps: rows(9)[0].n,
    events: rows(0), callers: rows(1), users: rows(2), posts: rows(3), chat: rows(4), mail: rows(5),
    oneliners: rows(6), files: rows(7), pages: rows(10), online: rows(11),
  });
}
