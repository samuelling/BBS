// The Septic Tankz — board server (Cloudflare Worker + D1, files in KV / R2 / your own server)
//
// Every caller holds a "phone line": a row in the `line` table with a random
// token and a heartbeat. No line, no service. Accounts, ratios, uploads and the
// validation queue are all enforced here, never in the browser.

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

const STORE_CAP_MB = { kv: 25, r2: 100, http: 100 };   // largest single file each backend takes

function settings(env) {
  const n = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);
  const store = storeKind(env);
  return {
    store,
    quota: n(env.STORAGE_QUOTA_MB, store === "kv" ? 900 : 0) * 1048576,   // 0 = no board-wide limit
    board: env.BOARD_NAME || "The Septic Tankz",
    lines: Math.min(16, n(env.PHONE_LINES, 1)),
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
  const r = await env.DB.prepare("SELECT COALESCE(SUM(size),0) b FROM files WHERE content IS NULL").first();
  return r.b;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      if (url.pathname.startsWith("/dl/")) return await serveTicket(env, url.pathname.slice(4));
      if (url.pathname.startsWith("/api/")) {
        if (req.method !== "POST") throw new BoardError("Use POST.", 405);
        return await route(url.pathname.slice(5), req, env);
      }
      return env.ASSETS.fetch(req);
    } catch (e) {
      if (e instanceof BoardError) return json({ error: e.message, ...e.extra }, e.status);
      console.error(e && e.stack || e);
      return json({ error: "Line noise. Something broke on the board's end." }, 500);
    }
  },
};

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
    case "dial": return dial(req, env);
    case "hangup": { const t = req.headers.get("x-line"); if (t) await hangupToken(env, t); return json({ ok: true }); }
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

  switch (path) {
    case "me": {
      const unread = await db.prepare("SELECT COUNT(*) n FROM mail WHERE to_id = ? AND read = 0").bind(user.id).first();
      return json({ user: publicUser(user), unread: unread.n, timeLeft: timeLeft(env, line), eliteOk: !!line.elite_ok,
        rules: { mainRatio: s.mainRatio, eliteRatio: s.eliteRatio, maxUpload: s.maxUpload, dailyUpload: s.dailyUpload } });
    }
    case "who": {
      const t = now();
      const rows = (await db.prepare("SELECT node, handle, activity, elite_ok FROM line WHERE token IS NOT NULL AND beat > ? AND node <= ? ORDER BY node")
        .bind(t - BEAT_MS, s.lines).all()).results;
      return json({ lines: s.lines, nodes: rows.map(r => ({
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
    env.DB.prepare("SELECT COALESCE(SUM(size),0) b FROM files WHERE content IS NULL"),
  ]);
  return json({
    board: s.board, lines: s.lines, timeMin: s.timeMin, users: r[0].results[0].n,
    files: r[1].results[0].n, bytes: r[1].results[0].b, posts: r[2].results[0].n, callers: r[3].results[0].n,
    rules: { mainRatio: s.mainRatio, eliteRatio: s.eliteRatio, startCredit: s.startCredit, maxUpload: s.maxUpload },
    fresh: r[0].results[0].n === 0,
    requireValidation: s.requireValidation,
    diskFree: s.quota ? Math.max(0, s.quota - r[4].results[0].b) : null,
  });
}

async function dial(req, env) {
  const s = settings(env), t = now(), db = env.DB;
  const nodes = Array.from({ length: s.lines }, (_, i) => i + 1);
  await db.prepare(`INSERT OR IGNORE INTO line (node) VALUES ${nodes.map(() => "(?)").join(",")}`).bind(...nodes).run();
  const token = randomHex(24), ih = await ipHash(env, req);
  for (const n of nodes) {
    const r = await db.prepare(
      "UPDATE line SET token = ?1, user_id = NULL, handle = NULL, activity = 'Logging in', since = ?2, beat = ?2, backdoor = 0, elite_ok = 0, fails = 0, posted = 0, ip_hash = ?3 " +
      "WHERE node = ?4 AND (token IS NULL OR beat < ?5 OR since < ?6)"
    ).bind(token, t, ih, n, t - BEAT_MS, t - s.timeMin * 60_000).run();
    if (r.meta.changes) return json({ node: n, token, lines: s.lines, timeMin: s.timeMin });
  }
  return json({ busy: true, lines: s.lines });
}

async function login(req, env, body) {
  const line = await getLine(env, req, "Logging in");
  if (line.user_id) throw new BoardError("Already logged in.");
  const db = env.DB;
  const handle = clean(body.handle, 30), pass = typeof body.password === "string" ? body.password.slice(0, 64) : "";

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
  const u = await db.prepare("SELECT * FROM users WHERE handle = ?").bind(clean(body.handle, 30)).first();
  const pass = typeof body.password === "string" ? body.password.slice(0, 64) : "";
  if (!u || u.level < 255 || u.banned || !timingSafeEq(await hashPass(pass, u.salt), u.pass_hash)) {
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
  if (recent.n >= 3) throw new BoardError("Too many new accounts from your phone number today.");
  const first = (await db.prepare("SELECT COUNT(*) n FROM users").first()).n === 0;
  const waits = !first && s.requireValidation;
  const salt = randomHex(16);
  const u = await db.prepare(
    "INSERT INTO users (handle, pass_hash, salt, location, level, elite, created_at, last_call, calls, credit_main, ip_hash, app) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?) RETURNING *"
  ).bind(handle, await hashPass(pass, salt), salt, location, first ? 255 : waits ? 5 : VALIDATED, first ? 1 : 0, t, t, waits ? 0 : s.startCredit, ih, app).first();
  await db.batch([
    db.prepare("UPDATE line SET user_id = ?, handle = ?, activity = 'Main menu' WHERE node = ?").bind(u.id, u.handle, line.node),
    db.prepare("INSERT INTO callers (user_id, handle, node, at) VALUES (?, ?, ?, ?)").bind(u.id, u.handle, line.node, t),
  ]);
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
  if (sysop) await db.prepare("UPDATE users SET ul_bytes = ul_bytes + ?, ul_files = ul_files + 1 WHERE id = ?").bind(size, user.id).run();
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
  const body = await storage(env).stream(f.r2_key);
  if (!body) return new Response("File is missing from the drive.\n", { status: 404, headers: CORS });
  headers["content-length"] = String(f.size);
  return new Response(body, { headers });
}
