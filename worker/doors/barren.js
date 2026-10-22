// Barren Drains Elite — a shared-world empire door for MEGAzine BBS.
// Original game in the style of the old empire doors: every turn is a year, turns refill daily,
// and everybody's realm lives in the same world. All rules and dice rolls live here.

const TZ = "America/New_York";
const TURNS_PER_DAY = 10;
const TURN_BANK = 30;          // unused turns pile up to this many
const PROTECT_YEARS = 20;      // new realms can't be attacked for their first 20 years
const HITS_PER_DAY = 3;        // a realm can only be attacked this many times a day
const SPIES_PER_DAY = 6;
const MIN_LAND = 50;

const BUILD = {
  farms:     { name: "Fertilized Fields", cost: 300 },
  outhouses: { name: "Pay Outhouses", cost: 300 },
  bunks:     { name: "Bunkhouses", cost: 300 },
  towers:    { name: "Stink Towers", cost: 300 },
  thrones:   { name: "Porcelain Thrones", cost: 1500 },
};
const UNITS = {
  plungers: { name: "Plungermen", cost: 40, crew: 1, off: 1, def: 1, upkeep: 1 },
  slingers: { name: "Slingers", cost: 110, crew: 1, off: 1, def: 2, upkeep: 2 },
  wagons:   { name: "Honey Wagons", cost: 600, crew: 3, off: 6, def: 2, upkeep: 10 },
  sniffers: { name: "Sniffers", cost: 250, crew: 1, off: 0, def: 0, upkeep: 3 },
};
const PRICE = { buy: 3, sell: 1 };   // gold per bushel of food
const BUNK_HOLDS = 50;               // troops housed per bunkhouse
const COLS = ["day", "turns", "years", "prot", "land", "farms", "outhouses", "bunks", "towers", "thrones", "peasants", "food", "gold",
  "tax", "plungers", "slingers", "wagons", "sniffers", "spy_day", "spies", "networth", "last_seen", "name"];

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const today = t => dayFmt.format(new Date(t));
const dayNum = s => Math.round(Date.parse(s + "T00:00:00Z") / 86400000);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const frand = (a, b) => a + Math.random() * (b - a);
const int = v => Math.max(0, Math.floor(+v || 0));
const fmt = n => Math.floor(n).toLocaleString("en-US");

function built(r) { return r.farms + r.outhouses + r.bunks + r.towers + r.thrones; }
function freeLand(r) { return r.land - built(r); }
function army(r) { return r.plungers + r.slingers + r.wagons; }
function housing(r) { return r.bunks * BUNK_HOLDS; }
function morale(r) { const a = army(r), h = housing(r); return a <= h ? 1 : Math.max(0.6, h / a); }
function netWorth(r) {
  return Math.floor(r.land * 20 + built(r) * 30 + r.thrones * 250 + r.peasants + r.gold / 10 + r.food / 20 +
    r.plungers * 5 + r.slingers * 10 + r.wagons * 60 + r.sniffers * 15);
}
function isProtected(r) { return r.prot === 1 && r.years < PROTECT_YEARS; }
function defense(r) {
  const troops = r.plungers * UNITS.plungers.def + r.slingers * UNITS.slingers.def + r.wagons * UNITS.wagons.def;
  return Math.max(50 + r.peasants * 0.02, troops * (1 + Math.min(0.5, r.towers * 0.01)) + r.towers * 10);
}

// Lazily hand out the day's turns on the realm's first visit of the day.
function refill(r, t) {
  const d = today(t);
  if (r.day !== d) {
    const days = Math.max(1, dayNum(d) - dayNum(r.day));
    r.turns = Math.min(TURN_BANK, r.turns + TURNS_PER_DAY * days);
    r.day = d;
  }
  if (r.spy_day !== d) { r.spy_day = d; r.spies = 0; }
}

async function load(ctx) {
  const r = await ctx.db.prepare("SELECT * FROM bde_realms WHERE user_id = ?").bind(ctx.user.id).first();
  if (!r) return null;
  refill(r, ctx.now());
  return r;
}
function saveStmt(ctx, r) {
  r.networth = netWorth(r); r.last_seen = ctx.now();
  return ctx.db.prepare("UPDATE bde_realms SET " + COLS.map((c, i) => c + " = ?" + (i + 1)).join(", ") +
    ", ver = ver + 1 WHERE user_id = ?" + (COLS.length + 1) + " AND ver = ?" + (COLS.length + 2))
    .bind(...COLS.map(c => r[c]), r.user_id, r.ver);
}
async function save(ctx, r, extra = []) {
  const res = await ctx.db.batch([saveStmt(ctx, r), ...extra]);
  if (!res[0].meta.changes) ctx.fail("Your realm changed while you were deciding. Try that again.", 409);
}
function news(ctx, text) { return ctx.db.prepare("INSERT INTO bde_news (at, text) VALUES (?, ?)").bind(ctx.now(), text); }
function report(ctx, uid, text) { return ctx.db.prepare("INSERT INTO bde_reports (user_id, at, text) VALUES (?, ?, ?)").bind(uid, ctx.now(), text); }

function view(r) {
  return {
    name: r.name, handle: r.handle, years: r.years, turns: r.turns, land: r.land, free: freeLand(r),
    farms: r.farms, outhouses: r.outhouses, bunks: r.bunks, towers: r.towers, thrones: r.thrones,
    peasants: r.peasants, food: r.food, gold: r.gold, tax: r.tax,
    plungers: r.plungers, slingers: r.slingers, wagons: r.wagons, sniffers: r.sniffers,
    housing: housing(r), army: army(r), networth: netWorth(r), protected: isProtected(r),
    protectLeft: isProtected(r) ? PROTECT_YEARS - r.years : 0, spiesLeft: SPIES_PER_DAY - r.spies,
    capacity: capacity(r),
  };
}
function capacity(r) { return r.land * 10 + r.thrones * 20; }

// ---------------------------------------------------------------- one year passes
function runYear(r) {
  const y = { year: r.years + 1 };
  const free = freeLand(r);
  y.harvest = r.farms * 80 + free * 2;
  y.eaten = r.peasants + r.plungers + r.slingers + r.wagons * 3 + r.sniffers;
  r.food += y.harvest - y.eaten;
  y.taxes = Math.floor(r.peasants * r.tax / 100 * 3);
  y.outhouse = r.outhouses * 60;
  y.upkeep = Object.keys(UNITS).reduce((s, k) => s + r[k] * UNITS[k].upkeep, 0);
  r.gold += y.taxes + y.outhouse - y.upkeep;
  y.starved = 0; y.deserted = 0; y.born = 0; y.left = 0;

  const desert = frac => { for (const k of ["plungers", "slingers", "wagons"]) { const n = Math.ceil(r[k] * frac); r[k] -= n; y.deserted += n; } };
  if (r.food < 0) {
    r.food = 0;
    y.starved = Math.ceil(r.peasants * 0.1); r.peasants -= y.starved;
    desert(0.05);
  }
  if (r.gold < 0) { r.gold = 0; desert(0.1); y.unpaid = true; }

  const cap = capacity(r);
  if (!y.starved) {
    const rate = 0.06 * Math.max(0, 1 - r.tax / 40);
    y.born = Math.max(0, Math.min(Math.floor(r.peasants * rate) + rnd(0, 20), cap - r.peasants));
    r.peasants += y.born;
  }
  if (r.tax > 30) y.left += Math.floor(r.peasants * (r.tax - 30) / 200);
  if (r.peasants - y.left > cap) y.left += Math.ceil((r.peasants - y.left - cap) / 2);
  r.peasants = Math.max(10, r.peasants - y.left);

  // Something always happens in a septic kingdom.
  if (Math.random() < 0.18) {
    const ev = [
      () => { const n = Math.floor(r.food * frand(0.05, 0.12)); r.food -= n; return "Rats got into the granary and ate " + fmt(n) + " bushels."; },
      () => { const n = rnd(100, 400) + r.thrones * 50; r.gold += n; return "A tour bus stopped to gawk. They paid " + fmt(n) + " gold to use the outhouses."; },
      () => { const n = rnd(20, 60); r.peasants += n; return n + " refugees from a flooded neighboring kingdom moved in."; },
      () => { const n = Math.floor(r.gold * frand(0.03, 0.08)); r.gold -= n; return "The royal treasurer flushed " + fmt(n) + " gold down the wrong hole."; },
      () => { const n = rnd(200, 600); r.food += n; return "A bumper crop of turnips! " + fmt(n) + " extra bushels."; },
      () => { if (!r.towers) return "Something smelled terrible this year. Nobody could say what."; r.towers--; return "A Stink Tower tipped over in a storm. Nobody wants to rebuild it."; },
    ];
    y.event = ev[rnd(0, ev.length - 1)]();
  }
  r.years++; r.turns--;
  return y;
}

function needTurn(ctx, r) { if (r.turns < 1) ctx.fail("You're out of turns for today. Your realm sleeps until tomorrow."); }
async function target(ctx, r, id) {
  const t = await ctx.db.prepare("SELECT * FROM bde_realms WHERE user_id = ?").bind(int(id)).first();
  if (!t) ctx.fail("No such realm.", 404);
  if (t.user_id === r.user_id) ctx.fail("That's your own realm.");
  return t;
}
async function allied(ctx, a, b) {
  const n = await ctx.db.prepare("SELECT COUNT(*) n FROM bde_pacts WHERE (a = ?1 AND b = ?2) OR (a = ?2 AND b = ?1)").bind(a, b).first();
  return n.n === 2;
}
function successChance(mine, theirs, scale = 1) { return Math.max(0.15, Math.min(0.9, (0.25 + 0.65 * mine / (mine + theirs + 1)) * scale)); }

// ---------------------------------------------------------------- actions
export async function handle(action, body, ctx) {
  const { db } = ctx;
  const t = ctx.now();

  if (action === "news") {
    const rows = (await db.prepare("SELECT at, text FROM bde_news ORDER BY id DESC LIMIT 15").all()).results;
    return { news: rows };
  }
  if (action === "realms") {
    const r = await load(ctx);
    const rows = (await db.prepare("SELECT user_id, handle, name, land, networth, years, prot FROM bde_realms ORDER BY networth DESC LIMIT 20").all()).results;
    const pacts = (await db.prepare("SELECT a, b FROM bde_pacts WHERE a = ?1 OR b = ?1").bind(ctx.user.id).all()).results;
    const mine = new Set(pacts.filter(p => p.a === ctx.user.id).map(p => p.b)), theirs = new Set(pacts.filter(p => p.b === ctx.user.id).map(p => p.a));
    return {
      me: ctx.user.id,
      realms: rows.map(x => ({ id: x.user_id, handle: x.handle, name: x.name, land: x.land, networth: x.networth,
        protected: x.prot === 1 && x.years < PROTECT_YEARS, ally: mine.has(x.user_id) && theirs.has(x.user_id),
        offered: mine.has(x.user_id) && !theirs.has(x.user_id), offeredMe: theirs.has(x.user_id) && !mine.has(x.user_id) })),
      networth: r ? netWorth(r) : 0,
    };
  }
  if (action === "enter") {
    const top = await db.prepare("SELECT name, handle, networth, land FROM bde_realms ORDER BY networth DESC LIMIT 1").first();
    const count = await db.prepare("SELECT COUNT(*) n FROM bde_realms").first();
    const r = await load(ctx);
    if (!r) return { realm: null, top, count: count.n };
    const reps = (await db.prepare("SELECT at, text FROM bde_reports WHERE user_id = ? AND seen = 0 ORDER BY id LIMIT 20").bind(r.user_id).all()).results;
    await save(ctx, r, [db.prepare("UPDATE bde_reports SET seen = 1 WHERE user_id = ? AND seen = 0").bind(r.user_id)]);
    return { realm: view(r), top, count: count.n, reports: reps };
  }
  if (action === "create") {
    if (await load(ctx)) ctx.fail("You already rule a realm.");
    const name = ctx.clean(body.name, 24);
    if (name.length < 2) ctx.fail("Your realm needs a name (2-24 characters).");
    const taken = await db.prepare("SELECT 1 FROM bde_realms WHERE name = ? COLLATE NOCASE").bind(name).first();
    if (taken) ctx.fail("Another realm already goes by that name.");
    const r = {
      user_id: ctx.user.id, handle: ctx.user.handle, name, day: today(t), turns: TURNS_PER_DAY, years: 0, prot: 1,
      land: 250, farms: 45, outhouses: 20, bunks: 8, towers: 4, thrones: 0,
      peasants: 2000, food: 4000, gold: 8000, tax: 20, plungers: 200, slingers: 80, wagons: 0, sniffers: 4,
      spy_day: today(t), spies: 0,
    };
    await db.batch([
      db.prepare("INSERT INTO bde_realms (user_id, handle, name, created_at, last_seen, day, turns, years, prot, land, farms, outhouses, bunks, towers, thrones, peasants, food, gold, tax, plungers, slingers, wagons, sniffers, spy_day, spies, networth) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(r.user_id, r.handle, r.name, t, t, r.day, r.turns, 0, 1, r.land, r.farms, r.outhouses, r.bunks, r.towers, r.thrones,
          r.peasants, r.food, r.gold, r.tax, r.plungers, r.slingers, r.wagons, r.sniffers, r.spy_day, 0, netWorth(r)),
      news(ctx, `${r.handle} founded the realm of ${name}. The neighbors hold their noses.`),
    ]);
    return { realm: view(r) };
  }

  const r = await load(ctx);
  if (!r) ctx.fail("You don't rule a realm yet.", 404);

  switch (action) {
    case "status": { await save(ctx, r); return { realm: view(r) }; }

    case "year": {
      needTurn(ctx, r);
      const extra = [];
      let found = 0, cost = 0;
      const y = runYear(r);
      if (body.mode === "explore") {
        found = 10 + rnd(0, 10) + Math.floor(r.land / 40);
        found = Math.min(found, Math.floor(r.gold / 30));
        cost = found * 30; r.gold -= cost; r.land += found;
        y.explored = found; y.exploreCost = cost;
      }
      if (y.event && Math.random() < 0.3) extra.push(news(ctx, `${r.name}: ${y.event}`));
      await save(ctx, r, extra);
      return { realm: view(r), year: y };
    }

    case "build": {
      const kind = BUILD[body.kind] ? body.kind : null;
      if (!kind) ctx.fail("Build what?");
      const n = int(body.n), max = Math.min(freeLand(r), Math.floor(r.gold / BUILD[kind].cost));
      if (n < 1) ctx.fail("Build how many?");
      if (n > max) ctx.fail(freeLand(r) < n ? "You don't have that much open land." : "You can't afford that many.");
      r[kind] += n; r.gold -= n * BUILD[kind].cost;
      const extra = [];
      if (kind === "thrones") extra.push(news(ctx, `${r.handle} raised ${n === 1 ? "a Porcelain Throne" : n + " Porcelain Thrones"} in ${r.name}. Its subjects are unsure why.`));
      await save(ctx, r, extra);
      return { realm: view(r), msg: `Built ${fmt(n)} ${BUILD[kind].name} for ${fmt(n * BUILD[kind].cost)} gold.` };
    }

    case "recruit": {
      const kind = UNITS[body.kind] ? body.kind : null;
      if (!kind) ctx.fail("Recruit what?");
      const u = UNITS[kind], n = int(body.n);
      if (n < 1) ctx.fail("Recruit how many?");
      if (n * u.cost > r.gold) ctx.fail("You can't afford that many.");
      if (r.peasants - n * u.crew < 100) ctx.fail("You don't have enough peasants to spare. Keep at least 100 at home.");
      r[kind] += n; r.gold -= n * u.cost; r.peasants -= n * u.crew;
      await save(ctx, r);
      return { realm: view(r), msg: `${fmt(n)} ${u.name} recruited for ${fmt(n * u.cost)} gold.` };
    }

    case "disband": {
      const kind = UNITS[body.kind] ? body.kind : null;
      if (!kind) ctx.fail("Disband what?");
      const n = Math.min(int(body.n), r[kind]);
      if (n < 1) ctx.fail("Disband how many?");
      r[kind] -= n; r.peasants += n * UNITS[kind].crew;
      await save(ctx, r);
      return { realm: view(r), msg: `${fmt(n)} ${UNITS[kind].name} went home to their families.` };
    }

    case "market": {
      const n = int(body.n);
      if (n < 1) ctx.fail("How many bushels?");
      if (body.op === "buy") {
        if (n * PRICE.buy > r.gold) ctx.fail("You can't afford that much.");
        r.food += n; r.gold -= n * PRICE.buy;
      } else if (body.op === "sell") {
        if (n > r.food) ctx.fail("You don't have that much food.");
        r.food -= n; r.gold += n * PRICE.sell;
      } else ctx.fail("Buy or sell?");
      await save(ctx, r);
      return { realm: view(r), msg: (body.op === "buy" ? "Bought " : "Sold ") + fmt(n) + " bushels." };
    }

    case "tax": {
      const rate = Math.trunc(+body.rate);
      if (!(rate >= 0 && rate <= 50)) ctx.fail("Tax rate must be 0 to 50 percent.");
      r.tax = rate;
      await save(ctx, r);
      return { realm: view(r), msg: "Tax rate set to " + rate + "%." };
    }

    case "attack": {
      needTurn(ctx, r);
      const v = await target(ctx, r, body.target);
      const d = today(t);
      if (await allied(ctx, r.user_id, v.user_id)) ctx.fail("You have a pact with " + v.name + ". Break it first.");
      if (isProtected(v)) ctx.fail(v.name + " is still under the protection of the Plumbers' Guild (" + (PROTECT_YEARS - v.years) + " years left).");
      if (v.hit_day === d && v.hits >= HITS_PER_DAY) ctx.fail(v.name + " has been hit enough today. Even barbarians have rules.");
      if (v.networth < netWorth(r) * 0.2) ctx.fail(v.name + " is beneath your notice. Pick on someone your own size.");
      const pct = [25, 50, 75, 100].includes(+body.pct) ? +body.pct : 50;
      const sent = { plungers: Math.floor(r.plungers * pct / 100), slingers: Math.floor(r.slingers * pct / 100), wagons: Math.floor(r.wagons * pct / 100) };
      if (sent.plungers + sent.slingers + sent.wagons < 1) ctx.fail("You have no army to send.");

      const y = runYear(r);
      const off = (sent.plungers * UNITS.plungers.off + sent.slingers * UNITS.slingers.off + sent.wagons * UNITS.wagons.off) * morale(r) * frand(0.85, 1.15);
      const def = defense(v) * frand(0.85, 1.15);
      const win = off > def;
      const res = { win, off: Math.round(off), def: Math.round(def), year: y, sent, target: v.name };
      const lossA = {}, lossD = {};
      const aRate = win ? frand(0.03, 0.08) : frand(0.1, 0.2), dRate = win ? frand(0.06, 0.12) : frand(0.02, 0.05);
      for (const k of ["plungers", "slingers", "wagons"]) {
        lossA[k] = Math.ceil(sent[k] * aRate); r[k] -= lossA[k];
        lossD[k] = Math.ceil(v[k] * dRate);
      }
      res.lossA = lossA; res.lossD = lossD;
      const vset = { plungers: -lossD.plungers, slingers: -lossD.slingers, wagons: -lossD.wagons, land: 0, farms: 0, outhouses: 0, bunks: 0, towers: 0, thrones: 0, gold: 0, food: 0 };
      if (win) {
        const ratio = Math.min(1.5, off / def);
        let take = Math.max(1, Math.floor(v.land * 0.06 * ratio));
        take = Math.min(take, Math.max(0, v.land - MIN_LAND));
        // Land comes off proportionally: some open, some with buildings still standing on it.
        const took = {};
        let left = take;
        for (const k of ["farms", "outhouses", "bunks", "towers", "thrones"]) {
          const n = Math.min(v[k], Math.floor(take * v[k] / v.land));
          took[k] = n; left -= n; r[k] += n; vset[k] = -n;
        }
        r.land += take; vset.land = -take;
        const gold = Math.floor(v.gold * 0.1 * ratio), food = Math.floor(v.food * 0.1);
        r.gold += gold; r.food += food; vset.gold = -gold; vset.food = -food;
        res.took = took; res.land = take; res.gold = gold; res.food = food;
      }
      r.prot = 0;
      const lostStr = l => [l.plungers && fmt(l.plungers) + " Plungermen", l.slingers && fmt(l.slingers) + " Slingers", l.wagons && fmt(l.wagons) + " Honey Wagons"].filter(Boolean).join(", ") || "nobody";
      const victimText = win
        ? `${r.name} (${r.handle}) attacked and won. You lost ${fmt(res.land)} acres, ${fmt(res.gold)} gold, ${fmt(res.food)} bushels, and ${lostStr(lossD)}.`
        : `${r.name} (${r.handle}) attacked and was driven off. You lost ${lostStr(lossD)}. They lost ${lostStr(lossA)}.`;
      const newsText = win
        ? `${r.name} stormed ${v.name} and seized ${fmt(res.land)} acres!`
        : `${r.name} attacked ${v.name} and got flushed back across the border.`;
      const cols = Object.keys(vset);
      const upd = db.prepare("UPDATE bde_realms SET " + cols.map((c, i) => `${c} = MAX(0, ${c} + ?${i + 1})`).join(", ") +
        `, hits = CASE WHEN hit_day = ?${cols.length + 1} THEN hits + 1 ELSE 1 END, hit_day = ?${cols.length + 1}, ver = ver + 1 WHERE user_id = ?${cols.length + 2}`)
        .bind(...cols.map(c => vset[c]), d, v.user_id);
      const upNw = db.prepare("UPDATE bde_realms SET networth = ?1 WHERE user_id = ?2").bind(netWorth({ ...v, ...Object.fromEntries(cols.map(c => [c, Math.max(0, v[c] + vset[c])])) }), v.user_id);
      await save(ctx, r, [upd, upNw, report(ctx, v.user_id, victimText), news(ctx, newsText)]);
      return { realm: view(r), battle: res };
    }

    case "spy": {
      if (r.sniffers < 1) ctx.fail("You have no Sniffers to send.");
      if (r.spies >= SPIES_PER_DAY) ctx.fail("Your Sniffers have had enough for one day.");
      const v = await target(ctx, r, body.target);
      r.spies++;
      const ok = Math.random() < successChance(r.sniffers, v.sniffers);
      if (!ok) {
        r.sniffers--;
        await save(ctx, r, [report(ctx, v.user_id, `Your guards caught a Sniffer from ${r.name} (${r.handle}) lurking behind the outhouses.`)]);
        return { realm: view(r), caught: true, target: v.name };
      }
      await save(ctx, r);
      const fz = n => Math.round(n * frand(0.95, 1.05));
      return {
        realm: view(r), target: v.name, intel: {
          name: v.name, handle: v.handle, years: v.years, land: v.land, peasants: fz(v.peasants), food: fz(v.food), gold: fz(v.gold),
          farms: v.farms, outhouses: v.outhouses, bunks: v.bunks, towers: v.towers, thrones: v.thrones,
          plungers: fz(v.plungers), slingers: fz(v.slingers), wagons: fz(v.wagons), sniffers: fz(v.sniffers),
          networth: v.networth, protected: isProtected(v), tax: v.tax,
        },
      };
    }

    case "sabotage": {
      needTurn(ctx, r);
      if (r.sniffers < 2) ctx.fail("Sabotage takes at least 2 Sniffers.");
      const v = await target(ctx, r, body.target);
      if (await allied(ctx, r.user_id, v.user_id)) ctx.fail("You have a pact with " + v.name + ".");
      if (isProtected(v)) ctx.fail(v.name + " is under the Plumbers' Guild's protection.");
      const y = runYear(r);
      const ok = Math.random() < successChance(r.sniffers, v.sniffers, 0.8);
      const extra = [];
      let msg;
      if (!ok) {
        const lost = Math.min(r.sniffers, rnd(1, 2)); r.sniffers -= lost;
        msg = `Your Sniffers were caught. ${lost} of them won't be coming back.`;
        extra.push(report(ctx, v.user_id, `Your guards foiled a plot by ${r.name} (${r.handle}) and caught ${lost} Sniffer${lost > 1 ? "s" : ""}.`));
      } else {
        const kind = rnd(0, 2);
        let what;
        if (kind === 0 || (kind === 1 && !v.outhouses) || (kind === 2 && !v.towers)) {
          const n = Math.floor(v.food * frand(0.1, 0.25));
          extra.push(db.prepare("UPDATE bde_realms SET food = MAX(0, food - ?), ver = ver + 1 WHERE user_id = ?").bind(n, v.user_id));
          what = `spoiled ${fmt(n)} bushels of food`;
        } else if (kind === 1) {
          const n = Math.min(v.outhouses, rnd(1, 3));
          extra.push(db.prepare("UPDATE bde_realms SET outhouses = MAX(0, outhouses - ?), ver = ver + 1 WHERE user_id = ?").bind(n, v.user_id));
          what = `clogged ${n} Pay Outhouse${n > 1 ? "s" : ""} beyond repair`;
        } else {
          extra.push(db.prepare("UPDATE bde_realms SET towers = MAX(0, towers - 1), ver = ver + 1 WHERE user_id = ?").bind(v.user_id));
          what = "toppled a Stink Tower";
        }
        msg = `Your Sniffers ${what} in ${v.name}.`;
        extra.push(report(ctx, v.user_id, `Saboteurs ${what}. Nobody saw who did it.`));
        extra.push(news(ctx, `Saboteurs ${what} in ${v.name}. ${r.name} denies everything.`));
      }
      await save(ctx, r, extra);
      return { realm: view(r), ok, msg, year: y };
    }

    case "pact": {
      const v = await target(ctx, r, body.target);
      if (body.op === "offer") {
        await db.prepare("INSERT OR IGNORE INTO bde_pacts (a, b, at) VALUES (?, ?, ?)").bind(r.user_id, v.user_id, t).run();
        const both = await allied(ctx, r.user_id, v.user_id);
        const extra = both
          ? [news(ctx, `${r.name} and ${v.name} signed a pact of mutual non-flushing.`), report(ctx, v.user_id, `${r.name} accepted your pact. You are now allies.`)]
          : [report(ctx, v.user_id, `${r.name} (${r.handle}) offers you a pact. Accept it from the Pacts screen.`)];
        await save(ctx, r, extra);
        return { realm: view(r), msg: both ? "You and " + v.name + " are now allies." : "Pact offered to " + v.name + "." };
      }
      if (body.op === "break") {
        const was = await allied(ctx, r.user_id, v.user_id);
        await save(ctx, r, [
          db.prepare("DELETE FROM bde_pacts WHERE (a = ?1 AND b = ?2) OR (a = ?2 AND b = ?1)").bind(r.user_id, v.user_id),
          ...(was ? [news(ctx, `${r.name} tore up its pact with ${v.name}.`), report(ctx, v.user_id, `${r.name} broke its pact with you. Watch your borders.`)] : []),
        ]);
        return { realm: view(r), msg: was ? "Pact with " + v.name + " broken." : "Offer withdrawn." };
      }
      ctx.fail("Offer or break?");
    }
  }
  ctx.fail("Unknown command.", 404);
}
