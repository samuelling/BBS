// Legend of the Red Drain: the shared-world forest RPG. The board server runs the game
// (worker/doors/reddrain.js); this file only draws the screens and sends your choices.
(() => {
  const TITLE = [
    "______         _  ______           _",
    "| ___ \\       | | |  _  \\         (_)",
    "| |_/ /___  __| | | | | |_ __ __ _ _ _ __",
    "|    // _ \\/ _` | | | | | '__/ _` | | '_ \\",
    "| |\\ \\  __/ (_| | | |/ /| | | (_| | | | | |",
    "\\_| \\_\\___|\\__,_| |___/ |_|  \\__,_|_|_| |_|",
  ];
  const SWIRL = [
    "   .-======-.",
    " .'  .-==-.  '.",
    "/  .' .--. '.  \\",
    "| |  ( () )  | |",
    "\\  '. '--' .'  /",
    " '.  '-..-'  .'",
    "   '-.____.-'",
  ];
  const SHADES = [12, 12, 4, 4, 4, 8];

  let T = null, P = null;   // static tables from the server, and you
  const call = async (action, body) => {
    const r = await api("door/reddrain/" + action, body);
    if (r.player) P = r.player;
    return r;
  };
  const num = n => Number(n || 0).toLocaleString("en-US");
  // Word wrap that ignores |NN color codes when measuring, with a hanging indent.
  function wrapc(str, width = 78, indent = "") {
    return String(str).split("\n").map(par => {
      const lead = par.match(/^ */)[0], words = par.slice(lead.length).split(" "), outl = [];
      let line = lead, len = lead.length, first = true;
      for (const w of words) {
        const wl = w.replace(/\|\d\d/g, "").length;
        if (!first && len + 1 + wl > width) { outl.push(line); line = indent + w; len = indent.length + wl; }
        else { line += (first ? "" : " ") + w; len += (first ? 0 : 1) + wl; }
        first = false;
      }
      outl.push(line);
      return outl.join("\n");
    }).join("\n");
  }
  const say = async (s, indent) => { await out(wrapc(s, 78, indent || "") + "|07\n"); };
  const lines = async (arr, indent) => { for (const l of arr) await out(wrapc(l, 78, indent || " ") + "|07\n"); };
  function bar() {
    const hpc = P.hp < P.maxhp / 3 ? "|12" : P.hp < P.maxhp ? "|14" : "|10";
    return "|08 HP " + hpc + num(P.hp) + "|08/|07" + num(P.maxhp) + "|08  Fights |15" + P.fights +
      "|08  Gold |14" + num(P.gold) + "|08  Bank |06" + num(P.bank) + "|08  Level |15" + P.level +
      "|08  XP |11" + num(P.xp) + (P.alive ? "" : "  |12DEAD") + "|07\n";
  }

  async function title() {
    cls();
    await out("\n|08" + " ".repeat(10) + "- = [ |14L E G E N D   O F   T H E|08 ] = -\n");
    for (let i = 0; i < SWIRL.length; i++) {
      const left = i < TITLE.length ? "|" + String(SHADES[i]).padStart(2, "0") + TITLE[i] : "";
      const vis = i < TITLE.length ? TITLE[i].length : 0;
      await out(" " + left + " ".repeat(Math.max(1, 48 - vis)) + (i % 2 ? "|04" : "|12") + SWIRL[i] + "\n");
    }
    await out("\n|07   A game of plumbing, peril and poor decisions.   |08One world, everyone in it.\n" +
      "|08   Door by The SysOp for The Septic Tankz.\n\n");
  }

  async function notices(rows) {
    if (!rows || !rows.length) return;
    await out("\n|14 While you were away...\n" + rule(6));
    for (const n of rows) await say(" |08" + lpad(hm(n.at), 7) + "|07 " + n.text, " ".repeat(10));
    await anyKey();
  }

  async function create() {
    cls();
    await out("|12 A new arrival in Flushing\n" + rule(4));
    await lines([
      "|07The bus drops you at the edge of Flushing, a town built on top of the biggest",
      "|07septic system in the county. Below the Leach Field, something red and ancient",
      "|07lives in the pipes. Every few years somebody goes down to deal with it.",
      "",
      "|07You've come to be that somebody. First: what kind of somebody are you?",
      "",
    ]);
    for (const [k, c] of Object.entries(T.classes))
      await out("|07  {" + k + "} |15" + pad(c.name, 15) + "|08" + wrapc(c.blurb, 56).replace(/\n/g, "\n" + " ".repeat(21)) + "\n");
    await out("\n|07  {Q} Never mind\n\n|08Choose: |07");
    const k = await readKey(Object.keys(T.classes).join("") + "Q");
    if (k === "Q") return false;
    await call("create", { cls: k });
    await out("\n|10You are " + esc(P.handle) + ", a " + P.clsName + ". Welcome to Flushing.|07\n");
    await say("|08You have |14" + num(P.gold) + "|08 gold. Clem sells weapons and Ashbury sells armor; you'll want both before the Leach Field.");
    await anyKey();
    return true;
  }

  // ------------------------------------------------------------------ fighting
  async function fight(intro) {
    if (intro) await out("\n" + intro + "\n");
    while (P.fight) {
      const f = P.fight;
      await out("\n|08 " + esc(f.name.charAt(0).toUpperCase() + f.name.slice(1)) + "'s HP: |12" + num(f.hp) + "|08   Your HP: |10" + num(P.hp) + "|08/|07" + num(P.maxhp) + "\n" +
        "|07 {A} Attack   {S} " + P.skill + " |08(" + P.skills + " left)|07   {R} Run\n|08 Action: |07");
      const k = await readKey("ASR", { enter: "A" });
      const action = { A: "attack", S: "skill", R: "run" }[k];
      if (action === "skill" && P.skills < 1) { await out("\n|12You're out of " + P.skill + " for today.|07\n"); continue; }
      outNow("\n");
      const r = await call(action);
      await lines(r.log.map(l => " " + l));
      if (r.outcome) { await anyKey(); return r.outcome; }
    }
    return null;
  }

  async function forest() {
    while (true) {
      act("Red Drain: the Leach Field");
      cls();
      await out("|10 The Leach Field\n" + rule(2) + bar() + rule(8));
      if (!P.alive) { await say("|12You are dead.|07 Your ghost drifts over the wet grass. Come back tomorrow."); await anyKey(); return; }
      await say("|07The grass here is suspiciously green and the ground squelches. Somewhere a pipe gurgles.");
      await out("\n|07  {L} Look for something to kill\n  {H} Hilda's Healing Hut\n" +
        (P.dragonOk ? "  {D} |12Descend into the Red Drain|07\n" : "") +
        "  {R} Return to town\n\n|08 The Field (L,H," + (P.dragonOk ? "D," : "") + "R): |07");
      const k = await readKey("LHR" + (P.dragonOk ? "D" : ""), { enter: "L" });
      if (k === "R") return;
      if (k === "H") { await healer(); continue; }
      if (k === "D") {
        cls();
        await lines(["|12 The Red Drain", rule(4).trim(),
          "|07You climb down an iron ladder into a chamber of rust and red water. It is warm.",
          "|07The water bulges. Something enormous lifts its head out of the drain, steaming,",
          "|07and looks at you with an eye the size of a manhole cover.", ""]);
        await out("|07 {F} Fight the Red Drain Dragon   {R} Run back up the ladder\n|08 Choose: |07");
        if (await readKey("FR") === "R") continue;
        try { await call("dragon"); }
        catch (e) { if (e instanceof BoardError) { await say("\n|12" + e.message); await anyKey(); continue; } throw e; }
        await fight("|12**THE RED DRAIN DRAGON ATTACKS!**|07");
        continue;
      }
      let r;
      try { r = await call("forest"); }
      catch (e) { if (e instanceof BoardError) { await say("\n|12" + e.message); await anyKey(); continue; } throw e; }
      if (r.event) {
        await out("\n"); await lines(r.event.map(l => " " + l)); await anyKey(); continue;
      }
      if (r.resume) await out("\n|14You're still in a fight!|07\n");
      await fight(r.resume ? null : "|14**You have encountered " + esc(P.fight.name) + "!**|07");
    }
  }

  // ------------------------------------------------------------------ town
  async function shop(kind) {
    const list = kind === "armor" ? T.armors : T.weapons;
    const cur = kind === "armor" ? P.armor : P.weapon;
    act("Red Drain: shopping");
    cls();
    await out(kind === "armor"
      ? "|11 Ashbury's Armor & Wading Supply\n" + rule(3) + "|08Ashbury looks up from a pair of waders he's patching. \"Protection? Smart.\"\n\n"
      : "|14 Clem's Weapons & Plumbing Supply\n" + rule(6) + "|08Clem spits in a bucket. \"Everything here's been used. Most of it on plumbing.\"\n\n");
    await out("|08  #  " + pad("Item", 30) + lpad(kind === "armor" ? "Defense" : "Attack", 8) + lpad("Price", 14) + "\n");
    for (let t = 1; t < list.length; t++) {
      const mine = t === cur;
      await out((mine ? "|10" : t <= cur ? "|08" : "|07") + " " + lpad(t, 2) + "  " + pad(list[t].name, 30) + lpad(num(list[t].power), 8) + lpad(num(list[t].price), 14) + (mine ? "  <- yours" : "") + "\n");
    }
    const trade = Math.floor(list[cur].price / 2);
    await out("\n|07 You have |14" + num(P.gold) + "|07 gold." + (cur ? " Your " + list[cur].name + " is worth |14" + num(trade) + "|07 in trade." : "") + "\n");
    const v = (await readLine({ prompt: " Buy which? (number, Enter to leave) ", max: 2 })).trim();
    if (!v) return;
    try { const r = await call("buy", { kind, tier: +v }); await say("\n" + r.say); }
    catch (e) { if (e instanceof BoardError) await say("\n|12" + e.message); else throw e; }
    await anyKey();
  }

  async function healer() {
    act("Red Drain: the healer");
    cls();
    await out("|13 Hilda's Healing Hut\n" + rule(5) + bar() + "\n");
    await say("|07Hilda smells like eucalyptus and bleach. \"Let's have a look at you, hon.\" She charges |14" + P.healCost + "|07 gold a hit point.");
    const missing = P.maxhp - P.hp;
    if (!missing) { await say("\n|07\"You're fit as a fiddle. Shoo.\""); await anyKey(); return; }
    await out("\n|07 {H} Heal everything |08(" + num(missing * P.healCost) + " gold)|07   {S} Heal some   {Q} Leave\n|08 Choose: |07");
    const k = await readKey("HSQ", { enter: "H" });
    if (k === "Q") return;
    let body = { all: true };
    if (k === "S") { outNow("\n"); const v = (await readLine({ prompt: " How many hit points? ", max: 9 })).replace(/\D/g, ""); if (!v) return; body = { hp: +v }; }
    const r = await call("heal", body);
    await say("\n" + r.say); await anyKey();
  }

  async function bank() {
    while (true) {
      act("Red Drain: the bank");
      cls();
      await out("|06 Ye Olde Septic Bank\n" + rule(6));
      await say("|07A teller with a visor counts coins behind iron bars. \"Gold in the bank can't be stolen off your body. Pays 1% a day, too.\"");
      await out("\n|07 On hand: |14" + num(P.gold) + "|07    In the bank: |14" + num(P.bank) + "\n\n" +
        "|07 {D} Deposit   {W} Withdraw   {Q} Leave\n|08 Choose: |07");
      const k = await readKey("DWQ");
      if (k === "Q") return;
      outNow("\n");
      const v = (await readLine({ prompt: " How much? (Enter for all) ", max: 12 })).replace(/[^\d]/g, "");
      try { await call("bank", { op: k === "D" ? "dep" : "wd", ...(v ? { amount: +v } : { all: true }) }); }
      catch (e) { if (e instanceof BoardError) { await say("|12" + e.message); await anyKey(); } else throw e; }
    }
  }

  async function training() {
    act("Red Drain: training");
    cls();
    await out("|15 The Training Hall\n" + rule(7));
    const m = T.masters[P.level];
    await say("|07Rows of dented plungers line the walls. Your master, |15" + m + "|07, is here.");
    await out("\n|07 {Q} Question your master   {F} Fight your master   {R} Return to town\n|08 Choose: |07");
    const k = await readKey("QFR");
    if (k === "R") return;
    const r = await call("master", {});
    if (r.say) { await say("\n" + r.say); await anyKey(); return; }
    if (k === "Q") { await say("\n|15" + m + "|07: \"You're ready. Pick up a plunger whenever you like.\""); await anyKey(); return; }
    await say("\n|15" + m + "|07: \"" + r.greet + "\"");
    await call("master", { fight: true });
    await fight("|14**You square off against " + m + "!**|07");
  }

  async function inn() {
    act("Red Drain: the inn");
    cls();
    await out("|03 The Overflow Inn\n" + rule(3));
    await say("|07A fire crackles. The barkeep is polishing a mug with a rag you hope is new. \"A room's |14" + num(20 * P.level) + "|07 gold. Nobody gets at you upstairs. Sleep in the field and anyone could.\"");
    await out("\n|07 {G} Get a room for the night (and leave the game)   {R} Return to town\n|08 Choose: |07");
    if (await readKey("GR") === "R") return false;
    try { await call("inn"); }
    catch (e) { if (e instanceof BoardError) { await say("\n|12" + e.message); await anyKey(); return false; } throw e; }
    await say("\n|07You climb the stairs, lock the door, and fall asleep on a mattress that crunches. |10You're safe until you return.");
    await anyKey();
    return true;
  }

  async function slaughter() {
    act("Red Drain: hunting players");
    cls();
    await out("|12 Slaughter a Sleeper\n" + rule(4));
    const r = await call("targets");
    await say("|07Some warriors sleep out in the Leach Field instead of paying for the inn. You can pick a fight with |15" + r.pfights + "|07 more today.");
    if (!r.rows.length) { await say("\n|08Nobody's sleeping in the field who's worth your time (within 2 levels of you, offline, not at the inn)."); await anyKey(); return; }
    await out("\n|08     " + pad("Warrior", 22) + pad("Class", 16) + "Level\n");
    const rows = r.rows.slice(0, 9);
    for (const [i, x] of rows.entries())
      await out("|07 {" + (i + 1) + "} |15" + pad(esc(x.handle), 22) + "|07" + pad(x.clsName, 16) + lpad(x.level, 5) + (x.wins ? " |12" + "*".repeat(Math.min(5, x.wins)) : "") + "\n");
    await out("\n|07 {Q} Leave them be\n|08 Attack who? |07");
    const k = await readKey("123456789".slice(0, rows.length) + "Q");
    if (k === "Q") return;
    const t = rows[+k - 1];
    if (!P.alive) return;
    try {
      const res = await call("pvp", { id: t.id });
      cls(); await out("|12 Murder in the Leach Field\n" + rule(4));
      await lines(res.log.map(l => " " + l));
    } catch (e) { if (e instanceof BoardError) await say("\n|12" + e.message); else throw e; }
    await anyKey();
  }

  async function newsScreen() {
    act("Red Drain: reading the news");
    cls();
    await out("|14 Daily Happenings in Flushing\n" + rule(6));
    const r = await call("news");
    if (!r.rows.length) await say("|08Nothing's happened yet. Give it time.");
    let day = null, n = 0;
    for (const row of r.rows) {
      if (n >= 17) break;
      if (row.day !== day) { day = row.day; await out("|03 " + (day === r.today ? "Today" : day) + "\n"); n++; }
      await say("|08  " + lpad(hm(row.at), 7) + " |07" + row.text, " ".repeat(11)); n += row.text.length > 60 ? 2 : 1;
    }
    await anyKey();
  }

  async function warriors() {
    act("Red Drain: list of warriors");
    cls();
    await out("|11 Warriors of Flushing\n" + rule(3));
    const r = await call("players");
    await out("|08 " + pad("#", 4) + pad("Warrior", 22) + pad("Class", 16) + lpad("Level", 6) + lpad("Experience", 13) + lpad("Kills", 7) + "  Dragons\n");
    for (const [i, x] of r.rows.slice(0, 15).entries())
      await out((x.alive ? "|07 " : "|08 ") + pad(i + 1, 4) + (x.alive ? "|15" : "|08") + pad(esc(x.handle), 22) + (x.alive ? "|07" : "|08") + pad(x.clsName, 16) + lpad(x.level, 6) +
        lpad(num(x.xp), 13) + lpad(x.kills, 7) + "  " + (x.wins ? "|12" + "*".repeat(Math.min(8, x.wins)) + (x.wins > 8 ? "+" : "") : "|08-") + (x.alive ? "" : " |08(dead)") + "\n");
    await anyKey();
  }

  async function stats() {
    cls();
    await out("|15 " + esc(P.handle) + "|08, level |15" + P.level + " " + P.clsName + "\n" + rule(8));
    const row = (a, b, c, d) => out("|08 " + pad(a, 16) + "|15" + pad(b, 24) + "|08" + pad(c, 16) + "|15" + d + "\n");
    await row("Hit points", num(P.hp) + " of " + num(P.maxhp), "Experience", num(P.xp));
    await row("Strength", num(P.str), "Next level at", P.level === 12 && P.dragonOk ? "the Dragon" : num(P.xpNeed));
    await row("Defense", num(P.def), "Gold on hand", num(P.gold));
    await row("Weapon", P.weaponName, "Gold in bank", num(P.bank));
    await row("Armor", P.armorName, "Forest fights", P.fights + " left");
    await row("Attack total", num(P.attack), "Player fights", P.pfights + " left");
    await row("Armor total", num(P.armorTotal), P.skill, P.skills + " left");
    await row("Players killed", P.kills, "Dragons slain", P.wins);
    await row("Days in town", P.days, "Status", P.alive ? "alive" : "dead until tomorrow");
    await anyKey();
  }

  async function town() {
    while (true) {
      act("Playing Legend of the Red Drain");
      await call("me");
      cls();
      await out("|12 Flushing|08, town square" + " ".repeat(40) + "day " + P.days + "\n" + rule(4) + bar() + rule(8));
      await say("|07The town square smells like a rest stop in August. Townsfolk hurry past. A fountain gurgles in a way fountains shouldn't.");
      await out("\n" +
        "|07  {F} The Leach Field          {K} Clem's Weapons\n" +
        "|07  {A} Ashbury's Armor          {H} Hilda's Healing Hut\n" +
        "|07  {T} The Training Hall        {B} Ye Olde Septic Bank\n" +
        "|07  {I} The Overflow Inn         {S} Slaughter a sleeper\n" +
        "|07  {N} Daily Happenings         {L} List of warriors\n" +
        "|07  {V} Your stats               {Q} Quit to the board\n" +
        "\n|08 Your command: |07");
      const k = await readKey("FKAHTBISNLVQ");
      try {
        if (k === "F") await forest();
        else if (k === "K") await shop("weapon");
        else if (k === "A") await shop("armor");
        else if (k === "H") await healer();
        else if (k === "T") { if (!P.alive) { await say("\n|12The dead don't train."); await anyKey(); } else await training(); }
        else if (k === "B") await bank();
        else if (k === "I") { if (!P.alive) { await say("\n|12The innkeeper doesn't rent to ghosts."); await anyKey(); } else if (await inn()) return; }
        else if (k === "S") { if (!P.alive) { await say("\n|12You're dead. Haunting doesn't count."); await anyKey(); } else await slaughter(); }
        else if (k === "N") await newsScreen();
        else if (k === "L") await warriors();
        else if (k === "V") await stats();
        else if (k === "Q") {
          await say("\n|07You wander off and bed down in the Leach Field. |12Anyone could find you there.");
          await sleep(900);
          return;
        }
      } catch (e) {
        if (!(e instanceof BoardError)) throw e;
        await say("\n|12" + e.message); await anyKey();
      }
    }
  }

  DOOR.reddrain = async function () {
    const st = await call("status");
    T = st;
    await title();
    await anyKey();
    await notices(st.notices);
    if (!st.player && !(await create())) return;
    if (P.fight) { cls(); await out("|14You're right where you left off: in a fight!|07\n"); await fight(null); }
    await town();
  };
})();
