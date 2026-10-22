// Barren Drains Elite — a shared-world empire door. Every turn is a year; turns refill daily.
// The rules live on the board (worker/doors/barren.js); this file is the screens.
(() => {
  const LOGO = [
    "______                            ______           _           ",
    "| ___ \\                           |  _  \\         (_)          ",
    "| |_/ / __ _ _ __ _ __ ___ _ __   | | | |_ __ __ _ _ _ __  ___ ",
    "| ___ \\/ _' | '__| '__/ _ \\ '_ \\  | | | | '__/ _' | | '_ \\/ __|",
    "| |_/ / (_| | |  | | |  __/ | | | | |/ /| | | (_| | | | | \\__ \\",
    "\\____/ \\__,_|_|  |_|  \\___|_| |_| |___/ |_|  \\__,_|_|_| |_|___/",
  ];
  const SKYLINE = [
    "        )  (            _              .-.             )        ",
    "       (    )   /\\     |~|    ___     /   \\    /\\     (   (     ",
    "   ___  )  (   /  \\    | |   | o |   |  ( |   /  \\     )   )    ",
    "  |(*)|  ___  /____\\   | |   |   |   |    |  /____\\   ___ (     ",
    "__|___|_|___|_|_[]_|___|_|___|___|___|____|__|_[]_|__|___|______",
  ];
  const BUILD = [
    ["F", "farms", "Fertilized Fields", "grow 80 bushels a year"],
    ["O", "outhouses", "Pay Outhouses", "earn 60 gold a year"],
    ["B", "bunks", "Bunkhouses", "house 50 troops each"],
    ["T", "towers", "Stink Towers", "defense; nobody wants to get close"],
    ["P", "thrones", "Porcelain Thrones", "monuments to you. Prestige. That's it."],
  ];
  const COST = { farms: 300, outhouses: 300, bunks: 300, towers: 300, thrones: 1500 };
  const UNITS = [
    ["P", "plungers", "Plungermen", 40, "1 attack, 1 defense, eats 1, 1 gold upkeep"],
    ["S", "slingers", "Slingers", 110, "1 attack, 2 defense, 2 gold upkeep"],
    ["W", "wagons", "Honey Wagons", 600, "6 attack, 2 defense, 3 crew, 10 upkeep"],
    ["N", "sniffers", "Sniffers", 250, "spies and saboteurs, 3 upkeep"],
  ];
  const n = v => Math.floor(v || 0).toLocaleString("en-US");
  const say = s => "|07" + esc(s);
  let R = null;   // the caller's realm, as the board last reported it

  async function ask(prompt, max) {
    await out(prompt);
    const s = (await readLine({ max: 10 })).trim().toLowerCase();
    if (!s) return null;
    if (s === "m" || s === "max") return max;
    const v = parseInt(s.replace(/,/g, ""), 10);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  async function act$(path, body) { const r = await api("door/barren/" + path, body); if (r.realm) R = r.realm; return r; }
  async function tell(msg) { await out("\n|10" + esc(msg) + "|07\n"); await sleep(900); }
  async function oops(fn) {
    try { return await fn(); }
    catch (e) { if (e instanceof BoardError) { await out("\n|12" + esc(e.message) + "|07\n"); await anyKey(); return null; } throw e; }
  }

  async function title(st) {
    cls();
    await out("\n" + LOGO.map((l, i) => "|" + ["14", "14", "06", "06", "12", "04"][i] + "        " + l).join("\n") + "\n");
    await out("|08                       - = |15E  L  I  T  E|08 = -\n\n");
    await out(SKYLINE.map((l, i) => (i < 2 ? "|08" : "|06") + "        " + l).join("\n") + "\n\n");
    if (st.top) await out("|07  Mightiest realm: |15" + esc(st.top.name) + " |08ruled by |14" + esc(st.top.handle) +
      " |08(" + n(st.top.land) + " acres, worth " + n(st.top.networth) + ")\n");
    else await out("|07  No realms yet. The land is empty, damp, and yours for the taking.\n");
    await out("|08  " + st.count + " realm" + (st.count === 1 ? "" : "s") + " in the world.  An original door for MEGAzine BBS.\n");
    await anyKey();
  }

  async function create() {
    cls();
    await out("|14 Found a Realm\n" + rule(6) + say(wrap(
      "The Plumbers' Guild grants you 250 soggy acres, 2,000 peasants, a modest army of Plungermen and a treasury that smells faintly of rust. " +
      "For your first 20 years the Guild protects you from attack. After that, the neighbors will come.")) + "\n\n");
    while (true) {
      await out("|07 Name your realm |08(blank to leave)|07: ");
      const name = (await readLine({ max: 24 })).trim();
      if (!name) return false;
      const ok = await oops(() => act$("create", { name }));
      if (ok) { await out("\n|10 Long live " + esc(name) + "!|07\n"); await sleep(1000); return true; }
    }
  }

  function header() {
    return "|12 BARREN DRAINS ELITE |08* |15" + esc(R.name) + " |08ruled by |14" + esc(R.handle) + "\n" + rule(4, "=") +
      "|07 Year |15" + R.years + "   |07Turns |15" + R.turns + "   |07Gold |14" + n(R.gold) + "   |07Food |10" + n(R.food) +
      "   |07Peasants |15" + n(R.peasants) + "\n" +
      "|07 Land |15" + n(R.land) + " |08(" + n(R.free) + " open)   |07Army |15" + n(R.army) + " |08(beds for " + n(R.housing) + ")" +
      "   |07Worth |15" + n(R.networth) + "\n" +
      (R.protected ? "|03 Under the Plumbers' Guild's protection for " + R.protectLeft + " more year" + (R.protectLeft === 1 ? "" : "s") + ".\n" : "");
  }

  async function menu() {
    while (true) {
      cls();
      const row = (k1, a, cost, k2, b) => "|07   {" + k1 + "} " + pad(a, 23) + "|08" + pad(cost, 9) + "|07{" + k2 + "} " + b + "\n";
      await out(header() + "\n" +
        row("Y", "Rule another year", "1 turn", "B", "Build on open land") +
        row("E", "Explore for land", "1 turn", "R", "Recruit or disband troops") +
        row("A", "Attack a realm", "1 turn", "M", "Marketplace |08(food)") +
        row("X", "Sabotage", "1 turn", "T", "Tax rate |08(" + R.tax + "%)") +
        row("S", "Send a Sniffer", R.spiesLeft + " left", "P", "Pacts") +
        row("L", "The royal ledger", "", "N", "Daily news") +
        row("K", "Rankings of the realms", "", "Q", "Back to the board") +
        "\n|08Your command, sire? |07");
      const k = await readKey("YEAXSBRMTPLNKQ");
      if (k === "Q") return;
      if (k === "Y") await year("rest");
      if (k === "E") await year("explore");
      if (k === "B") await build();
      if (k === "R") await recruit();
      if (k === "M") await market();
      if (k === "T") await tax();
      if (k === "A") await attack();
      if (k === "S") await spy();
      if (k === "X") await sabotage();
      if (k === "P") await pacts();
      if (k === "L") await ledger();
      if (k === "N") await newsScreen();
      if (k === "K") await rankings();
    }
  }

  async function year(mode) {
    const r = await oops(() => act$("year", { mode }));
    if (!r) return;
    const y = r.year;
    cls();
    const L = (a, b) => "  " + pad(a, 38) + b + "\n";
    const num = (label, v, unit) => pad(label, 18) + lpad((v < 0 ? "-" : "") + n(Math.abs(v)), 9) + (unit ? " " + unit : "");
    await out("|14 ======== The Report for the Year " + y.year + " in " + esc(R.name) + " " + "=".repeat(Math.max(3, 40 - String(y.year).length - R.name.length)) + "\n\n");
    await out("|07" + L(num("Harvest", y.harvest, "bushels"), num("Taxes", y.taxes, "gold")));
    await out("|07" + L(num("Eaten", -y.eaten, ""), num("Outhouse fees", y.outhouse, "")));
    await out("|07" + L(num("Net food", y.harvest - y.eaten, ""), num("Army upkeep", -y.upkeep, "")));
    const ch = (label, v, plus) => "|07" + label + " " + (!v ? "|080" : (plus ? "|10+" : "|12-") + n(v)) + "   ";
    await out("\n  " + ch("Born", y.born, true) + ch("Moved away", y.left) + ch("Starved", y.starved) + ch("Deserted", y.deserted) + "\n");
    if (y.explored !== undefined) await out("\n|11  Your explorers waded out and claimed " + n(y.explored) + " acres for " + n(y.exploreCost) + " gold.\n");
    if (y.starved) await out("|12  The granaries ran dry. People starved and soldiers deserted.\n");
    if (y.unpaid) await out("|12  The treasury ran dry. Unpaid troops went home.\n");
    if (y.event) await out("\n|13  " + esc(y.event) + "\n");
    if (R.peasants >= R.capacity - 5) await out("|08  Your land is full. Peasants need more acres to grow.\n");
    if (R.army > R.housing) await out("|08  Troops are sleeping in the fields. Morale suffers; build Bunkhouses.\n");
    await out("\n|07  Gold |14" + n(R.gold) + "  |07Food |10" + n(R.food) + "  |07Peasants |15" + n(R.peasants) + "  |07Land |15" + n(R.land) +
      "  |07Turns left |15" + R.turns + "\n");
    await anyKey();
  }

  async function build() {
    while (true) {
      cls();
      await out(header() + "\n|14 Build on open land |08(" + n(R.free) + " acres open, " + n(R.gold) + " gold)\n\n");
      for (const [k, key, name, what] of BUILD)
        await out("|07   {" + k + "} |15" + pad(name, 19) + "|07" + lpad(n(R[key]), 6) + "  |14" + lpad(n(COST[key]), 5) + "g  |08" + what + "\n");
      await out("\n|07   {Q} Done\n\n|08Build what? |07");
      const k = await readKey("FOBTPQ");
      if (k === "Q") return;
      const [, key, name] = BUILD.find(b => b[0] === k);
      const max = Math.min(R.free, Math.floor(R.gold / COST[key]));
      const amt = await ask("\n|07How many " + name + "? |08(up to " + n(max) + ", M for max) |07", max);
      if (!amt) continue;
      const r = await oops(() => act$("build", { kind: key, n: amt }));
      if (r) await tell(r.msg);
    }
  }

  async function recruit() {
    while (true) {
      cls();
      await out(header() + "\n|14 The barracks |08(" + n(R.gold) + " gold, " + n(R.peasants) + " peasants to draw from)\n\n");
      for (const [k, key, name, cost, what] of UNITS)
        await out("|07   {" + k + "} |15" + pad(name, 14) + "|07" + lpad(n(R[key]), 7) + "  |14" + lpad(n(cost), 4) + "g  |08" + what + "\n");
      await out("\n|07   {Q} Done\n\n|08Which troops? |07");
      const k = await readKey("PSWNQ");
      if (k === "Q") return;
      const [, key, name, cost] = UNITS.find(u => u[0] === k);
      await out("\n|07{R} Recruit " + name + "  {D} Disband them  {Q} Never mind |07");
      const op = await readKey("RDQ");
      if (op === "Q") continue;
      if (op === "R") {
        const crew = key === "wagons" ? 3 : 1;
        const max = Math.max(0, Math.min(Math.floor(R.gold / cost), Math.floor((R.peasants - 100) / crew)));
        const amt = await ask("\n|07Recruit how many? |08(up to " + n(max) + ", M for max) |07", max);
        if (!amt) continue;
        const r = await oops(() => act$("recruit", { kind: key, n: amt }));
        if (r) await tell(r.msg);
      } else {
        const amt = await ask("\n|07Send how many home? |08(up to " + n(R[key]) + ") |07", R[key]);
        if (!amt) continue;
        const r = await oops(() => act$("disband", { kind: key, n: amt }));
        if (r) await tell(r.msg);
      }
    }
  }

  async function market() {
    while (true) {
      cls();
      const eat = R.peasants + R.army + R.sniffers;
      await out(header() + "\n|14 The Marketplace\n\n" +
        "|07 Food in the granary: |10" + n(R.food) + " bushels  |08(your realm eats about " + n(eat) + " a year)\n" +
        "|07 Merchants sell food at |143 gold|07 a bushel and buy it at |141 gold|07. They are not your friends.\n\n" +
        "|07   {B} Buy food   {S} Sell food   {Q} Done\n\n|08Well? |07");
      const k = await readKey("BSQ");
      if (k === "Q") return;
      const max = k === "B" ? Math.floor(R.gold / 3) : R.food;
      const amt = await ask("\n|07How many bushels? |08(up to " + n(max) + ", M for max) |07", max);
      if (!amt) continue;
      const r = await oops(() => act$("market", { op: k === "B" ? "buy" : "sell", n: amt }));
      if (r) await tell(r.msg);
    }
  }

  async function tax() {
    cls();
    await out(header() + "\n|14 The Tax Collector\n\n" + say(wrap(
      "Low taxes and your peasants breed like rabbits. Above 30% they start packing their carts for the next kingdom over. " +
      "Every peasant pays 3 gold a year at 100%, which nobody has ever survived.")) +
      "\n\n|07 Current rate: |15" + R.tax + "%\n\n|07 New rate |08(0-50, blank to keep)|07: ");
    const s = (await readLine({ max: 3 })).trim();
    if (!s) return;
    const r = await oops(() => act$("tax", { rate: parseInt(s, 10) }));
    if (r) await tell(r.msg);
  }

  // Pick another realm from the rankings. Returns its row, or null.
  async function pickRealm(title, filter) {
    const list = await oops(() => api("door/barren/realms"));
    if (!list) return null;
    const rows = list.realms.filter(x => x.id !== list.me).filter(filter || (() => true));
    cls();
    await out("|14 " + title + "\n" + rule(6));
    if (!rows.length) { await out("|08 There's nobody to pick. Lonely at the top.\n"); await anyKey(); return null; }
    const keys = "123456789ABCDEFGHIJK";
    for (const [i, x] of rows.slice(0, 20).entries()) {
      const tag = x.ally ? "|10ally" : x.protected ? "|03protected" : x.offeredMe ? "|13offers pact" : x.offered ? "|05pact offered" : "";
      await out("|07 {" + keys[i] + "} |15" + pad(esc(x.name), 24) + "|08" + pad(esc(x.handle), 18) + "|07" + lpad(n(x.land), 7) + " ac " +
        lpad(n(x.networth), 9) + "  " + tag + "\n");
    }
    await out("\n|07 {Q} Never mind\n\n|08Which realm? |07");
    const k = await readKey(keys.slice(0, Math.min(20, rows.length)) + "Q");
    if (k === "Q") return null;
    return rows[keys.indexOf(k)];
  }

  async function attack() {
    if (R.turns < 1) { await out("\n|12 You're out of turns for today.|07\n"); return anyKey(); }
    const v = await pickRealm("Attack which realm?", x => !x.ally);
    if (!v) return;
    await out("\n|07Send how much of your army against |15" + esc(v.name) + "|07?\n  {1} A quarter   {2} Half   {3} Three quarters   {4} Everyone   {Q} Call it off |07");
    const k = await readKey("1234Q");
    if (k === "Q") return;
    const r = await oops(() => act$("attack", { target: v.id, pct: [25, 50, 75, 100][+k - 1] }));
    if (!r) return;
    const b = r.battle;
    cls();
    await out("|12 War with " + esc(b.target) + "\n" + rule(4, "=") + "\n");
    const sent = [b.sent.plungers && n(b.sent.plungers) + " Plungermen", b.sent.slingers && n(b.sent.slingers) + " Slingers", b.sent.wagons && n(b.sent.wagons) + " Honey Wagons"].filter(Boolean).join(", ");
    await out("|07 You march " + sent + " across the border.\n"); await sleep(700);
    await out("|08 The stench of battle rises over the leach fields"); for (let i = 0; i < 5; i++) { await sleep(350); await out("."); }
    await out("\n\n|07 Your attack strength |15" + n(b.off) + "|07 against their defenses |15" + n(b.def) + "\n\n");
    if (b.win) {
      if (A.ready()) { A.tone([523], 0, 0.15, 0.3); A.tone([659], 0.15, 0.15, 0.3); A.tone([784], 0.3, 0.3, 0.3); }
      await out("|10 VICTORY!|07 You seized |15" + n(b.land) + " acres|07, |14" + n(b.gold) + " gold|07 and |10" + n(b.food) + " bushels|07.\n");
      const t = Object.entries(b.took).filter(([, v]) => v).map(([k, v]) => n(v) + " " + BUILD.find(x => x[1] === k)[2]).join(", ");
      if (t) await out("|07 Still standing on it: " + t + ".\n");
    } else {
      await out("|12 DEFEAT.|07 Your troops came home smelling worse than usual.\n");
    }
    const ls = l => [l.plungers && n(l.plungers) + " Plungermen", l.slingers && n(l.slingers) + " Slingers", l.wagons && n(l.wagons) + " Honey Wagons"].filter(Boolean).join(", ") || "nobody";
    await out("\n|07 You lost: |12" + ls(b.lossA) + "\n|07 They lost: |10" + ls(b.lossD) + "\n");
    await out("\n|08 A year passed while you were at war. Turns left: " + R.turns + "\n");
    await anyKey();
  }

  async function spy() {
    if (R.sniffers < 1) { await out("\n|12 You have no Sniffers. Recruit some at the barracks.|07\n"); return anyKey(); }
    const v = await pickRealm("Send a Sniffer to which realm?");
    if (!v) return;
    const r = await oops(() => act$("spy", { target: v.id }));
    if (!r) return;
    cls();
    if (r.caught) { await out("|12 Your Sniffer was caught behind the outhouses of " + esc(r.target) + ". You won't see him again.|07\n"); return anyKey(); }
    const x = r.intel;
    await out("|14 Sniffer's Report: " + esc(x.name) + " |08ruled by " + esc(x.handle) + "\n" + rule(6) +
      "|08 (Sniffers count roughly. Smells are exact.)\n\n" +
      "|07 Year " + x.years + "   Land |15" + n(x.land) + "|07 acres   Worth |15" + n(x.networth) + "|07   Tax " + x.tax + "%" + (x.protected ? "   |03protected" : "") + "\n\n" +
      "|07 Peasants |15" + lpad(n(x.peasants), 9) + "     |07Plungermen   |15" + lpad(n(x.plungers), 8) + "\n" +
      "|07 Gold     |14" + lpad(n(x.gold), 9) + "     |07Slingers     |15" + lpad(n(x.slingers), 8) + "\n" +
      "|07 Food     |10" + lpad(n(x.food), 9) + "     |07Honey Wagons |15" + lpad(n(x.wagons), 8) + "\n" +
      "|07                        Sniffers     |15" + lpad(n(x.sniffers), 8) + "\n\n" +
      "|07 Fields " + n(x.farms) + "   Outhouses " + n(x.outhouses) + "   Bunkhouses " + n(x.bunks) + "   Stink Towers " + n(x.towers) +
      "   Thrones " + n(x.thrones) + "\n");
    await anyKey();
  }

  async function sabotage() {
    if (R.turns < 1) { await out("\n|12 You're out of turns for today.|07\n"); return anyKey(); }
    const v = await pickRealm("Sabotage which realm?", x => !x.ally && !x.protected);
    if (!v) return;
    const r = await oops(() => act$("sabotage", { target: v.id }));
    if (!r) return;
    await out("\n" + (r.ok ? "|10 " : "|12 ") + esc(r.msg) + "\n|08 A year passed. Turns left: " + R.turns + "\n");
    await anyKey();
  }

  async function pacts() {
    const v = await pickRealm("Pacts: pick a realm to offer, accept or break a pact");
    if (!v) return;
    const op = v.ally || v.offered ? "break" : "offer";
    await out("\n|07" + (v.ally ? "Break your pact with " : v.offered ? "Withdraw your offer to " : v.offeredMe ? "Accept the pact from " : "Offer a pact to ") +
      "|15" + esc(v.name) + "|07? {Y} Yes {N} No ");
    if (await readKey("YN") !== "Y") return;
    const r = await oops(() => act$("pact", { target: v.id, op }));
    if (r) await tell(r.msg);
  }

  async function ledger() {
    cls();
    const r = await oops(() => act$("status"));
    if (!r) return;
    const L = (a, b, c) => "|07 " + pad(a, 20) + "|15" + lpad(b, 10) + "  |08" + (c || "") + "\n";
    await out("|14 The Royal Ledger of " + esc(R.name) + ", Year " + R.years + "\n" + rule(6) +
      L("Land", n(R.land) + " ac", n(R.free) + " acres open") +
      L("  Fertilized Fields", n(R.farms), "80 bushels a year each") +
      L("  Pay Outhouses", n(R.outhouses), "60 gold a year each") +
      L("  Bunkhouses", n(R.bunks), "beds for " + n(R.housing) + " troops") +
      L("  Stink Towers", n(R.towers), "+" + Math.min(50, R.towers) + "% defense") +
      L("  Porcelain Thrones", n(R.thrones), "prestige") +
      L("Peasants", n(R.peasants), "room for " + n(R.capacity)) +
      L("Gold", n(R.gold), "tax rate " + R.tax + "%") +
      L("Food", n(R.food), "bushels") +
      L("Plungermen", n(R.plungers)) + L("Slingers", n(R.slingers)) + L("Honey Wagons", n(R.wagons)) + L("Sniffers", n(R.sniffers)) +
      L("Net worth", n(R.networth)) +
      "|07 " + (R.protected ? "|03Protected by the Plumbers' Guild for " + R.protectLeft + " more years." : "|08No longer protected. Keep your army fed.") + "\n");
    await anyKey();
  }

  async function newsScreen() {
    const r = await oops(() => api("door/barren/news"));
    if (!r) return;
    cls();
    await out("|14 The Daily Drip |08- news of the realms\n" + rule(6));
    if (!r.news.length) await out("|08 Nothing has happened yet. Make something happen.\n");
    for (const x of r.news) await out("|08 " + d8(x.at) + " |07" + wrap(esc(x.text), 66).replace(/\n/g, "\n          ") + "\n");
    await anyKey();
  }

  async function rankings() {
    const r = await oops(() => api("door/barren/realms"));
    if (!r) return;
    cls();
    await out("|14 Rankings of the Realms\n" + rule(6) + "|08  #  Realm                    Ruler               Land      Worth\n");
    for (const [i, x] of r.realms.entries())
      await out((x.id === r.me ? "|14" : "|07") + lpad(i + 1, 3) + "  " + pad(esc(x.name), 24) + " " + pad(esc(x.handle), 16) + lpad(n(x.land), 8) +
        lpad(n(x.networth), 11) + (x.protected ? " |03P" : "") + "\n");
    await out("|08\n  P = protected by the Plumbers' Guild\n");
    await anyKey();
  }

  DOOR.barren = async function () {
    let st = await api("door/barren/enter");
    await title(st);
    if (!st.realm) {
      if (!(await create())) return;
      st = await api("door/barren/enter");
    }
    R = st.realm;
    if (st.reports && st.reports.length) {
      cls();
      await out("|14 While you were away...\n" + rule(6));
      for (const x of st.reports) await out("|08 " + d8(x.at) + " " + hm(x.at) + " |07" + wrap(esc(x.text), 62).replace(/\n/g, "\n                  ") + "\n");
      await anyKey();
    }
    if (R.turns > 0 && R.years === 0) {
      cls();
      await out("|14 How to rule\n" + rule(6) + say(wrap(
        "Every turn is a year. Your fields feed your people, your taxes and outhouses fill the treasury, and your army eats both. " +
        "Explore to claim more land, build on it, and raise an army to take land from the neighbors. You get 10 turns a day; unused ones keep, up to 30. " +
        "Sniffers spy and sabotage. Pacts keep friends from attacking each other. Porcelain Thrones do nothing at all, gloriously.")) + "\n");
      await anyKey();
    }
    await menu();
  };
})();
