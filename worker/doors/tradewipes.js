// Trade Wipes 2002 — a shared-universe space trading door for The Septic Tankz.
// An original game in the spirit of the classic BBS trading doors. Every rule and every die
// roll lives here; the browser only draws what this sends back.

const N = 300;                     // sectors
const FED = 10;                    // sectors 1..FED are Flush Federation space: no combat
const TURNS = 250;                 // turns per day
const GOODS = ["Paper", "Soap", "Plungers"];
const BASE = [18, 34, 55];         // fair price per unit
const CLASSES = ["", "BBS", "BSB", "SBB", "SSB", "SBS", "BSS", "SSS", "BBB"];   // B = port buys, S = port sells
const SHIPS = [
  { name: "Plunger Merchant", cost: 0, baseHolds: 20, maxHolds: 75, maxF: 2500, maxS: 400, tpw: 1 },
  { name: "Bog Hauler", cost: 75000, baseHolds: 60, maxHolds: 150, maxF: 2000, maxS: 300, tpw: 2 },
  { name: "Clog Buster", cost: 110000, baseHolds: 20, maxHolds: 50, maxF: 10000, maxS: 2000, tpw: 1 },
  { name: "Porcelain Dreadnought", cost: 350000, baseHolds: 50, maxHolds: 110, maxF: 25000, maxS: 5000, tpw: 2 },
];
const PRICE = { fighter: 90, shield: 45, torp: 18000 };
const MAX_TORPS = 2;
const START = { credits: 20000, holds: 20, fighters: 50, shields: 10 };
const REGIONS = ["the Drain Nebula", "the Septic Expanse", "the Grease Trap Cluster", "the Backflow Reaches", "the Outer Plumbing"];
const BEAT_MS = 75_000;

// ---------------------------------------------------------------- small helpers
const nyDay = t => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
const dayNum = d => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000);
const daysBetween = (a, b) => Math.max(0, dayNum(b) - dayNum(a));
const safe = s => String(s ?? "").replace(/\|/g, "!").replace(/[{}]/g, "");
const fmt = n => Math.round(n).toLocaleString("en-US");
const rand = (a, b) => a + Math.random() * (b - a);
const int = (v, d = 0) => (Number.isFinite(+v) ? Math.trunc(+v) : d);
const region = s => (s <= FED ? "the Flush Federation" : REGIONS[Math.min(REGIONS.length - 1, Math.floor((s - FED - 1) / 58))]);

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- the universe
const NAME_A = ["Bidet", "Commode", "Lavatory", "Outhouse", "Porcelain", "Flushing", "Grease Trap", "Drain", "Sump", "Latrine",
  "Septic", "Cistern", "Gutter", "Plumb", "Sewer", "Ballcock", "Flapper", "Wax Ring", "Siphon", "Backflow", "Effluent", "Privy", "Loo", "Bog"];
const NAME_B = ["Prime", "Station", "Depot", "Landing", "Exchange", "Junction", "Outpost", "Gamma", "Major", "Minor", "IX", "Beta",
  "Terminal", "Bazaar", "Works", "Hub", "Post", "Reach", "Colony", "Annex"];

function generate(seed) {
  const R = mulberry32(seed);
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const w = Array.from({ length: N + 1 }, () => new Set());
  const two = (a, b) => { if (a !== b) { w[a].add(b); w[b].add(a); } };
  for (let i = 1; i <= FED; i++) two(i, i === FED ? 1 : i + 1);
  for (let i = 2; i <= 6; i++) two(1, i);
  for (let i = FED + 1; i <= N; i++) {
    let j = i - 1 - Math.floor(R() * R() * (i - 1));
    if (j < 1) j = 1;
    if (j <= FED) j = FED;            // the only gate out of Federation space is sector FED
    two(i, j);
  }
  for (let i = FED + 1; i <= N; i++) {
    const extra = ri(0, 3);
    for (let k = 0; k < extra && w[i].size < 6; k++) {
      const j = ri(FED + 1, N);
      if (j === i || w[j].size >= 6) continue;
      if (R() < 0.7) two(i, j); else w[i].add(j);     // some warps only go one way
    }
  }
  const dock = ri(40, N);
  const ports = [];
  const used = new Set();
  for (let s = FED + 1; s <= N; s++) {
    if (s === dock || R() > 0.5) continue;
    const roll = R();
    const cls = roll < 0.04 ? 7 : roll < 0.08 ? 8 : 1 + Math.floor(R() * 6);
    let name;
    for (let t = 0; t < 20; t++) { name = NAME_A[ri(0, NAME_A.length - 1)] + " " + NAME_B[ri(0, NAME_B.length - 1)]; if (!used.has(name)) break; }
    used.add(name);
    const m = [0, 1, 2].map(() => ri(4, 30) * 100);
    const st = m.map(x => Math.round(x * (0.6 + R() * 0.4)));
    ports.push({ sector: s, name, cls, st, m });
  }
  return { warps: w.map(x => [...x].sort((a, b) => a - b)), dock, ports };
}

let CACHE = null;   // the universe never changes once made, so each isolate keeps a copy
async function universe(db, today) {
  if (CACHE) return CACHE;
  let r = await db.prepare("SELECT k, v FROM tw_meta WHERE k IN ('warps','dock')").all();
  let m = Object.fromEntries(r.results.map(x => [x.k, x.v]));
  if (!m.warps) {
    await db.prepare("INSERT OR IGNORE INTO tw_meta (k, v) VALUES ('seed', ?)").bind(String(Math.floor(Math.random() * 2 ** 31))).run();
    const seed = +(await db.prepare("SELECT v FROM tw_meta WHERE k = 'seed'").first()).v;
    const u = generate(seed);
    const stmts = [
      db.prepare("INSERT OR IGNORE INTO tw_meta (k, v) VALUES ('warps', ?)").bind(JSON.stringify(u.warps)),
      db.prepare("INSERT OR IGNORE INTO tw_meta (k, v) VALUES ('dock', ?)").bind(String(u.dock)),
      ...u.ports.map(p => db.prepare("INSERT OR IGNORE INTO tw_ports (sector, name, class, s0, s1, s2, m0, m1, m2, day) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(p.sector, p.name, p.cls, p.st[0], p.st[1], p.st[2], p.m[0], p.m[1], p.m[2], today)),
    ];
    await db.batch(stmts);
    r = await db.prepare("SELECT k, v FROM tw_meta WHERE k IN ('warps','dock')").all();
    m = Object.fromEntries(r.results.map(x => [x.k, x.v]));
  }
  CACHE = { warps: JSON.parse(m.warps), dock: +m.dock };
  return CACHE;
}

function bfs(warps, from, goal) {
  const prev = new Int16Array(N + 1).fill(-1);
  prev[from] = from;
  const q = [from];
  for (let h = 0; h < q.length; h++) {
    const s = q[h];
    if (goal(s) && s !== from) {
      const path = [s];
      for (let x = s; x !== from;) { x = prev[x]; path.push(x); }
      return path.reverse();
    }
    for (const t of warps[s]) if (prev[t] < 0) { prev[t] = s; q.push(t); }
  }
  return null;
}

// ---------------------------------------------------------------- players
async function loadPlayer(db, id) { return db.prepare("SELECT * FROM tw_players WHERE user_id = ?").bind(id).first(); }
function savePlayer(db, p) {
  return db.prepare(
    "UPDATE tw_players SET handle=?, sector=?, ship=?, holds=?, c0=?, c1=?, c2=?, credits=?, fighters=?, shields=?, torps=?, turns=?, turns_day=?, exp=?, kills=?, deaths=?, explored=?, deal=?, last_seen=? WHERE user_id=?"
  ).bind(p.handle, p.sector, p.ship, p.holds, p.c0, p.c1, p.c2, p.credits, p.fighters, p.shields, p.torps, p.turns, p.turns_day, p.exp, p.kills, p.deaths,
    p.explored, p.deal ? JSON.stringify(p.deal) : null, p.last_seen, p.user_id);
}
const cargo = p => p.c0 + p.c1 + p.c2;
function explore(p, s) {
  let e = p.explored.padEnd(N + 1, "0");
  e = e.slice(0, s) + "1" + e.slice(s + 1);
  p.explored = e;
}
const seen = (p, s) => p.explored[s] === "1";
function me(p) {
  const sh = SHIPS[p.ship];
  return {
    handle: p.handle, sector: p.sector, ship: sh.name, shipId: p.ship, holds: p.holds, maxHolds: sh.maxHolds, cargo: [p.c0, p.c1, p.c2],
    credits: p.credits, fighters: p.fighters, maxF: sh.maxF, shields: p.shields, maxS: sh.maxS, torps: p.torps,
    turns: p.turns, tpw: sh.tpw, exp: p.exp, kills: p.kills, deaths: p.deaths, worth: worth(p),
  };
}
function worth(p) {
  return p.credits + p.fighters * PRICE.fighter + p.shields * PRICE.shield + p.torps * PRICE.torp +
    Math.max(0, p.holds - 20) * 700 + Math.floor(SHIPS[p.ship].cost * 0.6) + p.c0 * BASE[0] + p.c1 * BASE[1] + p.c2 * BASE[2];
}
function news(db, text, target = null) {
  return db.prepare("INSERT INTO tw_news (at, text, target_id) VALUES (?, ?, ?)").bind(Date.now(), text, target);
}
// A ship is destroyed: the pilot floats home in an escape pod and gets a basic ship.
function flush(p) {
  p.credits = Math.floor(p.credits * 0.75);
  p.ship = 0; p.holds = START.holds; p.c0 = p.c1 = p.c2 = 0; p.fighters = 20; p.shields = 0; p.torps = 0;
  p.sector = 1; p.deaths++; p.deal = null;
}
function battle(att, def, bonus) {
  const a = att * rand(0.85, 1.15), d = def * rand(0.9, 1.2) * bonus;
  if (a > d) return { win: true, attLoss: Math.min(att, Math.round(att * d / a)), defLoss: def };
  return { win: false, attLoss: att, defLoss: Math.min(def, Math.round(def * a / Math.max(d, 1))) };
}
function spendTurns(p, n, fail) {
  if (p.turns < n) fail(p.turns ? "That takes " + n + " turns and you have " + p.turns + "." : "You're out of turns. The Federation grounds you until tomorrow.");
  p.turns -= n;
}
async function online(db, uid) {
  return !!(await db.prepare("SELECT 1 x FROM line WHERE user_id = ? AND token IS NOT NULL AND beat > ?").bind(uid, Date.now() - BEAT_MS).first());
}

// ---------------------------------------------------------------- ports
function regenPort(port, today) {
  const d = daysBetween(port.day, today);
  if (!d) return false;
  for (let i = 0; i < 3; i++) port["s" + i] = Math.min(port["m" + i], port["s" + i] + Math.round(port["m" + i] * 0.2 * d));
  port.day = today;
  return true;
}
function unitPrice(port, i) {
  const sells = CLASSES[port.class][i] === "S", f = port["s" + i] / Math.max(1, port["m" + i]);
  return BASE[i] * (sells ? 1.5 - 0.5 * f : 0.8 + 0.6 * f);
}
function portReport(port) {
  return {
    name: port.name, class: port.class, pattern: CLASSES[port.class],
    items: [0, 1, 2].map(i => ({
      good: GOODS[i], mode: CLASSES[port.class][i] === "S" ? "selling" : "buying",
      qty: port["s" + i], pct: Math.round(100 * port["s" + i] / Math.max(1, port["m" + i])), unit: Math.round(unitPrice(port, i)),
    })),
  };
}
const savePort = (db, p) => db.prepare("UPDATE tw_ports SET s0=?, s1=?, s2=?, day=? WHERE sector=?").bind(p.s0, p.s1, p.s2, p.day, p.sector);

// ---------------------------------------------------------------- planets
function growPlanet(pl, today) {
  const d = Math.min(30, daysBetween(pl.day, today));
  if (!d) return false;
  for (let k = 0; k < d; k++) {
    const make = Math.floor(pl.colonists / 50);
    pl.p0 = Math.min(100000, pl.p0 + make); pl.p1 = Math.min(100000, pl.p1 + make); pl.p2 = Math.min(100000, pl.p2 + make);
    pl.colonists = Math.min(60000, Math.floor(pl.colonists * 1.06));
  }
  pl.day = today;
  return true;
}
const savePlanet = (db, pl) => db.prepare("UPDATE tw_planets SET owner_id=?, name=?, colonists=?, p0=?, p1=?, p2=?, fighters=?, day=? WHERE id=?")
  .bind(pl.owner_id, pl.name, pl.colonists, pl.p0, pl.p1, pl.p2, pl.fighters, pl.day, pl.id);

// ---------------------------------------------------------------- what you see in a sector
async function view(db, U, p) {
  const s = p.sector;
  const [port, planets, traders, fig] = await db.batch([
    db.prepare("SELECT * FROM tw_ports WHERE sector = ?").bind(s),
    db.prepare("SELECT pl.id, pl.name, pl.owner_id, pl.fighters, t.handle owner FROM tw_planets pl LEFT JOIN tw_players t ON t.user_id = pl.owner_id WHERE pl.sector = ? ORDER BY pl.id").bind(s),
    db.prepare("SELECT t.user_id, t.handle, t.ship, t.fighters, EXISTS (SELECT 1 FROM line l WHERE l.user_id = t.user_id AND l.token IS NOT NULL AND l.beat > ?) online FROM tw_players t WHERE t.sector = ? AND t.user_id != ? ORDER BY t.handle")
      .bind(Date.now() - BEAT_MS, s, p.user_id),
    db.prepare("SELECT f.owner_id, f.count, t.handle owner FROM tw_fighters f LEFT JOIN tw_players t ON t.user_id = f.owner_id WHERE f.sector = ?").bind(s),
  ]);
  const po = port.results[0], f = fig.results[0];
  return {
    sector: s, region: region(s), fed: s <= FED, dock: s === U.dock, home: s === 1,
    port: po ? { name: po.name, class: po.class, pattern: CLASSES[po.class] } : null,
    planets: planets.results.map(x => ({ id: x.id, name: x.name, owner: x.owner || "nobody", mine: x.owner_id === p.user_id, fighters: x.owner_id === p.user_id ? x.fighters : null })),
    traders: traders.results.map(x => ({ id: x.user_id, handle: x.handle, ship: SHIPS[x.ship].name, fighters: x.fighters, online: !!x.online })),
    fighters: f && f.count > 0 ? { owner: f.owner || "someone", count: f.count, mine: f.owner_id === p.user_id } : null,
    warps: U.warps[s].map(w => ({ s: w, seen: seen(p, w) })),
  };
}

// Arriving in a sector guarded by someone else's fighters costs you.
async function arrive(db, p, to, events, stmts) {
  p.sector = to; explore(p, to); p.deal = null;
  const f = await db.prepare("SELECT f.*, t.handle owner FROM tw_fighters f LEFT JOIN tw_players t ON t.user_id = f.owner_id WHERE f.sector = ?").bind(to).first();
  if (!f || f.owner_id === p.user_id || f.count <= 0) return false;
  const hits = Math.max(1, Math.round(f.count * 0.12));
  const s = Math.min(p.shields, hits); p.shields -= s;
  const rest = hits - s;
  if (rest > p.fighters) {
    events.push("|12" + fmt(f.count) + " fighters belonging to " + safe(f.owner) + " swarm your ship. Shields gone, fighters gone...");
    events.push("|12*** Your ship is FLUSHED. You come to in an escape pod back in sector 1. ***");
    stmts.push(news(db, "|14" + safe(p.handle) + "|07 flew into |14" + safe(f.owner) + "|07's fighters in sector " + to + " and was flushed."));
    stmts.push(news(db, "|14" + safe(p.handle) + "|07 was destroyed by your fighters in sector " + to + ".", f.owner_id));
    flush(p);
    return true;
  }
  p.fighters -= rest;
  events.push("|12Ambush! " + fmt(f.count) + " fighters belonging to " + safe(f.owner) + " open fire. |07You lose " +
    (s ? fmt(s) + " shields" : "") + (s && rest ? " and " : "") + (rest ? fmt(rest) + " fighters" : "") + ".");
  stmts.push(news(db, "|14" + safe(p.handle) + "|07 ran into your fighters in sector " + to + " and took " + fmt(hits) + " hits.", f.owner_id));
  return true;
}

// ---------------------------------------------------------------- the door's commands
export async function handle(action, body, ctx) {
  const { db, user, fail, clean } = ctx;
  const t = ctx.now(), today = nyDay(t);
  const U = await universe(db, today);

  let p = await loadPlayer(db, user.id);
  let isNew = false;
  if (!p) {
    if (action !== "enter") fail("Enter the game first.");
    await db.prepare("INSERT OR IGNORE INTO tw_players (user_id, handle, sector, holds, credits, fighters, shields, turns, turns_day, explored, last_seen, created_at) VALUES (?,?,1,?,?,?,?,?,?,?,?,?)")
      .bind(user.id, user.handle, START.holds, START.credits, START.fighters, START.shields, TURNS, today, "", t, t).run();
    await db.batch([news(db, "|14" + safe(user.handle) + "|07 registered a " + SHIPS[0].name + " with the Flush Federation.")]);
    p = await loadPlayer(db, user.id);
    isNew = true;
  }
  p.handle = user.handle;
  p.deal = p.deal ? JSON.parse(p.deal) : null;
  if (p.explored.length < N + 1) p.explored = p.explored.padEnd(N + 1, "0");
  if (p.turns_day !== today) { p.turns = TURNS; p.turns_day = today; }
  explore(p, p.sector);
  const prevSeen = p.last_seen;
  p.last_seen = t;
  const stmts = [];
  // Save everything, then (optionally) look around: the view must see this request's changes.
  const done = async (extra = {}, look = false) => {
    await db.batch([savePlayer(db, p), ...stmts]);
    return { me: me(p), ...extra, ...(look ? { view: await view(db, U, p) } : {}) };
  };

  switch (action) {
    case "enter": {
      const away = (await db.prepare("SELECT text, at FROM tw_news WHERE target_id = ? AND at > ? ORDER BY id LIMIT 15").bind(p.user_id, isNew ? t : prevSeen).all()).results;
      return done({ isNew, away, dock: U.dock, goods: GOODS }, true);
    }
    case "view": return done({}, true);

    case "move": {
      const to = int(body.to);
      if (!U.warps[p.sector].includes(to)) fail("There's no warp from sector " + p.sector + " to " + to + ".");
      spendTurns(p, SHIPS[p.ship].tpw, fail);
      const events = [];
      await arrive(db, p, to, events, stmts);
      return done({ events }, true);
    }
    case "plot": {
      const to = int(body.to);
      if (to < 1 || to > N) fail("Sectors run from 1 to " + N + ".");
      if (to === p.sector) fail("You're already there.");
      const path = bfs(U.warps, p.sector, s => s === to);
      if (!path) fail("No route to sector " + to + " from here.");
      return done({ path, turns: (path.length - 1) * SHIPS[p.ship].tpw });
    }
    case "auto": {
      const to = int(body.to);
      const path = to >= 1 && to <= N && to !== p.sector ? bfs(U.warps, p.sector, s => s === to) : null;
      if (!path) fail("The autopilot can't find a route there.");
      const events = [];
      const hops = [];
      for (const s of path.slice(1)) {
        if (p.turns < SHIPS[p.ship].tpw) { events.push("|12Out of turns. The autopilot parks you in sector " + p.sector + "."); break; }
        p.turns -= SHIPS[p.ship].tpw;
        hops.push(s);
        if (await arrive(db, p, s, events, stmts)) { events.push("|14The autopilot disengages."); break; }
      }
      return done({ hops, events }, true);
    }
    case "nearest": {
      const g = int(body.good), want = body.want === "sell" ? "B" : "S";    // "sell" = a port that buys it from you
      if (g < 0 || g > 2) fail("Which commodity?");
      const rows = (await db.prepare("SELECT sector, name, class FROM tw_ports").all()).results;
      const ok = new Map(rows.filter(r => CLASSES[r.class][g] === want).map(r => [r.sector, r]));
      const path = bfs(U.warps, p.sector, s => ok.has(s));
      if (!path) fail("No port like that anywhere you can reach.");
      const r = ok.get(path[path.length - 1]);
      return done({ path, port: { sector: r.sector, name: r.name, pattern: CLASSES[r.class] } });
    }

    // ---- trading: dock, ask for a quote, haggle
    case "port": {
      const port = await db.prepare("SELECT * FROM tw_ports WHERE sector = ?").bind(p.sector).first();
      if (!port) fail("There's no port in this sector.");
      if (!(p.deal && p.deal.dock === p.sector)) spendTurns(p, 1, fail);
      if (regenPort(port, today)) stmts.push(savePort(db, port));
      p.deal = { dock: p.sector };
      return done({ port: portReport(port) });
    }
    case "quote": {
      if (!(p.deal && p.deal.dock === p.sector)) fail("Dock at the port first.");
      const port = await db.prepare("SELECT * FROM tw_ports WHERE sector = ?").bind(p.sector).first();
      if (!port) fail("There's no port in this sector.");
      if (regenPort(port, today)) stmts.push(savePort(db, port));
      const g = int(body.good), qty = int(body.qty);
      if (g < 0 || g > 2 || qty <= 0) fail("How many?");
      const mode = CLASSES[port.class][g] === "S" ? "buy" : "sell";
      if (mode === "buy") {
        if (qty > port["s" + g]) fail("We only have " + fmt(port["s" + g]) + " to sell.");
        if (qty > p.holds - cargo(p)) fail("You only have " + (p.holds - cargo(p)) + " empty holds.");
      } else {
        if (qty > p["c" + g]) fail("You only have " + p["c" + g] + " " + GOODS[g] + ".");
        if (qty > port["s" + g]) fail("We only want " + fmt(port["s" + g]) + ".");
      }
      const fair = Math.max(1, Math.round(unitPrice(port, g) * qty));
      if (mode === "buy" && Math.round(fair * 0.9) > p.credits) fail("You can't afford that many. You have " + fmt(p.credits) + " credits.");
      const reserve = Math.round(fair * (mode === "buy" ? rand(0.9, 0.97) : rand(1.03, 1.1)));
      p.deal = { dock: p.sector, good: g, qty, mode, fair, quote: fair, reserve, rounds: 0 };
      return done({ mode, qty, quote: fair });
    }
    case "offer": {
      const d = p.deal;
      if (!(d && d.dock === p.sector && d.quote)) fail("Ask for a price first.");
      const price = int(body.price);
      if (price <= 0) fail("Make a real offer.");
      const buying = d.mode === "buy";
      let verdict;
      if (buying ? price >= d.reserve : price <= d.reserve) verdict = "accept";
      else if (buying ? price < d.fair * 0.8 : price > d.fair * 1.25) verdict = "refuse";
      else if (++d.rounds > 4) verdict = "refuse";
      else {
        d.quote = buying ? Math.max(d.reserve, Math.round(d.quote - (d.quote - price) * 0.35)) : Math.min(d.reserve, Math.round(d.quote + (price - d.quote) * 0.35));
        return done({ result: "counter", price: d.quote });
      }
      if (verdict === "refuse") { p.deal = { dock: p.sector }; return done({ result: "refuse" }); }
      const port = await db.prepare("SELECT * FROM tw_ports WHERE sector = ?").bind(p.sector).first();
      const g = d.good, k = "s" + g;
      let xp = 0;
      if (buying) {
        if (price > p.credits) fail("You don't have " + fmt(price) + " credits.");
        if (d.qty > port[k] || d.qty > p.holds - cargo(p)) fail("The deal fell through.");
        p.credits -= price; p["c" + g] += d.qty;
        if (price < d.fair * 0.95) xp = 2; else if (price < d.fair) xp = 1;
      } else {
        if (d.qty > p["c" + g] || d.qty > port[k]) fail("The deal fell through.");
        p.credits += price; p["c" + g] -= d.qty;
        if (price > d.fair * 1.05) xp = 2; else if (price > d.fair) xp = 1;
      }
      port[k] -= d.qty;
      p.exp += xp;
      stmts.push(savePort(db, port));
      p.deal = { dock: p.sector };
      return done({ result: "accept", price, xp });
    }

    // ---- the shipyard
    case "yard": {
      if (p.sector !== U.dock) fail("The shipyard is in sector " + U.dock + ".");
      return done({ yard: yardInfo(p) });
    }
    case "buy": {
      if (p.sector !== U.dock) fail("The shipyard is in sector " + U.dock + ".");
      const item = String(body.item), qty = int(body.qty), sh = SHIPS[p.ship];
      let cost = 0;
      if (item === "ship") {
        const id = int(body.ship, -1), ns = SHIPS[id];
        if (!ns || id === 0 || id === p.ship) fail("Which ship?");
        cost = ns.cost - Math.floor(sh.cost * 0.4);
        if (cost > p.credits) fail("That's " + fmt(cost) + " credits after your trade-in. You have " + fmt(p.credits) + ".");
        p.credits -= cost; p.ship = id;
        p.holds = Math.max(ns.baseHolds, Math.min(p.holds, ns.maxHolds));
        p.fighters = Math.min(p.fighters, ns.maxF); p.shields = Math.min(p.shields, ns.maxS);
        for (let i = 0; i < 3 && cargo(p) > p.holds; i++) p["c" + i] = Math.max(0, p["c" + i] - (cargo(p) - p.holds));
        stmts.push(news(db, "|14" + safe(p.handle) + "|07 drove a brand new |15" + ns.name + "|07 off the lot."));
        return done({ bought: ns.name, cost, yard: yardInfo(p) });
      }
      if (qty <= 0) fail("How many?");
      if (item === "holds") {
        if (p.holds + qty > sh.maxHolds) fail("A " + sh.name + " tops out at " + sh.maxHolds + " holds.");
        cost = holdCost(p.holds, qty);
      } else if (item === "fighters") {
        if (p.fighters + qty > sh.maxF) fail("A " + sh.name + " carries at most " + fmt(sh.maxF) + " fighters.");
        cost = qty * PRICE.fighter;
      } else if (item === "shields") {
        if (p.shields + qty > sh.maxS) fail("A " + sh.name + " takes at most " + fmt(sh.maxS) + " shields.");
        cost = qty * PRICE.shield;
      } else if (item === "torps") {
        if (p.torps + qty > MAX_TORPS) fail("Regulations allow " + MAX_TORPS + " Flushbang torpedoes aboard.");
        cost = qty * PRICE.torp;
      } else fail("We don't sell that.");
      if (cost > p.credits) fail("That's " + fmt(cost) + " credits. You have " + fmt(p.credits) + ".");
      p.credits -= cost;
      p[item] += qty;
      return done({ cost, yard: yardInfo(p) });
    }

    // ---- fighters, combat
    case "fighters": {
      if (p.sector <= FED) fail("The Federation doesn't allow fighters in its space.");
      const f = await db.prepare("SELECT * FROM tw_fighters WHERE sector = ?").bind(p.sector).first();
      if (f && f.owner_id !== p.user_id && f.count > 0) fail("Someone else's fighters hold this sector. Clear them first.");
      const here = f && f.owner_id === p.user_id ? f.count : 0, pool = here + p.fighters;
      const leave = int(body.leave);
      if (leave < 0 || leave > pool) fail("You have " + fmt(pool) + " fighters to work with.");
      if (pool - leave > SHIPS[p.ship].maxF) fail("Your ship can't hold that many.");
      p.fighters = pool - leave;
      stmts.push(leave ? db.prepare("INSERT INTO tw_fighters (sector, owner_id, count) VALUES (?1, ?2, ?3) ON CONFLICT (sector) DO UPDATE SET owner_id = ?2, count = ?3").bind(p.sector, p.user_id, leave)
        : db.prepare("DELETE FROM tw_fighters WHERE sector = ?").bind(p.sector));
      return done({ left: leave });
    }
    case "attack": {
      if (p.sector <= FED) fail("Combat in Federation space? The Feds would have your license.");
      const send = int(body.send);
      if (send <= 0 || send > p.fighters) fail("You have " + fmt(p.fighters) + " fighters to send.");
      spendTurns(p, 3, fail);
      const events = [];
      if (body.kind === "ship") {
        const v = await loadPlayer(db, int(body.target));
        if (!v || v.user_id === p.user_id || v.sector !== p.sector) fail("They're not here.");
        if (await online(db, v.user_id)) fail(safe(v.handle) + " is on-line and flying. You can only jump ships that are parked.");
        const b = battle(send, v.shields + v.fighters * 1.1, 1);
        p.fighters -= b.attLoss;
        if (b.win) {
          const loot = Math.floor(v.credits * 0.1);
          events.push("|10Your fighters tear through " + safe(v.handle) + "'s defenses. Their " + SHIPS[v.ship].name + " is FLUSHED!");
          events.push("|07You lost " + fmt(b.attLoss) + " fighters and salvage |14" + fmt(loot) + "|07 credits from the wreck.");
          p.credits += loot; p.kills++; p.exp += 25;
          const lostShip = SHIPS[v.ship].name;
          v.deal = null; flush(v); v.credits = Math.max(0, v.credits - loot);
          stmts.push(savePlayer(db, v));
          stmts.push(news(db, "|14" + safe(p.handle) + "|07 ambushed |14" + safe(v.handle) + "|07 in sector " + p.sector + " and flushed their " + lostShip + "."));
          stmts.push(news(db, "|12" + safe(p.handle) + " ambushed your parked " + lostShip + " in sector " + p.sector + ". You escaped in a pod.", v.user_id));
        } else {
          let loss = b.defLoss;
          const s = Math.min(v.shields, loss); v.shields -= s; loss -= s;
          v.fighters = Math.max(0, v.fighters - Math.ceil(loss / 1.1));
          stmts.push(db.prepare("UPDATE tw_players SET shields = ?, fighters = ? WHERE user_id = ?").bind(v.shields, v.fighters, v.user_id));
          events.push("|12" + safe(v.handle) + "'s ship holds. |07You lost all " + fmt(send) + " fighters you sent; they lost " + fmt(b.defLoss) + " shields and fighters.");
          stmts.push(news(db, "|14" + safe(p.handle) + "|07 attacked your ship in sector " + p.sector + " and was driven off.", v.user_id));
        }
      } else if (body.kind === "fighters") {
        const f = await db.prepare("SELECT f.*, t.handle owner FROM tw_fighters f LEFT JOIN tw_players t ON t.user_id = f.owner_id WHERE f.sector = ?").bind(p.sector).first();
        if (!f || f.owner_id === p.user_id || f.count <= 0) fail("No enemy fighters here.");
        const b = battle(send, f.count, 1.1);
        p.fighters -= b.attLoss;
        if (b.win) {
          stmts.push(db.prepare("DELETE FROM tw_fighters WHERE sector = ?").bind(p.sector));
          events.push("|10You wipe out all " + fmt(f.count) + " of " + safe(f.owner) + "'s fighters, losing " + fmt(b.attLoss) + ".");
          stmts.push(news(db, "|12" + safe(p.handle) + " destroyed your " + fmt(f.count) + " fighters in sector " + p.sector + ".", f.owner_id));
          p.exp += 5;
        } else {
          stmts.push(db.prepare("UPDATE tw_fighters SET count = ? WHERE sector = ?").bind(f.count - b.defLoss, p.sector));
          events.push("|12Their fighters hold. |07You lost all " + fmt(send) + "; they lost " + fmt(b.defLoss) + ".");
          stmts.push(news(db, "|14" + safe(p.handle) + "|07 attacked your fighters in sector " + p.sector + " and was beaten off. You lost " + fmt(b.defLoss) + ".", f.owner_id));
        }
      } else if (body.kind === "planet") {
        const pl = await db.prepare("SELECT * FROM tw_planets WHERE id = ? AND sector = ?").bind(int(body.target), p.sector).first();
        if (!pl || pl.owner_id === p.user_id) fail("No enemy planet like that here.");
        const owner = await loadPlayer(db, pl.owner_id);
        const b = pl.fighters ? battle(send, pl.fighters, 1.2) : { win: true, attLoss: 0, defLoss: 0 };
        p.fighters -= b.attLoss;
        if (b.win) {
          pl.owner_id = p.user_id; pl.fighters = 0;
          events.push("|10Planet " + safe(pl.name) + " falls! |07You lost " + fmt(b.attLoss) + " fighters. The colonists grumble and salute your flag.");
          stmts.push(news(db, "|14" + safe(p.handle) + "|07 captured the planet |15" + safe(pl.name) + "|07 from |14" + safe(owner ? owner.handle : "nobody") + "|07."));
          if (owner) stmts.push(news(db, "|12" + safe(p.handle) + " captured your planet " + safe(pl.name) + " in sector " + p.sector + ".", owner.user_id));
          p.exp += 15;
        } else {
          pl.fighters -= b.defLoss;
          events.push("|12The planet's defenses hold. |07You lost all " + fmt(send) + " fighters; they lost " + fmt(b.defLoss) + ".");
          if (owner) stmts.push(news(db, "|14" + safe(p.handle) + "|07 attacked your planet " + safe(pl.name) + " and was beaten back.", owner.user_id));
        }
        stmts.push(savePlanet(db, pl));
      } else fail("Attack what?");
      return done({ events }, true);
    }

    // ---- planets
    case "planet/create": {
      if (p.torps < 1) fail("You need a Flushbang torpedo. The shipyard sells them.");
      if (p.sector <= FED || p.sector === U.dock) fail("Not here. The Federation would notice.");
      const n = (await db.prepare("SELECT COUNT(*) n FROM tw_planets WHERE sector = ?").bind(p.sector).first()).n;
      if (n >= 3) fail("This sector is crowded enough.");
      const name = clean(body.name, 24) || "Planet " + p.handle;
      spendTurns(p, 5, fail);
      p.torps--;
      p.exp += 10;
      stmts.push(db.prepare("INSERT INTO tw_planets (sector, owner_id, name, colonists, day, created_at) VALUES (?, ?, ?, 2000, ?, ?)").bind(p.sector, p.user_id, name, today, t));
      stmts.push(news(db, "|14" + safe(p.handle) + "|07 flushed a Flushbang torpedo in sector " + p.sector + " and the planet |15" + safe(name) + "|07 bubbled up."));
      return done({ name }, true);
    }
    case "planet/land": {
      const pl = await db.prepare("SELECT pl.*, t.handle owner FROM tw_planets pl LEFT JOIN tw_players t ON t.user_id = pl.owner_id WHERE pl.id = ? AND pl.sector = ?").bind(int(body.id), p.sector).first();
      if (!pl) fail("No such planet here.");
      if (pl.owner_id !== p.user_id) fail("Planet " + safe(pl.name) + " belongs to " + safe(pl.owner || "someone") + ". Its gun crews wave you off.");
      if (growPlanet(pl, today)) stmts.push(savePlanet(db, pl));
      return done({ planet: planetInfo(pl) });
    }
    case "planet/xfer": {
      const pl = await db.prepare("SELECT * FROM tw_planets WHERE id = ? AND sector = ?").bind(int(body.id), p.sector).first();
      if (!pl || pl.owner_id !== p.user_id) fail("That's not your planet.");
      growPlanet(pl, today);
      const leave = body.leave === undefined ? null : int(body.leave);
      if (leave !== null) {        // set how many fighters guard the planet
        const pool = pl.fighters + p.fighters;
        if (leave < 0 || leave > pool) fail("You have " + fmt(pool) + " fighters between ship and planet.");
        if (pool - leave > SHIPS[p.ship].maxF) fail("Your ship can't carry that many.");
        pl.fighters = leave; p.fighters = pool - leave;
      }
      const take = Array.isArray(body.take) ? body.take.map(x => Math.max(0, int(x))) : [0, 0, 0];
      for (let i = 0; i < 3; i++) {
        const n = Math.min(take[i] || 0, pl["p" + i], p.holds - cargo(p));
        pl["p" + i] -= n; p["c" + i] += n;
      }
      stmts.push(savePlanet(db, pl));
      return done({ planet: planetInfo(pl) });
    }

    // ---- information
    case "rank": {
      const rows = (await db.prepare("SELECT * FROM tw_players").all()).results;
      const planets = (await db.prepare("SELECT owner_id, COUNT(*) n FROM tw_planets GROUP BY owner_id").all()).results;
      const pc = Object.fromEntries(planets.map(r => [r.owner_id, r.n]));
      rows.forEach(r => { r.worth = worth(r) + (pc[r.user_id] || 0) * 50000; });
      rows.sort((a, b) => b.worth - a.worth);
      return done({ rows: rows.slice(0, 15).map(r => ({ handle: r.handle, worth: r.worth, ship: SHIPS[r.ship].name, kills: r.kills, planets: pc[r.user_id] || 0, you: r.user_id === p.user_id })) });
    }
    case "news": {
      const rows = (await db.prepare("SELECT text, at FROM tw_news WHERE target_id IS NULL ORDER BY id DESC LIMIT 16").all()).results;
      return done({ rows });
    }
    case "port/info": {    // the computer's port report for a sector you've been to
      const s = int(body.sector);
      if (!seen(p, s)) fail("You haven't been to sector " + s + ".");
      const port = await db.prepare("SELECT * FROM tw_ports WHERE sector = ?").bind(s).first();
      if (!port) fail("No port in sector " + s + ".");
      regenPort(port, today);
      return done({ port: { sector: s, ...portReport(port) } });
    }
    case "info": return done({ dock: U.dock });
  }
  fail("Unknown command.", 404);
}

function holdCost(h, q) { return q * 400 + 12 * (q * h + (q * (q - 1)) / 2); }
function yardInfo(p) {
  const sh = SHIPS[p.ship];
  return {
    hold: holdCost(p.holds, 1), fighter: PRICE.fighter, shield: PRICE.shield, torp: PRICE.torp, maxTorps: MAX_TORPS,
    ships: SHIPS.map((s, i) => ({ id: i, ...s, price: i === 0 ? null : s.cost - Math.floor(sh.cost * 0.4), yours: i === p.ship })),
  };
}
function planetInfo(pl) {
  return { id: pl.id, name: pl.name, colonists: pl.colonists, goods: [pl.p0, pl.p1, pl.p2], fighters: pl.fighters, make: Math.floor(pl.colonists / 50) };
}
