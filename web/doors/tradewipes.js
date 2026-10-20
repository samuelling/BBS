// Trade Wipes 2002 — shared-universe space trading. The universe and every rule live on the
// board (worker/doors/tradewipes.js); this file just draws it and asks questions.
DOOR.tradewipes = async function () {
  const GOODS = ["Paper", "Soap", "Plungers"];
  const TITLE = [
    String.raw`  ______               __        _       ___`,
    String.raw` /_  __/________ _____/ /__     | |     / (_)___  ___  _____`,
    String.raw`  / / / ___/ __ ${"`"}/ __  / _ \    | | /| / / / __ \/ _ \/ ___/`,
    String.raw` / / / /  / /_/ / /_/ /  __/    | |/ |/ / / /_/ /  __(__  )`,
    String.raw`/_/ /_/   \__,_/\__,_/\___/     |__/|__/_/ .___/\___/____/`,
    String.raw`                                        /_/`,
  ];
  const SHIPART = [
    String.raw`|08    .        *          .        .        *       .         .`,
    String.raw`|07            __________________________`,
    String.raw`|07       ____/  |15o   o   o   o   o   o|07   \____               |08*`,
    String.raw`|07      |  |12TP-2002|07                           ||14>==-  -   -`,
    String.raw`|07       \___________________________________/|08          .`,
    String.raw`|08  *          .         .                .        *`,
  ];
  const n = x => Math.round(x).toLocaleString("en-US");
  const tw = (a, b) => api("door/tradewipes/" + a, b || {});
  let ME = null, V = null, DOCK = 0;

  // Board errors ("out of turns", "no warp there") are part of play: show them and carry on.
  async function attempt(fn) {
    try { return await fn(); }
    catch (e) {
      if (e instanceof BoardError) { await out("\n|12" + esc(e.message) + "|07\n"); return null; }
      throw e;
    }
  }
  // A blank answer means the default; prefill puts it in the edit line instead (for typed-ahead digits).
  async function ask(prompt, def, max = 9, prefill = false) {
    await out(prompt);
    const s = (await readLine({ max, value: prefill ? String(def) : "" })).trim();
    return s || (prefill || def === undefined || def === null ? s : String(def));
  }
  async function yn(q) {
    await out(q + " |08({Y}/{N})|07 ");
    const k = await readKey("YN", { enter: "N" });
    await out(k === "Y" ? "Yes\n" : "No\n");
    return k === "Y";
  }
  const num = s => { const v = parseInt(String(s).replace(/,/g, ""), 10); return Number.isFinite(v) ? v : NaN; };

  // ---------------------------------------------------------------- title and entry
  cls();
  await out(TITLE.map((l, i) => (i < 3 ? "|11" : "|03") + l).join("\n") + "\n");
  await out("|14" + " ".repeat(46) + "2 0 0 2\n");
  await out(SHIPART.join("\n") + "\n");
  await out("|08 An original game of trade, toilets and treachery in a universe of 300 sectors.\n");
  const e = await tw("enter");
  ME = e.me; V = e.view; DOCK = e.dock;
  if (e.isNew) {
    await out("\n|10 The Flush Federation issues you a |15" + esc(ME.ship) + "|10, " + ME.holds + " cargo holds, " + ME.fighters + " fighters\n" +
      " and " + n(ME.credits) + " credits. Buy " + GOODS.join(", ") + " where they're cheap, sell them where\n" +
      " they're not. The shipyard is in sector " + DOCK + ". Federation space (sectors 1-10) is safe;\n" +
      " beyond it, anyone can jump a parked ship.|07\n");
  } else {
    await out("\n|07 Welcome back, |14" + esc(ME.handle) + "|07. |11" + ME.turns + "|07 turns left today.\n");
  }
  if (e.away && e.away.length) {
    await out("\n|15 While you were away...\n");
    for (const x of e.away) await out("|08 " + d8(x.at) + " |07" + uc(x.text) + "\n");
  }
  await anyKey();

  // ---------------------------------------------------------------- the sector display
  async function showSector() {
    const v = V;
    let s = "\n|10Sector  |14: |11" + v.sector + " |02in |10" + esc(v.region) + (v.fed ? " |08(Federation space: no combat)" : "") + "\n";
    if (v.home) s += "|10Beacon  |14: |15Flush Federation HQ. Please wash your hands.\n";
    if (v.dock) s += "|10Port    |14: |15Porcelain Dock|07, the shipyard |08(press P)\n";
    if (v.port) s += "|10Port    |14: |11" + esc(v.port.name) + "|02, Class |14" + v.port.class + " |02(|13" + v.port.pattern + "|02)\n";
    if (v.planets.length) s += v.planets.map((p, i) => (i ? "          " : "|10Planets |14: ") + "|15" + esc(p.name) + "|02, owned by |14" + (p.mine ? "you" : esc(p.owner))).join("\n") + "\n";
    if (v.traders.length) s += v.traders.map((t, i) => (i ? "          " : "|10Traders |14: ") + "|14" + esc(t.handle) + "|02, w/ |11" + n(t.fighters) + "|02 ftrs in a |15" + esc(t.ship) + (t.online ? " |10(flying)" : " |08(parked)")).join("\n") + "\n";
    if (v.fighters) s += "|10Fighters|14: |11" + n(v.fighters.count) + " |02(" + (v.fighters.mine ? "yours, defensive" : "belonging to |14" + esc(v.fighters.owner) + "|02") + ")\n";
    s += "|10Warps to Sector(s) |14: " + v.warps.map(w => w.seen ? "|11" + w.s : "|08(|11" + w.s + "|08)").join(" |02- ") + "\n";
    await out(s);
  }
  const menuBar = "|08{M}|07ove {P}|07ort {C}|07omputer {F}|07ighters {A}|07ttack {L}|07and {I}|07nfo {Q}|07uit";
  async function prompt() {
    await out("\n|05Command |08[|14TL=" + ME.turns + "|08]|07:|08[|11" + V.sector + "|08] |07(?=Help)? : ");
    return readKey("MPCFALIQD?0123456789");
  }

  // ---------------------------------------------------------------- moving
  async function warpTo(dest) {
    const to = num(dest);
    if (!(to >= 1 && to <= 300)) { await out("|12Sectors run from 1 to 300.\n"); return; }
    if (to === V.sector) { await out("|07You're already in sector " + to + ".\n"); return; }
    if (V.warps.some(w => w.s === to)) {
      const r = await attempt(() => tw("move", { to }));
      if (!r) return;
      ME = r.me; V = r.view;
      await out("|08<|07Warping to sector " + to + "|08>\n");
      for (const ev of r.events) await out(uc(ev) + "\n");
      await showSector();
      return;
    }
    const p = await attempt(() => tw("plot", { to }));
    if (!p) return;
    await out("|07That sector isn't adjacent. The computer plots |14" + (p.path.length - 1) + "|07 hops, |14" + p.turns + "|07 turns:\n|11" +
      wrap(p.path.join(" > "), 76) + "\n");
    if (!(await yn("|07Engage the autopilot?"))) return;
    const r = await attempt(() => tw("auto", { to }));
    if (!r) return;
    ME = r.me; V = r.view;
    if (r.hops.length) await out("|08<|07Auto-warping: |11" + r.hops.join(" |08>|11 ") + "|08>\n");
    for (const ev of r.events) await out(uc(ev) + "\n");
    await showSector();
  }

  // ---------------------------------------------------------------- trading
  const QUIPS_COUNTER = ["Hmm. How about", "You drive a hard bargain. Fine:", "We could maybe do", "Our accountant weeps, but", "Let me flush that number. Try"];
  const QUIPS_REFUSE = ["We're not interested. Get out of my port!", "That's an insult to porcelain everywhere. Go away.", "Ha! Come back when you're serious.", "Security! Show this one out."];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  async function haggle(good, qty, mode) {
    const q = await attempt(() => tw("quote", { good, qty }));
    if (!q) return;
    let price = q.quote;
    await out("|02We'll " + (mode === "buy" ? "sell" : "buy") + " them for |14" + n(price) + "|02 credits.\n");
    while (true) {
      const s = await ask("|07Your offer |08[|14" + n(price) + "|08]|07 ? |15", "", 9);
      const offer = s ? num(s) : price;
      if (!(offer > 0)) { await out("|12A number, please.\n"); continue; }
      const r = await attempt(() => tw("offer", { price: offer }));
      if (!r) return;
      ME = r.me;
      if (r.result === "accept") {
        await out("|10Agreed, |14" + n(r.price) + "|10 credits. " + (mode === "buy" ? "We'll load them into your holds." : "Unloading your " + GOODS[good] + "...") + "\n");
        if (r.xp) await out("|11For your good trading you receive |14" + r.xp + "|11 experience point" + (r.xp > 1 ? "s" : "") + ".\n");
        await out("|07You have |14" + n(ME.credits) + "|07 credits and |14" + (ME.holds - ME.cargo.reduce((a, b) => a + b)) + "|07 empty holds.\n");
        return;
      }
      if (r.result === "refuse") { await out("|12" + pick(QUIPS_REFUSE) + "\n"); return; }
      price = r.price;
      await out("|02" + pick(QUIPS_COUNTER) + " |14" + n(price) + "|02?\n");
    }
  }
  async function trade() {
    if (V.dock) return shipyard();
    if (!V.port) { await out("|07There's no port in this sector.\n"); return; }
    const r = await attempt(() => tw("port"));
    if (!r) return;
    ME = r.me;
    const P = r.port;
    await out("\n|08Docking...\n|10Commerce report for |11" + esc(P.name) + "|10: " + d8(Date.now()) + " " + hm(Date.now()) + "\n\n" +
      "|02 Items      Status    Trading  % of max  OnBoard\n |08-----      ------    -------  --------  -------\n");
    for (const [i, it] of P.items.entries()) await out("|11 " + pad(it.good, 11) + (it.mode === "buying" ? "|10Buying  " : "|13Selling ") + "|14" + lpad(n(it.qty), 9) + lpad(it.pct + "%", 10) + "|11" + lpad(ME.cargo[i], 9) + "\n");
    await out("\n|07You have |14" + n(ME.credits) + "|07 credits and |14" + (ME.holds - ME.cargo.reduce((a, b) => a + b)) + "|07 empty cargo holds.\n");
    // Sell first, then buy, like the old ports did it.
    for (const pass of ["buying", "selling"]) {
      for (let i = 0; i < 3; i++) {
        const it = P.items[i];
        if (it.mode !== pass || !it.qty) continue;
        const free = ME.holds - ME.cargo.reduce((a, b) => a + b);
        if (pass === "buying") {
          if (!ME.cargo[i]) continue;
          const def = Math.min(ME.cargo[i], it.qty);
          await out("\n|02We are buying up to |14" + n(it.qty) + "|02. You have |14" + ME.cargo[i] + "|02 in your holds.\n");
          const s = await ask("|07How many holds of |11" + it.good + "|07 do you want to sell |08[|14" + def + "|08]|07? |15");
          const q = s === "" ? def : num(s);
          if (q > 0) await haggle(i, q, "sell");
        } else {
          if (!free) continue;
          const afford = Math.floor(ME.credits / Math.max(1, it.unit));
          const def = Math.max(0, Math.min(free, it.qty, afford));
          await out("\n|02We are selling up to |14" + n(it.qty) + "|02. You have |14" + free + "|02 empty holds.\n");
          const s = await ask("|07How many holds of |11" + it.good + "|07 do you want to buy |08[|14" + def + "|08]|07? |15");
          const q = s === "" ? def : num(s);
          if (q > 0) await haggle(i, q, "buy");
        }
      }
    }
    await out("\n|08You undock.\n");
  }

  // ---------------------------------------------------------------- the shipyard
  async function shipyard() {
    let r = await attempt(() => tw("yard"));
    if (!r) return;
    while (true) {
      ME = r.me; const Y = r.yard;
      cls();
      await out("|15 Porcelain Dock |08- shipyard of the Flush Federation, sector " + V.sector + "\n" + rule(8) +
        "|07 Ship |15" + esc(ME.ship) + "|07   Credits |14" + n(ME.credits) + "\n" +
        "|07 Holds |14" + ME.holds + "|08/" + ME.maxHolds + "|07   Fighters |14" + n(ME.fighters) + "|08/" + n(ME.maxF) +
        "|07   Shields |14" + n(ME.shields) + "|08/" + n(ME.maxS) + "|07   Torpedoes |14" + ME.torps + "\n\n" +
        "|07 {H} Cargo holds       |14" + lpad(n(Y.hold), 7) + "|07 each (price climbs as you add more)\n" +
        "|07 {F} Fighters          |14" + lpad(n(Y.fighter), 7) + "|07 each\n" +
        "|07 {S} Shield points     |14" + lpad(n(Y.shield), 7) + "|07 each\n" +
        "|07 {T} Flushbang torpedo |14" + lpad(n(Y.torp), 7) + "|07 makes a planet (you carry " + ME.torps + " of " + Y.maxTorps + ")\n" +
        "|07 {N} New ship\n|07 {Q} Leave the dock\n\n|08Your choice: |07");
      const k = await readKey("HFSTNQ");
      if (k === "Q") { cls(); await showSector(); return; }
      let res = null;
      if (k === "N") {
        await out("\n\n|02     Ship                     Holds  Max ftrs  Max shlds  T/W      Price\n");
        for (const s of Y.ships) await out((s.yours ? "|14" : "|07") + " " + (s.id ? "{" + s.id + "} " : "    ") + pad(s.name, 22) + lpad(s.baseHolds + "/" + s.maxHolds, 8) +
          lpad(n(s.maxF), 10) + lpad(n(s.maxS), 11) + lpad(s.tpw, 5) + lpad(s.yours ? "yours" : s.price === null ? "-" : n(s.price), 11) + "\n");
        await out("|08 Price includes trade-in. Fighters, shields and cargo carry over where they fit.\n|07Which ship? |08({Q} cancel)|07 ");
        const c = await readKey("123Q");
        if (c === "Q") continue;
        res = await attempt(() => tw("buy", { item: "ship", ship: +c }));
        if (res) await out("\n|10Sold! You take the keys to your new |15" + esc(res.bought) + "|10.\n");
      } else {
        const item = { H: "holds", F: "fighters", S: "shields", T: "torps" }[k];
        const s = await ask("\n\n|07How many " + { holds: "cargo holds", fighters: "fighters", shields: "shield points", torps: "torpedoes" }[item] + "? |15", "", 6);
        const q = num(s);
        if (!(q > 0)) continue;
        res = await attempt(() => tw("buy", { item, qty: q }));
        if (res) await out("|10Done. That's |14" + n(res.cost) + "|10 credits.\n");
      }
      if (res) r = res;
      await anyKey();
    }
  }

  // ---------------------------------------------------------------- the computer
  async function computer() {
    while (true) {
      await out("\n|15<Computer activated>\n|07 {P} Plot a course   {N} Nearest port for a commodity   {R} Port report\n" +
        "|07 {K} Rankings        {L} Daily log of the universe      {Q} Shut down\n|05Computer command|07? ");
      const k = await readKey("PNRKLQ");
      await out("\n");
      if (k === "Q") { await out("|08<Computer deactivated>\n"); return; }
      if (k === "P") {
        const to = num(await ask("|07Plot a course to which sector? |15", "", 3));
        if (!(to > 0)) continue;
        const p = await attempt(() => tw("plot", { to }));
        if (p) {
          await out("|07The shortest path is |14" + (p.path.length - 1) + "|07 hops, |14" + p.turns + "|07 turns:\n|11" + wrap(p.path.join(" > "), 76) + "\n");
          if (await yn("|07Engage the autopilot?")) { await warpTo(String(to)); return; }
        }
      }
      if (k === "N") {
        await out("|07Commodity: {1} Paper  {2} Soap  {3} Plungers ");
        const g = +(await readKey("123")) - 1;
        await out(GOODS[g] + "\n|07Find a port that will {B} sell it to you, or {S} buy it from you? ");
        const m = await readKey("BS");
        const r = await attempt(() => tw("nearest", { good: g, want: m === "S" ? "sell" : "buy" }));
        if (r) await out("\n|07Nearest: |11" + esc(r.port.name) + "|07 (|13" + r.port.pattern + "|07) in sector |14" + r.port.sector + "|07, " + (r.path.length - 1) + " hops:\n|11" + wrap(r.path.join(" > "), 76) + "\n");
      }
      if (k === "R") {
        const s = num(await ask("|07Port report for which sector? |15", "", 3));
        if (!(s > 0)) continue;
        const r = await attempt(() => tw("port/info", { sector: s }));
        if (r) {
          await out("|11" + esc(r.port.name) + "|07, sector " + r.port.sector + ", class " + r.port.class + " (|13" + r.port.pattern + "|07)\n");
          for (const it of r.port.items) await out("|07  " + pad(it.good, 10) + (it.mode === "buying" ? "|10buying  " : "|13selling ") + "|14" + lpad(n(it.qty), 7) + lpad(it.pct + "%", 6) + "|07  about |14" + it.unit + "|07 a unit\n");
        }
      }
      if (k === "K") await rankings();
      if (k === "L") await dailyLog();
    }
  }
  async function rankings() {
    const r = await attempt(() => tw("rank"));
    if (!r) return;
    await out("\n|15 Top traders by net worth\n|02  #  Trader                 Net worth  Ship                    Kills Planets\n");
    for (const [i, x] of r.rows.entries()) await out((x.you ? "|14" : "|07") + lpad(i + 1, 3) + "  " + pad(esc(x.handle), 20) + lpad(n(x.worth), 11) + "  " + pad(esc(x.ship), 22) + lpad(x.kills, 6) + lpad(x.planets, 8) + "\n");
  }
  async function dailyLog() {
    const r = await attempt(() => tw("news"));
    if (!r) return;
    await out("\n|15 The Trade Wipes Gazette\n");
    if (!r.rows.length) await out("|08 Nothing has happened yet. Make some news.\n");
    for (const x of r.rows.slice().reverse()) await out("|08 " + d8(x.at) + " " + hm(x.at) + " |07" + uc(x.text) + "\n");
  }

  // ---------------------------------------------------------------- fighters, attacks, planets
  async function fighters() {
    if (V.fed) { await out("|07The Federation doesn't allow fighters in its space.\n"); return; }
    if (V.fighters && !V.fighters.mine) { await out("|07" + esc(V.fighters.owner) + "'s fighters hold this sector. Clear them first.\n"); return; }
    const here = V.fighters && V.fighters.mine ? V.fighters.count : 0;
    await out("|07You have |14" + n(ME.fighters) + "|07 fighters aboard and |14" + n(here) + "|07 guarding this sector.\n");
    const s = await ask("|07How many fighters should guard this sector? |08[|14" + here + "|08]|07 |15", here, 6);
    const q = num(s);
    if (!(q >= 0)) return;
    const r = await attempt(() => tw("fighters", { leave: q }));
    if (!r) return;
    ME = r.me;
    const v = await tw("view"); V = v.view;
    await out(q ? "|10" + n(q) + " fighters take up positions. They'll greet anyone who drops by.\n" : "|07Your fighters come back aboard.\n");
  }
  async function attack() {
    if (V.fed) { await out("|07Combat in Federation space? The Feds would have your license.\n"); return; }
    const T = [];
    for (const t of V.traders) T.push({ kind: "ship", target: t.id, label: esc(t.handle) + "'s " + esc(t.ship) + " (" + n(t.fighters) + " ftrs" + (t.online ? ", flying" : ", parked") + ")" });
    if (V.fighters && !V.fighters.mine) T.push({ kind: "fighters", label: n(V.fighters.count) + " fighters belonging to " + esc(V.fighters.owner) });
    for (const p of V.planets) if (!p.mine) T.push({ kind: "planet", target: p.id, label: "the planet " + esc(p.name) + ", owned by " + esc(p.owner) });
    if (!T.length) { await out("|07Nothing here to attack.\n"); return; }
    if (!ME.fighters) { await out("|07You have no fighters to send. The shipyard sells them.\n"); return; }
    await out("|12Targets in sector " + V.sector + ":\n");
    for (const [i, t] of T.slice(0, 9).entries()) await out("|07 {" + (i + 1) + "} " + t.label + "\n");
    await out("|07 {Q} Never mind\n|12Attack which? |07");
    const k = await readKey("123456789".slice(0, Math.min(9, T.length)) + "Q");
    if (k === "Q") return;
    const t = T[+k - 1];
    const s = await ask("\n|07You have |14" + n(ME.fighters) + "|07 fighters. How many will you send? |08[|14" + ME.fighters + "|08]|07 |15", ME.fighters, 6);
    const send = num(s);
    if (!(send > 0)) return;
    await out("|12Launching fighters...\n");
    await sleep(600);
    const r = await attempt(() => tw("attack", { kind: t.kind, target: t.target, send }));
    if (!r) return;
    ME = r.me; V = r.view;
    for (const ev of r.events) await out(uc(ev) + "\n");
  }
  async function land() {
    const mine = V.planets;
    await out("|10Planets in sector " + V.sector + ":\n");
    if (!mine.length) await out("|08 none\n");
    for (const [i, p] of mine.slice(0, 3).entries()) await out("|07 {" + (i + 1) + "} |15" + esc(p.name) + "|07, owned by |14" + (p.mine ? "you" : esc(p.owner)) + "\n");
    if (ME.torps) await out("|07 {T} Launch a Flushbang torpedo here (you have " + ME.torps + ")\n");
    await out("|07 {Q} Never mind\n|10Your choice? |07");
    const k = await readKey("123".slice(0, mine.length) + (ME.torps ? "T" : "") + "Q");
    await out("\n");
    if (k === "Q") return;
    if (k === "T") {
      const name = await ask("|07Name your new planet: |15", "", 24);
      if (!name.trim()) return;
      const r = await attempt(() => tw("planet/create", { name }));
      if (!r) return;
      ME = r.me; V = r.view;
      await out("|14The torpedo spirals into the void... a gurgle... a burp... and |15" + esc(r.name) + "|14 bubbles into existence!\n" +
        "|07Two thousand colonists, who were promised a nicer place, start making goods.\n");
      return;
    }
    let r = await attempt(() => tw("planet/land", { id: mine[+k - 1].id }));
    while (r) {
      ME = r.me; const P = r.planet;
      await out("\n|15Planet " + esc(P.name) + "|07   Colonists |14" + n(P.colonists) + "|07   Fighters |14" + n(P.fighters) + "\n" +
        "|07Stockpiles: " + GOODS.map((g, i) => g + " |14" + n(P.goods[i]) + "|07").join("  ") + "   |08(makes " + n(P.make) + " of each a day)\n" +
        "|07 {T} Take goods aboard   {F} Set planet fighters   {Q} Lift off\n|10Planet command? |07");
      const c = await readKey("TFQ");
      await out("\n");
      if (c === "Q") { await out("|08You lift off.\n"); return; }
      if (c === "T") {
        const free = () => ME.holds - ME.cargo.reduce((a, b) => a + b);
        const take = [0, 0, 0];
        let room = free();
        for (let i = 0; i < 3; i++) {
          if (!P.goods[i] || !room) continue;
          const def = Math.min(P.goods[i], room);
          const q = num(await ask("|07Take how much |11" + GOODS[i] + "|07? |08[|14" + def + "|08]|07 |15", "", 6) || def);
          take[i] = Math.max(0, Math.min(q || 0, def)); room -= take[i];
        }
        r = await attempt(() => tw("planet/xfer", { id: P.id, take }));
      } else {
        const q = num(await ask("|07Fighters to station on the planet (" + n(ME.fighters) + " aboard)? |08[|14" + P.fighters + "|08]|07 |15", P.fighters, 6));
        if (!(q >= 0)) continue;
        r = await attempt(() => tw("planet/xfer", { id: P.id, leave: q }));
      }
    }
  }
  async function info() {
    const cargo = ME.cargo.reduce((a, b) => a + b);
    await out("\n|15Trader |14" + esc(ME.handle) + "|07   Experience |14" + n(ME.exp) + "|07   Net worth |14" + n(ME.worth) + "|07 credits\n" +
      "|07Ship  |15" + esc(ME.ship) + "|07   Turns left |14" + ME.turns + "|07 (" + ME.tpw + " per warp)   Credits |14" + n(ME.credits) + "\n" +
      "|07Holds |14" + ME.holds + "|08/" + ME.maxHolds + "|07: " + GOODS.map((g, i) => g + " |14" + ME.cargo[i] + "|07").join(", ") + ", empty |14" + (ME.holds - cargo) + "\n" +
      "|07Fighters |14" + n(ME.fighters) + "|08/" + n(ME.maxF) + "|07   Shields |14" + n(ME.shields) + "|08/" + n(ME.maxS) + "|07   Flushbang torpedoes |14" + ME.torps +
      "|07   Kills |14" + ME.kills + "|07   Deaths |14" + ME.deaths + "\n|07The shipyard is in sector |14" + DOCK + "|07.\n");
  }
  async function help() {
    await out("\n" + menuBar + "\n" +
      "|08 Type a sector number to warp there (the autopilot handles distant ones). Sectors in\n" +
      " (parentheses) are ones you haven't visited. Ports are classed by what they Buy and Sell:\n" +
      " BSS buys Paper, sells Soap and Plungers. Buy low, haggle, sell high. Fighters you leave\n" +
      " in a sector ambush anyone else who warps in. Ships parked outside Federation space can be\n" +
      " jumped while their owners are off-line, so park in sectors 1-10. {D} redraws this sector.\n");
  }
  async function quit() {
    if (!V.fed && !(await yn("|12You're outside Federation space, where parked ships get jumped. Quit anyway?"))) return false;
    await out("|07Your ship stays parked in sector |14" + V.sector + "|07. Come back tomorrow for |14250|07 fresh turns.\n");
    await sleep(900);
    return true;
  }

  // ---------------------------------------------------------------- main loop
  cls();
  await out(menuBar + "\n");
  await showSector();
  while (true) {
    const k = await prompt();
    if (/\d/.test(k)) {
      await out("\n");
      const s = await ask("|07Warp to sector: |15", k, 3, true);
      if (s) await warpTo(s);
      continue;
    }
    await out(k === "?" ? "Help\n" : "\n");
    if (k === "M") { const s = await ask("|07Warp to which sector? |15", "", 3); if (s) await warpTo(s); }
    else if (k === "D") await showSector();
    else if (k === "P") await trade();
    else if (k === "C") await computer();
    else if (k === "F") await fighters();
    else if (k === "A") await attack();
    else if (k === "L") await land();
    else if (k === "I") await info();
    else if (k === "?") await help();
    else if (k === "Q") { if (await quit()) return; }
  }
};
