// USURPER — the terminal side of the door. Every rule and die roll lives on the board
// (worker/doors/usurper.js); this file draws the screens and asks the questions.
//
// USURPER (c) 1993-2009 Jakob Dangarden. Ported by Rick Parrish, bug fixes by Dan Zingaro.
// Converted for MEGAzine BBS from the Usurper source (https://github.com/rickparrish/Usurper).
// Free software: you can redistribute it and/or modify it under the terms of the GNU General
// Public License as published by the Free Software Foundation; either version 2 of the License,
// or (at your option) any later version. Distributed WITHOUT ANY WARRANTY; see the GNU GPL.

DOOR.usurper = async function () {
  const T = "|02", HI = "|10", TALK = "|03", PLY = "|11", MON = "|12", ITEM = "|13", GOLD = "|14", WHITE = "|15", HEAD = "|05", RED = "|12", MAG = "|13", DIM = "|08";
  const RACES = ["Human", "Hobbit", "Elf", "Half-Elf", "Dwarf", "Troll", "Orc", "Gnome", "Gnoll", "Mutant"];
  const RACE_ADJ = ["a humble", "a loyal", "a graceful", "an allround", "a stubborn", "a stinking", "an ill-mannered", "a willful", "a puny", "a weird"];
  const CLASSES = ["Alchemist", "Assassin", "Barbarian", "Bard", "Cleric", "Jester", "Magician", "Paladin", "Ranger", "Sage", "Warrior"];
  const CLASS_ADJ = ["a shy", "a hiding", "a powerful", "an entertaining", "a praying", "a foolish", "a secretive", "an honorable", "a fast", "a wise", "a brave"];
  const CLASS_KEYS = "1234567890W";
  const MASTERS = ["Akrappa", "Singuman", "Ishana", "Dzarrgo", "Agni", "Apollonia", "Sachmez", "Umilak", "Asanga", "Gregorius"];
  const MASTER_TITLES = ["The Wise", "Bearer of Light and Fire", "The Last Northern Princess", "The Ancient Stone Lord", "The Shadow Dweller",
    "last Pupil of Sagan, the Sage", "The Great and Evil Witchmaster", "The Demon Tamer", "The Mysterious", "The Patriarch"];
  const ROOMS = [0, 200, 900, 3200, 7500];
  const FLOOR_NAMES = ["", "Downstairs", "First floor", "Second floor", "Third floor"];
  const n = v => Math.round(v || 0).toLocaleString("en-US");
  const TC = "|11", KC = "|14", KIDC = "|10", RELC = "|06", GODC = "|10";
  const money = v => (v === 1 ? "gold coin" : "gold coins");
  let P = null;        // the character as the board last described it
  let G = null;        // the Immortal, in the Divine Realm
  let lastR = null;    // the board's last answer (fights hand over from one kind to the next)

  // Calls the game. Board refusals are printed and come back as null; a dropped carrier still hangs up.
  async function call(action, body) {
    try {
      const r = await api("door/usurper/" + action, body || {});
      lastR = r;
      if (r.p) P = r.p;
      if (r.out && r.out.length) await out(r.out.join("\n") + "\n|07");
      return r;
    } catch (e) {
      if (e instanceof BoardError) { lastR = null; await out("\n" + RED + esc(e.message) + "|07\n"); return null; }
      throw e;
    }
  }
  async function yn(q, def) {
    await out(T + q + " " + DIM + "(" + (def === "Y" ? "[Y]/N" : "Y/[N]") + ")" + T + " ");
    const k = await readKey("YN", { enter: def });
    outNow((k === "Y" ? HI + "Yes" : RED + "No") + "|07\n");
    return k === "Y";
  }
  async function num(prompt, def) {
    await out(T + prompt + (def !== undefined ? DIM + " [" + n(def) + "]" : "") + T + ": " + WHITE);
    const s = (await readLine({ max: 14 })).replace(/[, ]/g, "");
    if (s === "" && def !== undefined) return def;
    const v = parseInt(s, 10);
    return Number.isFinite(v) ? v : null;
  }
  const pause = () => anyKey("\n" + DIM + "[" + T + "press any key" + DIM + "]|07");
  function header(s) { return HEAD + " " + s + "\n " + HEAD + "-".repeat(s.length) + "|07\n"; }
  function cols(items, w = 26) {   // menu entries laid out three across, like Usurper's menu2
    let s = "", c = 0;
    for (const it of items) {
      const vis = it.replace(/\|\d\d/g, "").replace(/\{(.)\}/g, "[$1]").length;
      s += (c === 0 ? "  " : "") + it + " ".repeat(Math.max(1, w - vis));
      if (++c === 3) { s += "\n"; c = 0; }
    }
    return s + (c ? "\n" : "");
  }

  // ------------------------------------------------------------ title
  cls();
  const banner = [
    String.raw`   __  _______ __  ______  ____  __________ `,
    String.raw`  / / / / ___// / / / __ \/ __ \/ ____/ __ \ `,
    String.raw` / / / /\__ \/ / / / /_/ / /_/ / __/ / /_/ / `,
    String.raw`/ /_/ /___/ / /_/ / _, _/ ____/ /___/ _, _/ `,
    String.raw`\____//____/\____/_/ |_/_/   /_____/_/ |_| `,
  ];
  const shade = ["|15", "|12", "|12", "|04", "|04"];
  await out("\n" + banner.map((l, i) => shade[i] + " ".repeat(17) + l).join("\n") + "\n\n" +
    "|07            Gangwars and partying. Become king, or fall trying.\n" +
    "|07       Fight monsters and other players in this fascinating game.\n\n" +
    "|14  USURPER |07(c) 1993-2009 Jakob Dangarden. Ported by Rick Parrish,\n" +
    "|07  bug fixes by Dan Zingaro. Free software under the GNU GPL v2 or later.\n" +
    "|08  Converted for MEGAzine BBS: Main Street, dungeons, shops, inn, bank,\n" +
    "|08  Level Masters, player fights, gangs, gang wars, the Castle and the throne,\n" +
    "|08  the prison, bounties, royal quests, love and family, the Gods, the Gym,\n" +
    "|08  the Marketplace, brawls, wrestling and the news.\n");
  await pause();

  let r = await call("enter");
  if (!r) return;
  if (r.completed) { await afterLife(); return; }
  if (r.god) {   // USURPER.PAS: enter as a mortal or as an immortal
    cls();
    await out("\n" + HEAD + "Welcome back, " + GODC + esc(r.god) + "\n\n" + T + "{I}mmortal  - enter the Divine Realm\n" + T + (r.p ? "{M}ortal    - play " + PLY + esc(P.name) : "{N}ew       - create a new mortal character") + "\n" + T + "{Q}uit\n\n" + T + "Choice : ");
    const k = await readKey(r.p ? "IMQ" : "INQ");
    outNow("\n");
    if (k === "Q") return;
    if (k === "I") { await godWorld(); return; }
  }
  if (!r.p && !(await createCharacter())) return;
  if (r.mail && r.mail.length) await showMail(r.mail);
  if (r.requests && r.requests.length && await answerRequests(r.requests) === "dead") return;
  if (r.babies && r.babies.length) await nameBabies(r.babies);
  if (r.pregnant) { await out("\n" + WHITE + "YOU ARE PREGNANT!\n"); await pause(); }
  if (r.prison) { await prisonCell(); return; }
  if (r.kingNews) await out("\n" + "|14  " + esc(r.kingNews) + "\n");
  if (r.barred) {
    await out("\n" + RED + "Since your last visit ...\n\n" + T + "You may return tomorrow and regain some of your lost pride...\n");
    await pause();
    return;
  }
  if (r.p) {
    if (r.wasAt === 5) await out("\n" + T + "You wake up in the Royal bed. Servants help you into your robes.\n");
    else if (r.wasAt === 7) await out("\n" + T + "You wake up at the Beggars Wall, stiff and cold, and shuffle into town.\n");
    else if (r.wasAt === 8) await out("\n" + T + "You wake up in your own bed at home. Home sweet home.\n");
    else if (r.wasAt > 0) await out("\n" + T + "You wake up in your room at the Inn, well rested, and walk down to the street.\n");
    else await out("\n" + T + "You are awake. Sleeping here in the Dormitory isn't\n" + T + "too comfortable. You deserve better than this, you think\n" + T + "to yourself while you get dressed.\n");
    await pause();
  }
  await mainStreet();

  // ------------------------------------------------------------ creation (USERHUNC.PAS)
  async function createCharacter() {
    cls();
    await out("\n" + header("Introducing a new user") + "\n" + T + "Hello " + HEAD + esc(S.user.handle) + T + ", you must be a new user.\n\n" +
      T + "Dare you enter a dark world filled with evil ?\n\n" + T + "{Y}es, I'm brave and bold!\n" + T + "{N}o, I'm scared...\n\n" + T + "Choice : ");
    if ((await readKey("YN")) === "N") { await out("\n" + GOLD + "Goodbye, adventurer!\n"); await sleep(800); return false; }
    let sex = 0, race = -1, cls_ = -1;
    while (!sex) {
      await out("\n\n" + HI + "Gender :\n" + T + "{M}ale\n" + T + "{F}emale\n" + T + "Choice :");
      const k = await readKey("MF");
      outNow("\n");
      if (await yn(k === "M" ? "Play a Male character" : "Play a Female character", "N")) sex = k === "M" ? 1 : 2;
    }
    while (race < 0) {
      cls();
      await out("\n" + T + "Choose your Race\n\n" + RACES.map((x, i) => T + "{" + i + "} " + x + (i === 8 ? "|11 *poisonous bite" : "")).join("\n") + "\n\n" + T + "Your choice :");
      const k = await readKey("0123456789");
      outNow("\n");
      if (await yn("Be " + RACE_ADJ[+k] + " " + GOLD + RACES[+k] + T, "N")) race = +k;
    }
    while (cls_ < 0) {
      cls();
      const notes = { 0: "*poison", 1: "*backstabbing", 4: "*spells", 6: "*spells", 7: "*soulstrike", 9: "*spells" };
      await out("\n" + T + "Choose your Profession :   (* special ability)\n\n" +
        CLASSES.map((x, i) => T + "{" + CLASS_KEYS[i] + "} " + pad(x, 12) + "|11" + (notes[i] || "")).join("\n") + "\n\n" + T + "Your choice :");
      const k = await readKey(CLASS_KEYS);
      outNow("\n");
      const c = CLASS_KEYS.indexOf(k);
      if (!(await yn("Be " + CLASS_ADJ[c] + " " + GOLD + CLASSES[c] + T, "N"))) continue;
      if ((race === 5 || race === 6) && c === 7) {
        await out("\n" + T + "Impossible combination!\n" + T + "You cannot be a Troll or Orc in combination with\n" + T + "the Paladin profession.\n");
        await pause(); continue;
      }
      cls_ = c;
    }
    const made = await call("create", { sex, race, cls: cls_ });
    if (!made) return false;
    cls();
    await out("\n" + HI + "We welcome " + PLY + esc(P.name) + HI + ", a young brave " + P.race + " " + P.cls + "!\n\n" +
      T + "You start with " + GOLD + n(P.gold) + T + " gold coins, " + WHITE + n(P.healing) + T + " healing potions and " + WHITE + P.maxhps + T + " hitpoints.\n" +
      T + "Every day you get " + WHITE + P.fights + T + " dungeon fights and " + WHITE + P.pfights + T + " player fights.\n" +
      T + "Buy a weapon and some armor before you go down into the dungeons.\n" +
      T + "When you quit, sleep at the Inn if you can afford it: people\n" + T + "sleeping in the Dormitory get robbed and murdered.\n");
    await pause();
    return true;
  }

  async function showMail(mails) {
    cls();
    await out("\n" + RED + "Since your last visit ...\n");
    for (const m of mails) {
      await out("\n" + RED + esc(m.head) + "\n" + "|04" + "_".repeat(m.head.length) + "\n" + m.body.split("\n").map(l => T + esc(l)).join("\n") + "\n");
    }
    await pause();
  }

  // ------------------------------------------------------------ Main Street (GAMEC.PAS)
  async function mainStreet() {
    while (true) {
      act("Playing Usurper");
      cls();
      await out("\n" + header("Main street of " + P.town) + "\n" +
        cols(["{S}tatus", "{D}ungeons", "{B}ank", "{I}nn", "{M}agic Shop", "{V}isit Master", "{W}eapon Store", "{A}rmor Shop", "{1} Healing Hut",
          "{C}hallenges", "{N}ews", "{L}ist Characters", "{H}ome", "{R}elations", "{T}he Marketplace", "{X}tra Shops", "{F}ame", "{Q}uit Game"]) +
        "\n" + (P.need === 0 ? HI + " (you are eligible for a level raise!)\n" : "") +
        T + " Main Street (" + GOLD + n(P.gold) + T + " gold, " + WHITE + P.hps + "/" + P.maxhps + T + " hps) : ");
      const k = await readKey("SDBIMVWA1CNLFQHRTX");
      outNow("\n");
      if (k === "Q") { if (await quitGame()) return; continue; }
      if (k === "S") { await status(); continue; }
      if (k === "D") { if (await dungeons() === "dead") return; continue; }
      if (k === "B") await bank();
      if (k === "I") { if (await inn() === "slept") return; }
      if (k === "M") await magicShop();
      if (k === "V") await master();
      if (k === "W") await shop("weapon");
      if (k === "A") await shop("armor");
      if (k === "1") await healer();
      if (k === "C") { const x = await challenges(); if (x === "slept" || x === "dead" || x === "jailed") return; }
      if (k === "N") await newsPaper();
      if (k === "L") await listCharacters(false);
      if (k === "F") await listCharacters(true);
      if (k === "H") { if (await home() === "slept") return; }
      if (k === "R") { const x = await loveCorner(); if (x) return; }
      if (k === "T") await marketplace();
      if (k === "X") await xtraShops();
    }
  }

  async function status() {
    await call("status");
    cls();
    const p = P;
    const sp = (label, v, w = 13) => T + pad(label, w) + WHITE + pad(String(v), 9);
    await out("\n" + header(esc(p.name) + ", the " + p.race + " " + p.cls) +
      sp("Level", p.level) + sp("Experience", n(p.exp)) + T + (p.need === null ? "" : p.need === 0 ? HI + "Ready for a raise!" : "Needs " + WHITE + n(p.need)) + "\n" +
      sp("Hitpoints", p.hps + "/" + p.maxhps) + sp("Mana", p.mana + "/" + p.maxmana) + sp("Age", p.age) + "\n\n" +
      sp("Strength", p.str) + sp("Defence", p.def) + sp("Stamina", p.sta) + "\n" +
      sp("Agility", p.agi) + sp("Charisma", p.cha) + sp("Dexterity", p.dex) + "\n" +
      sp("Wisdom", p.wis) + sp("Master", p.master) + "\n\n" +
      T + "Weapon  : " + ITEM + (p.weapon || "Bare hands") + T + (p.weapon ? " (power " + p.wpow + ")" : "") + "\n" +
      T + "Armor   : " + ITEM + (p.armor || "none") + T + (p.armor ? " (power " + p.apow + ")" : "") + "\n" +
      T + "Gold    : " + GOLD + n(p.gold) + T + " on hand, " + GOLD + n(p.bank) + T + " in the bank\n" +
      T + "Potions : " + WHITE + n(p.healing) + T + " healing potions (max " + p.maxheals + ")\n\n" +
      sp("Dungeon fights", p.fights, 16) + sp("Player fights", p.pfights, 15) + sp("Dark deeds", p.darknr, 12) + "\n" +
      sp("Monster kills", n(p.mkills), 16) + sp("Player kills", n(p.pkills), 15) + sp("Defeats", n(p.mdefeats + p.pdefeats), 12) + "\n" +
      (p.diseases.length ? RED + "Diseases: " + p.diseases.join(", ") + "\n" : "") +
      (p.spells.length ? T + "Spells  : " + p.spells.map(s => (s.ok ? "|11" : DIM) + s.name).join(T + ", ") + "\n" : ""));
    await pause();
  }

  // ------------------------------------------------------------ the Dungeons (DUNGEONC.PAS)
  async function dungeons() {
    const r0 = await call("dng/enter");
    if (!r0) return;
    cls();
    await out("\n" + T + "The Monsters are gathering...\n\n" + HEAD + "The Dungeons of " + P.dungeon + "\n" +
      T + "As you descend to Dungeon Level " + WHITE + P.dl + T + " you tighten your grip to your weapon.\n" +
      T + "You feel that evil lurk nearby... You wonder whether you ever shall\n" + T + "see the sun shine again...\n");
    let menu = true;
    while (true) {
      act("Usurper: dungeon level " + P.dl);
      if (menu) {
        await out("\n" + header("The Dungeons of " + P.dungeon) + cols(["{L}ook for creatures", "{H}ealing", "{Q}uick heal", "{C}hange level", "{U}man caves", "{S}tatus", "{R}eturn to town"]));
        menu = false;
      }
      await out("\n" + T + "[" + "|11" + P.fights + T + " fights left]  " + (P.need === 0 ? HI + "(you are eligible for a level raise!)" : "") + "\n" +
        T + "Dungeon level " + MAG + P.dl + T + " (" + WHITE + P.hps + "/" + P.maxhps + T + " hps, " + WHITE + P.healing + T + " potions) " + DIM + "{?}" + T + " : ");
      const k = await readKey("LHQCUSR?");
      outNow("\n");
      if (k === "?") { menu = true; continue; }
      if (k === "R") return;
      if (k === "U") { await out("\n" + HI + "You have entered a new area.\n"); if (await umanCave() === "dead") return "dead"; menu = true; continue; }
      if (k === "S") { await status(); menu = true; continue; }
      if (k === "Q") { await call("heal", { quick: true }); continue; }
      if (k === "H") {
        if (P.hps >= P.maxhps) { await out(T + "You don't need healing.\n"); continue; }
        await out(T + "You have " + WHITE + n(P.healing) + T + " healing potions.\n");
        const q = await num("Quaff how many potions", 0);
        if (q > 0) await call("heal", { n: q });
        continue;
      }
      if (k === "C") {
        await out(T + "There are a total of 100 dungeon levels. You can for the moment\n" + T + "access levels " + MAG + P.level + T + " - " + MAG + Math.min(100, P.level + 10) + T + ". ");
        const lv = await num("Pick a new level", P.dl);
        if (lv !== null) await call("dng/level", { level: lv });
        continue;
      }
      // L: look for creatures
      await out("\n" + T + "looking...\n");
      const r = await call("dng/look");
      if (r && r.supreme) { const x = await supreme(); if (x) return x; continue; }
      if (r && r.event) { const x = await eventLoop(r); if (x === "dead") return "dead"; continue; }
      if (!r || !r.fight) continue;
      const res = await monsterFight(r);
      if (res === "dead") return "dead";
      if (P.monk) await monk();
    }
  }

  async function monsterFight(r) {
    let menu = true;
    while (r && r.fight) {
      const f = r.fight, alive = f.mons.filter(m => m.alive);
      await out("\n" + T + "You are fighting : " + MON + f.list + "\n" + PLY + "Your " + T + "hitpoints : " + WHITE + n(P.hps) + T + "/" + WHITE + n(P.maxhps) + "\n");
      if (menu) {
        const items = ["{A}ttack", "{R}un", "{H}eal", "{Q}uick Heal", "{D}etailed list", "{S}tatus", "{F}ight to Death", "{B}eg for Mercy"];
        if (P.caster) items.push("{C}ast Spell");
        if (P.canBackstab) items.push("{1} Backstab");
        if (P.canSoul) items.push("{1} Soul Strike");
        await out(cols(items, 22));
        menu = false;
      }
      await out("|06:" + T + " ");
      const k = await readKey("ARHQDSFBC1?", { enter: "A" });
      outNow("\n");
      if (k === "?") { menu = true; continue; }
      if (k === "S") { await status(); menu = true; continue; }
      if (k === "D") {
        for (const m of alive) await out(MON + m.name + T + " (" + n(m.hps) + " hps)\n");
        continue;
      }
      if (k === "C" && !P.caster) continue;
      if (k === "1" && !P.canBackstab && !P.canSoul) continue;
      const body = { cmd: k };
      if (["A", "C", "1"].includes(k) && alive.length > 1) {
        await out(T + "Attack which one?\n" + alive.slice(0, 9).map((m, i) => T + "{" + (i + 1) + "} " + MON + m.name + T + " (" + n(m.hps) + " hps)").join("\n") + "\n" + T + ": ");
        const t = await readKey("123456789".slice(0, Math.min(9, alive.length)), { enter: "1" });
        outNow("\n");
        body.target = alive[+t - 1].i;
      }
      if (k === "H") {
        if (P.hps >= P.maxhps) { await out(T + "You are in no need of healing!\n"); continue; }
        body.n = await num("Quaff how many potions (you have " + n(P.healing) + ")", 0);
      }
      if (k === "F" && !(await yn("Fight to Death", "Y"))) continue;
      if (k === "B" && !(await yn("Beg for Mercy", "N"))) continue;
      if (k === "1" && P.canSoul) {
        if (P.hps < 2) { await out(T + "Sorry, too few hitpoints left!\n"); continue; }
        body.amount = await num("How many hitpoints to use (max " + n(P.hps - 1) + ")", 0);
        if (!body.amount) continue;
      }
      if (k === "C") {
        const known = P.spells.filter(s => s.ok);
        if (!known.length) { await out(T + "You don't know any spells you can use here yet.\n"); continue; }
        await out(T + "Mana : " + WHITE + P.mana + "/" + P.maxmana + "\n" +
          known.map(s => T + "{" + "ABCDEFGHIJKL"[s.n - 1] + "} " + pad(s.name, 17) + DIM + s.cost + " mana").join("\n") + "\n" + T + "{X} Never mind : ");
        const keys = known.map(s => "ABCDEFGHIJKL"[s.n - 1]).join("") + "X";
        const sk = await readKey(keys, { enter: "X" });
        outNow("\n");
        if (sk === "X") continue;
        body.spell = "ABCDEFGHIJKL".indexOf(sk) + 1;
      }
      r = await call("fight", body);
      if (!r) return;
      if (r.dead) { await pause(); return "dead"; }
    }
  }

  async function monk() {
    const z = P.level * 5;
    let max = Math.floor(P.gold / z);
    if (P.healing + max > P.maxheals) max = P.maxheals - P.healing;
    await out("\n" + HEAD + "* Meeting *\n" + T + "You are approached by a " + PLY + "monk" + T + ".\n" + T + "He offers you to buy healing potions.\n");
    if (max <= 0 || !(await yn("Buy potions", "Y"))) { await api("door/usurper/monk", { n: 0 }).catch(() => {}); return; }
    await out(T + "The price is " + GOLD + n(z) + T + " gold/potion.  ( you have " + GOLD + n(P.gold) + T + " gold )\n" +
      T + "You can buy a maximum of " + MAG + n(max) + T + " potions ( you have " + MAG + n(P.healing) + T + " potions )\n");
    const q = await num("How many would you like to buy (0-" + n(max) + ")", max);
    await call("monk", { n: q || 0 });
  }

  // ------------------------------------------------------------ shops (WEAPSHOP.PAS / ARMSHOP.PAS, classic mode)
  async function shop(kind) {
    const armor = kind === "armor";
    const owner = armor ? "Reese" : "Tully";
    let list = null, refresh = true;
    while (true) {
      act(armor ? "Usurper: armor shop" : "Usurper: weapon store");
      if (refresh) {
        cls();
        if (armor) await out("\n" + header("Armorshop, run by Reese the elf") + "\n" +
          T + "As you enter the store you notice a strange but appealing smell.\n" + T + "You recall that some merchants use magic elixirs to make their selling easier...\n" +
          PLY + "Reese" + T + " suddenly appears out of nowhere, with a smile on his face.\n");
        else await out("\n" + header("Weaponstore, run by Tully the troll") + "\n" +
          T + "You enter the dusty old weaponstore and notice that the shelves\n" + T + "are filled with all kinds of different weapons. Yet you know that the\n" +
          T + "real powerful items dwells somewhere deeper within this mysterious\n" + T + "building.\n" + T + "A fat troll stumbles out from a room nearby and greets you.\n");
        await out("\n" + T + "(You have " + GOLD + n(P.gold) + T + " gold coins)   " + T + (armor ? "You wear: " + ITEM + (P.armor || "nothing") : "You wield: " + ITEM + (P.weapon || "your bare hands")) + "\n\n" +
          cols(["{R}eturn to street", "{B}uy", armor ? "{T}he best armor" : "{T}he best weapon", "{S}ell", "{L}ist items"]));
        refresh = false;
      }
      await out("\n" + T + (armor ? "Armor" : "Weapons") + " (R,B,T,S,L) : ");
      const k = await readKey("RBTSL");
      outNow("\n");
      if (k === "R") return;
      if (k === "L") {
        if (!list) { const r = await call("shop/list", { kind }); if (!r) continue; list = r.items; }
        await itemPages(list, armor);
        refresh = true;
        continue;
      }
      if (k === "S") {
        const r = await call("shop/sell", { kind });
        if (r && r.offer) {
          await out(T + (armor ? owner + " offers " : "The troll declares that he will pay you ") + GOLD + n(r.offer.price) + T + " gold for your " + ITEM + r.offer.name + "\n");
          if (await yn("Will you sell it", "N")) await call("shop/sell", { kind, confirm: 1 });
        }
        continue;
      }
      let body = { kind };
      if (k === "B") {
        if (armor ? P.armor : P.weapon) { await out(TALK + (armor ? "Get rid of your old armor first!" : "Get rid of your old weapon first!") + "\n"); continue; }
        const q = await num(armor ? "Which one?" : "Which one? the troll mutters");
        if (!q) continue;
        body.n = q;
      } else if (k === "T") {
        if (armor ? P.armor : P.weapon) { await out(TALK + (armor ? "Get rid of your old armor first!" : "Get rid of your old weapon first!") + "\n"); continue; }
        await out("\n" + T + "You put your " + GOLD + n(P.gold) + T + " gold coins on the counter.\n");
        if (!armor) await out(T + "The old troll looks at the gold and then at you.\n" + TALK + "Alright, I'll se what I can do...\n");
      }
      const r = await call(k === "T" ? "shop/best" : "shop/buy", body);
      if (!r || !r.offer) continue;
      if (k === "T") await out(TALK + "I have exactly what you are looking for!" + T + ", " + PLY + owner + T + " says.\n");
      else await out(T + "So you want a " + ITEM + r.offer.name + "\n");
      if (r.offer.troll) await out(PLY + "Tully" + T + " blinks at you\n" + TALK + "Hey, we trolls gotta stick together!\n" + TALK + "therefore i will give ya a discount!\n");
      await out(T + "It will cost you " + GOLD + n(r.offer.price) + T + " in gold" + DIM + " (power " + r.offer.power + ")" + T + ".\n");
      if (await yn("Pay", "N")) await call(k === "T" ? "shop/best" : "shop/buy", { ...body, n: r.offer.n, confirm: 1 });
    }
  }
  async function itemPages(list, armor) {
    const per = 16;
    let page = 0;
    const own = armor ? P.armor : P.weapon;
    while (true) {
      cls();
      await out("\n" + HEAD + (armor ? " Ancient Armors" : " Ancient Weapons") + "               Price    Power\n");
      list.slice(page * per, page * per + per).forEach(([name, price, pow], i) => {
        const no = page * per + i + 1;
        const afford = price <= P.gold;
        outNow("|03 " + lpad(no, 3) + " " + (afford ? ITEM : DIM) + pad(name, 24) + (afford ? GOLD : DIM) + lpad(n(price), 10) + T + lpad(pow, 8) + (name === own ? HI + "  (yours)" : "") + "\n");
      });
      const pages = Math.ceil(list.length / per);
      await out("\n" + T + "Page " + (page + 1) + " of " + pages + "   {N}ext  {P}rev  {Q}uit : ");
      const k = await readKey("NPQ", { enter: "N" });
      if (k === "Q") return;
      if (k === "N") page = (page + 1) % pages;
      if (k === "P") page = (page + pages - 1) % pages;
    }
  }

  async function magicShop() {
    cls();
    await out("\n" + header("Magic Shop, run by Ravanella the gnome") + "\n" +
      T + "You enter the dark and dusty boutique, filled with all sorts\n" + T + "of strange objects. As you examine the place you notice a\n" +
      T + "few druids and wizards searching for orbs and other mysterious items.\n" + T + "When you reach the counter you try to remember what you were looking for.\n\n" +
      TALK + "What shall it be ? " + T + "Ravanella asks.\n\n" + cols(["{H}ealing potions", "{S}how something", "{R}eturn"]));
    while (true) {
      await out("\n" + T + "Magic Shop (H,S,R) : ");
      const k = await readKey("HSR");
      outNow("\n");
      if (k === "R") return;
      if (k === "S") {   // the papers from the dungeons (MAGIC.PAS)
        await out(PLY + "Ravanella" + T + " looks at you and says :\n" + TALK + " So show me what you got!\n" + (P.dquest ? T + "{1} Papers concerning Grimsks criminal activities.\n" : "") + T + "{N}othing\n" + T + ":");
        const c = await readKey(P.dquest ? "1N" : "N");
        outNow("\n");
        if (c === "1") await call("magic/papers");
        else await out(T + "You stand there like a sheep. You have nothing to show!\n" + T + "(idiot!)\n");
        continue;
      }
      const z = P.level * 5;
      let max = Math.floor(P.gold / z);
      if (P.healing + max > P.maxheals) max = P.maxheals - P.healing;
      if (P.healing >= P.maxheals) { await out(MAG + "You already have the maximum number of healing potions.\n"); continue; }
      if (max <= 0) { await out(MAG + "You can't afford anything!\n"); continue; }
      await out(T + "Current price is " + GOLD + n(z) + T + " gold per potion. You have " + GOLD + n(P.gold) + T + " gold.\n" + T + "You have " + MAG + n(P.healing) + T + " potions\n");
      const q = await num("How many? (max " + n(max) + " potions)", 0);
      if (q > 0) await call("monk", { n: q, shop: 1 });
    }
  }

  async function healer() {
    cls();
    await out("\n" + HEAD + "-*- The Golden Bow, Healing Hut -*-\n\n" + T + "Jadu The Fat is sitting at his desk, reading a book.\n" + T + "He is wearing a monks robe and a golden ring.\n\n" +
      cols(["{H}eal Disease", "{S}tatus", "{R}eturn to street"]));
    while (true) {
      await out("\n" + T + "Healing Hut (H,S,R) : ");
      const k = await readKey("HSR");
      outNow("\n");
      if (k === "R") return;
      if (k === "S") { await status(); continue; }
      const r = await call("healer", {});
      if (!r) continue;
      await out("\n" + HEAD + "Affecting Diseases\n" + HEAD + "------------------\n");
      if (!P.diseases.length) { await out(T + "You are not affected by any diseases. Jadu goes back to his book.\n"); continue; }
      const NAMES = ["Blindness", "Plague", "Smallpox", "Measles", "Leprosy"];
      for (const d of P.diseases) { const i = NAMES.indexOf(d); await out(RED + d + T + " - " + GOLD + n(r.costs[i]) + T + " gold\n"); }
      if (await yn("Cure all", "Y")) await call("healer", { which: "all" });
    }
  }

  async function bank() {
    while (true) {
      cls();
      await out("\n" + header("Bank of Wealth, managed by Lobba the Gnome") + "\n" +
        T + "You enter the bank, which resides in the finer areas of\n" + T + "the town. A huge safe is located at the back of the room.\n" +
        T + "You can also see some guards posted around the place.\n" + T + "An old gnome appears and asks you of your business.\n\n" +
        T + "gold on hand .. " + GOLD + n(P.gold) + "\n" + T + "gold in bank .. " + GOLD + n(P.bank) + "\n" +
        (P.interest ? DIM + "(the bank has paid you " + n(P.interest) + " in interest so far, 3% a day)\n" : "") + "\n" +
        cols(["{D}eposit gold", "{W}ithdraw", "{R}eturn"]) + "\n" + T + "Bank (D,W,R) : ");
      const k = await readKey("DWR");
      outNow("\n");
      if (k === "R") return;
      const v = await num(k === "D" ? "Deposit how much" : "Withdraw how much", k === "D" ? P.gold : P.bank);
      if (v === null || v <= 0) continue;
      await call("bank", { op: k === "D" ? "deposit" : "withdraw", amount: v });
      await sleep(700);
    }
  }

  // ------------------------------------------------------------ the Level Masters (LEVMAST.PAS)
  async function master() {
    cls();
    await out("\n" + HEAD + "Visit the wise men :\n\n" + "|07(Press Enter to visit your current master : " + P.master + ")\n\n" +
      MASTERS.map((m, i) => T + "{" + "1234567890"[i] + "} " + m + ", " + MASTER_TITLES[i] + ".").join("\n") + "\n" + T + "{A} Abort\n" + T + "Choice :");
    const k = await readKey("1234567890A", { enter: P.masterNo });
    outNow("\n");
    if (k === "A") { await out(T + "You walk away..\n"); await sleep(600); return; }
    if (k !== P.masterNo) {
      await out("\n|07You have not chosen Your normal Master : " + GOLD + P.master + "\n");
      if (!(await yn("Do you wish to learn from " + MASTERS[(+k || 10) - 1] + " instead", "N"))) return;
      const r = await call("master/choose", { master: k });
      if (!r || !r.offer) return;
      await out(T + "This will cost You " + GOLD + n(r.offer.price) + T + " gold.\n");
      if (P.gold < r.offer.price) { await out(T + "And You can't afford it!\n"); await pause(); return; }
      if (!(await yn("Pay", "N"))) return;
      await call("master/choose", { master: k, confirm: 1 });
    }
    while (true) {
      await out("\n" + header("Residence of " + P.master) + cols(["{L}evel Raise", "{S}tatus", "{R}eturn"]) + "\n" + T + "Master (L,S,R) : ");
      const c = await readKey("LSR");
      outNow("\n");
      if (c === "R") return;
      if (c === "S") { await status(); continue; }
      await call("master/raise");
      await pause();
    }
  }

  // ------------------------------------------------------------ the Inn (INNC.PAS) and the Dormitory (DORM.PAS)
  async function inn() {
    while (true) {
      cls();
      await out("\n" + header("The Empty Barrel, run by Garth") + "\n" +
        T + "You enter the pub which is filled with a strange mix of creatures.\n" + T + "Screaming trolls and grim-looking orcs are spread out at small tables\n" +
        T + "in the center of the room. Elves and humans are mostly concentrated at\n" + T + "the bar, involved in deep conversations about the latest events.\n\n" +
        cols(["{G}et a Room", "{A}ttack Guest", "{T}eam corner", "{S}tatus", "{R}eturn"]) + "\n" + T + "Inn (G,A,T,S,R) : ");
      const k = await readKey("GATSR");
      outNow("\n");
      if (k === "R") return;
      if (k === "S") { await status(); continue; }
      if (k === "G") { if (await getRoom()) return "slept"; continue; }
      if (k === "T") { await teamCorner(); continue; }
      const x = await attackSleeper(true);
      if (x === "dead") return x;
    }
  }
  async function getRoom() {
    await out("\n" + T + "You walk up to " + PLY + "Garth" + T + " and ask him if there are any available rooms.\n" +
      TALK + "\"Well, of course you can have a room if you can pay.\"\n" +
      [1, 2, 3, 4].map(f => T + "{" + "DFST"[f - 1] + "}" + pad(FLOOR_NAMES[f].slice(1), 14) + "- " + GOLD + n(ROOMS[f])).join("\n") + "\n" + T + "{A}bort : ");
    const k = await readKey("DFSTA");
    outNow("\n");
    if (k === "A") return false;
    const floor = "DFST".indexOf(k) + 1;
    if (P.gold < ROOMS[floor]) { await out(T + "You can't afford it! (" + n(ROOMS[floor]) + " gold)\n"); await pause(); return false; }
    await out(DIM + "(The higher the floor, the more it costs anyone to bribe their way to your door.)\n");
    if (!(await yn("Are you sure that you want the room", "N"))) return false;
    const r = await call("sleep", { floor });
    if (r && r.slept) { await pause(); return true; }
    return false;
  }
  async function dormitory() {
    let menu = true;
    while (true) {
      if (menu) {
        cls();
        await out("\n" + header("Dormitory of the Franciscan order") + "\n" +
          T + "You enter the dormitory and watch all the sleeping\n" + T + "adventurers. They are lying there like babies. Loud snores\n" +
          T + "come from the trolls, silent breathing from the elves and short\n" + T + "snivels from the gnolls, as if they were having bad dreams or something...\n\n" +
          cols(["{A}ttack guest", "{L}ist of Souls", "{S}tatus", "{G}o to sleep", "{R}eturn"]));
        menu = false;
      }
      await out("\n" + T + "Dormitory (L,A,S,G,R) : ");
      const k = await readKey("LASGR");
      outNow("\n");
      if (k === "R") return;
      if (k === "S") { await status(); menu = true; continue; }
      if (k === "G") {
        if (await yn("Stay here for the night", "N")) { const r = await call("sleep", { floor: 0 }); if (r && r.slept) { await pause(); return "slept"; } }
        else await out(RED + "Nah, You deserve better than this.\n");
        continue;
      }
      if (k === "L") {
        const r = await call("sleepers", {});
        if (!r) continue;
        await out("\n" + HEAD + "Sleeping adventurers :\n" + HEAD + "______________________\n");
        if (!r.sleepers.length) await out(T + "Nobody. The beds are empty.\n");
        for (const s of r.sleepers.slice(0, 15)) await out(PLY + esc(s.name) + T + ", the " + s.race.toLowerCase() + " (" + "|03level " + s.level + " " + s.cls + T + ")" + (s.beggar ? DIM + " at the Beggars Wall" : "") + (s.team ? TC + " [" + esc(s.team) + "]" : "") + "\n");
        await pause(); menu = true;
        continue;
      }
      const x = await attackSleeper(false);
      if (x === "dead") return x;
      menu = true;
    }
  }
  async function attackSleeper(atInn) {
    const r = await call("sleepers", { inn: atInn });
    if (!r) return;
    const list = r.sleepers.slice(0, 9);
    if (!list.length) { await out("\n" + T + (atInn ? "Nobody is staying at the Inn tonight." : "Apparently there is no one to fight here!") + "\n"); await pause(); return; }
    await out("\n" + T + pick(["Who's gonna taste steel?", "Who shall you fight?", "Who shall you kill?", "Who must die?"]) + "\n" +
      list.map((s, i) => T + "{" + (i + 1) + "} " + PLY + pad(esc(s.name), 20) + T + " level " + pad(s.level, 4) + pad(s.race + " " + s.cls, 22) + (atInn ? GOLD + n(s.bribe) + T + " in bribes" : "")).join("\n") +
      "\n" + T + "{A}bort : ");
    const k = await readKey("123456789".slice(0, list.length) + "A");
    outNow("\n");
    if (k === "A") return;
    const v = list[+k - 1];
    let res;
    if (atInn) {
      await out(T + "It will take " + GOLD + n(v.bribe) + T + " gold in bribes to get you near the room.\n");
      if (!(await yn("Pay", "N"))) return;
      res = await call("attack", { id: v.id, inn: true });
    } else {
      await out("\n" + T + "So, you wanna get rid of " + PLY + esc(v.name) + T + "!\n" +
        T + "{A}bort\n" + T + "{P}ick-pocket " + (P.pick < 1 ? RED + " **You have no attempts left**" : WHITE + " **You have " + P.pick + " attempts left**") + "\n" +
        T + "{M}urder\n" + T + "{W}ake up and challenge\n\n" + T + "Make your Move :");
      const how = await readKey("APMW");
      outNow("\n");
      if (how === "A") { await out(TALK + "Well, you can take care of this wimp later\n"); await pause(); return; }
      const body = { id: v.id, how };
      if (how === "P") {
        await out(T + "What do you go for?\n" + T + "{P}otions\n" + T + "{G}old\n" + T + ":");
        body.steal = await readKey("PG");
        outNow("\n");
      }
      if (how === "M") {
        await out(T + "Do you dare to try to kill " + (v.sex === 2 ? "her" : "him") + " in cold blood, while " + (v.sex === 2 ? "she" : "he") + "'s asleep?\n" +
          T + "{Y}eah, that " + v.race.toLowerCase() + "'s a gonner!\n" + T + "{C}hicken out\n" + T + ":");
        if ((await readKey("YC")) === "C") { outNow("\n"); await out(HI + "Chicken!\n"); await pause(); return; }
        outNow("\n");
      }
      res = await call("attack", body);
    }
    if (!res) { await pause(); return; }
    if (res.fight && (res.fight.mode === "pvp" || res.fight.mode === "beg")) return playerFight(res);
    await pause();
  }

  // ------------------------------------------------------------ player fights (PLVSPLC.PAS)
  async function playerFight(r) {
    await pause();
    let menu = true;
    while (r && r.fight && r.fight.mode === "pvp") {
      const f = r.fight;
      await out("\n" + PLY + "Your" + T + " hitpoints : " + WHITE + n(P.hps) + "\n" + PLY + esc(f.foe) + "s" + T + " hitpoints : " + WHITE + n(f.foeHps) + "\n");
      if (menu) {
        const items = ["{A}ttack", "{H}eal", "{Q}uick Heal", "{F}ight to Death", "{S}tatus"];
        if (P.canBackstab) items.push("{1} Backstab");
        if (P.canSoul) items.push("{1} Soul Strike");
        await out(cols(items, 22));
        menu = false;
      }
      await out("|06:" + T + " ");
      const k = await readKey("AHQFS1?", { enter: "A" });
      outNow("\n");
      if (k === "?") { menu = true; continue; }
      if (k === "S") { await status(); menu = true; continue; }
      if (k === "1" && !P.canBackstab && !P.canSoul) continue;
      const body = { cmd: k };
      if (k === "H") body.n = await num("Quaff how many potions (you have " + n(P.healing) + ")", 0);
      if (k === "F" && !(await yn("Fight to Death", "N"))) continue;
      if (k === "1" && P.canSoul) { body.amount = await num("How many hitpoints to use (max " + n(P.hps - 1) + ")", 0); if (!body.amount) continue; }
      r = await call("pvp", body);
      if (!r) return;
      if (r.dead) { await pause(); return "dead"; }
    }
    if (r && r.fight && r.fight.mode === "beg") {
      const spare = await yn("Spare " + esc(r.fight.foe) + "s miserable life", "N");
      r = await call("pvp/spare", { spare });
    }
    if (r && r.fight && r.fight.mode === "dng") return;   // the prison gate: guards come next (fightLoop)
    if (r && r.fight && r.fight.mode === "loot") {
      const take = r.fight.gold > 0 ? await yn("Take the gold", "Y") : false;
      let note = "";
      if (await yn("Leave a note to " + esc(r.fight.foe), "N")) {
        await out(T + "Enter Message [1 line]\n" + T + ":");
        note = await readLine({ max: 70 });
        if (note) await out(HI + "Message sent...\n");
      }
      r = await call("pvp/loot", { take, note });
    }
    await pause();
  }

  // ------------------------------------------------------------ news, rankings, quitting
  async function newsPaper() {
    let yesterday = false;
    while (true) {
      const r = await api("door/usurper/news", { yesterday }).catch(e => { if (e instanceof BoardError) return null; throw e; });
      if (!r) return;
      cls();
      await out("\n" + header((yesterday ? "Yesterday's" : "Today's") + " News in " + P.town + "  " + r.day) + "\n");
      if (!r.rows.length) await out(T + "Nothing happened. A quiet day in town.\n");
      const rows = r.rows.slice(-14);
      for (const x of rows) await out(GOLD + esc(x.head) + DIM + "  " + hm(x.at) + "\n" + x.body.split("\n").map(l => T + uc(l)).join("\n") + "\n");
      await out("\n" + T + "{Y}esterday's news  {T}oday's news  {Q}uit : ");
      const k = await readKey("YTQ", { enter: "Q" });
      if (k === "Q") return;
      yesterday = k === "Y";
    }
  }
  async function listCharacters(fame) {
    const r = await api("door/usurper/list", {}).catch(e => { if (e instanceof BoardError) return null; throw e; });
    if (!r) return;
    cls();
    if (!fame) {
      await out("\n" + header("Characters in " + P.town) + HEAD + pad("Name", 21) + pad("Race", 9) + pad("Class", 10) + lpad("Level", 6) + lpad("Experience", 13) + "  Status\n");
      for (const x of r.rows.slice(0, 16)) await out((x.king ? KC : PLY) + pad(esc(x.name), 21) + T + pad(x.race, 9) + pad(x.cls, 10) + WHITE + lpad(x.level, 6) + GOLD + lpad(n(x.exp), 13) + "  " +
        (x.king ? KC + (x.sex === 2 ? "QUEEN" : "KING") : x.prison ? RED + "jailed" : x.alive ? HI + "alive" : RED + "dead") + (x.team ? TC + " " + esc(x.team).slice(0, 12) : "") + "\n");
    } else {
      await out("\n" + header("Hall of Fame") + HEAD + pad("  #  Name", 26) + lpad("Level", 6) + lpad("Monsters", 10) + lpad("Players", 9) + lpad("Experience", 14) + "\n");
      r.rows.slice(0, 10).forEach((x, i) => outNow(WHITE + lpad(i + 1, 3) + "  " + PLY + pad(esc(x.name), 21) + WHITE + lpad(x.level, 6) + MON + lpad(n(x.mkills), 10) + RED + lpad(n(x.pkills), 9) + GOLD + lpad(n(x.exp), 14) + "\n"));
      const pk = r.rows.filter(x => x.pkills > 0).sort((a, b) => b.pkills - a.pkills)[0];
      if (pk) await out("\n" + T + "Most feared: " + PLY + esc(pk.name) + T + ", with " + RED + n(pk.pkills) + T + " player kills.\n");
    }
    await pause();
  }
  async function quitGame() {
    if (!(await yn("QUIT game", "N"))) return false;
    cls();
    await out("\n" + T + "How do you wanna spend the night ?\n" + T + "Go and get some sleep at the Dormitory, for free,\n" +
      T + "or pay for a room at the Inn, where nobody gets to your door without bribes.\n\n" +
      T + "Or try to earn a few bucks at the Beggars Wall. (you can get wasted on both places)\n\n" +
      T + "{D}ormitory   {I}nn room   {B}eggars Wall   {A}bort : ");
    const k = await readKey("DIBA", { enter: "D" });
    outNow("\n");
    if (k === "A") return false;
    if (k === "I") return getRoom();
    if (k === "B") {
      await out(T + "Everything costs. A place at the Beggars Wall among\n" + T + "the other poor bastards doesn't come for free.\n" +
        T + "It will cost you " + GOLD + "500" + T + " gold coins for a good seat.\n");
      if (!(await yn("Pay", "N"))) return false;
      const rb = await call("sleep", { floor: 7 });
      if (rb && rb.slept) { await pause(); return true; }
      return false;
    }
    await out(T + "You enter the Dormitory to get a good nights sleep.\n");
    const r = await call("sleep", { floor: 0 });
    if (r && r.slept) { await pause(); return true; }
    return false;
  }
  // ============================================================ phase 2: the realm
  // Any fight the board hands us (monsters, a duel, the next guard...) until it's over.
  async function fightLoop(r) {
    while (r && r.fight) {
      if (r.fight.mode === "dng") { if (await monsterFight(r) === "dead") return "dead"; r = lastR; continue; }
      if (["pvp", "beg", "loot"].includes(r.fight.mode)) { if (await playerFight(r) === "dead") return "dead"; r = lastR; continue; }
      break;
    }
    if (r && r.jailed) { await pause(); return "jailed"; }
    if (r && r.dead) return "dead";
    return null;
  }
  async function pickPlayer(prompt, opts = {}) {
    await out(T + prompt + "\n" + T + ": " + WHITE);
    const s = (await readLine({ max: 20 })).trim();
    if (!s) return null;
    const r = await call("realm/find", { name: s });
    if (!r) return null;
    const list = (r.found || []).filter(opts.filter || (() => true));
    if (!list.length) { await out(RED + "Nobody by that name.\n"); return null; }
    for (const v of list.slice(0, 9)) {
      outNow(PLY + esc(v.name) + T + " (level " + v.level + " " + v.race + " " + v.cls + ")" + (v.team ? TC + " [" + esc(v.team) + "]" : "") + T + " ");
      if (await yn("", "N")) return v;
    }
    return null;
  }

  // ------------------------------------------------------------ Challenges (CHALLENG.PAS)
  async function challenges() {
    while (true) {
      act("Usurper: challenges");
      cls();
      await out("\n" + header("Challenges") + "\n" +
        cols(["{D}ormitory", "{B}ounty hunting", "{Q}uests", "{G}ang war", "{A}ltar of the Gods", "{T}he Gym", "{C}laim town", "{F}lee town control", "{K}ings Castle", "{S}tatus", "{R}eturn to town"]) +
        "\n" + T + "Challenges (" + TC + (P.team ? esc(P.team) : "no team") + T + ", " + WHITE + P.tfights + T + " team fights) : ");
      const k = await readKey("DBQGATCFKSR");
      outNow("\n");
      if (k === "R") return;
      if (k === "S") { await status(); continue; }
      if (k === "D") { const x = await dormitory(); if (x) return x; continue; }
      if (k === "A") { await temple(); continue; }
      if (k === "T") { await gym(); continue; }
      if (k === "B") { await bounty(); continue; }
      if (k === "Q") { const x = await quests(); if (x) return x; continue; }
      if (k === "G") { const x = await gangWarScreen(); if (x) return x; continue; }
      if (k === "C") {
        if (!P.team) { await out(RED + "You are not a member of a team!\n"); await pause(); continue; }
        await out("\n" + HI + "The Town is mine!\n" + RED + "_".repeat(17) + "\n" + T + "This can be quite bloody business.\n" + T + "You can end up with a lot of stiffs here.\n");
        if (!(await yn("Really go to GANGWAR", "N"))) { await out(T + "Well, You can take'm out later.\n"); await pause(); continue; }
        const r = await call("gang/war", { turf: true });
        await pause();
        if (r && r.dead) return "dead";
        continue;
      }
      if (k === "F") {
        if (await yn("Are you SURE that you wanna leave town control", "N")) { await call("gang/flee"); await pause(); }
        continue;
      }
      if (k === "K") { const x = await castle(); if (x) return x; }
    }
  }

  // ------------------------------------------------------------ the Team Corner (TCORNER.PAS)
  async function teamCorner() {
    while (true) {
      act("Usurper: team corner");
      const r = await call("team/info");
      if (!r) return;
      cls();
      await out("\n" + header("Team Corner") + "\n" +
        (P.team ? T + "You are a member of " + TC + esc(P.team) + T + (r.team && r.team.turf ? GOLD + " (controls the town!)" : "") + "\n" : T + "You don't belong to a team.\n") + "\n" +
        cols(["{T}eam Rankings", "{I}nfo on Teams", "{Y}our team status", "{J}oin team", "{C}reate team", "{A}pply for membership", "{Q}uit team",
          "{P}assword change", "{M}essage teammates", "{0} Send stuff", "{E}xamine member", "{2} Sack Member", "{S}tatus", "{R}eturn"]) + "\n" + T + "Team Corner : ");
      const k = await readKey("TIYJCAQPME2SR0");
      outNow("\n");
      if (k === "R") return;
      if (k === "S") { await status(); continue; }
      if (k === "0") { await sendStuff(); continue; }
      if (k === "T" || k === "I") {
        await out("\n" + HEAD + "Usurper Team Rankings                    Scores\n" + HEAD + "=".repeat(47) + "\n");
        if (!r.ranks.length) await out(T + "No teams yet.\n");
        for (const x of r.ranks) await out(TC + pad(esc(x.name), 26) + T + pad(x.members + " member" + (x.members > 1 ? "s" : ""), 11) + WHITE + lpad(n(x.score), 10) +
          (k === "I" ? T + "  W" + x.wins + "/L" + x.losses : "") + (x.turf ? GOLD + "  *town*" : "") + "\n");
        await pause(); continue;
      }
      if (k === "Y" || k === "E" || k === "2") {
        if (!P.team) { await out(HEAD + "You don't belong to a team.\n"); await pause(); continue; }
        await out("\n" + TC + esc(P.team) + "\n");
        r.members.forEach((m, i) => outNow(T + "{" + (i + 1) + "} " + PLY + pad(esc(m.name), 20) + T + " level " + pad(m.level, 4) + pad(m.race + " " + m.cls, 22) +
          (m.prison ? RED + "jailed" : m.alive ? HI + "alive" : RED + "dead") + (m.online ? GOLD + " (awake)" : "") + "\n"));
        if (k === "Y") { await pause(); continue; }
        await out(T + (k === "E" ? "Examine" : "Sack") + " who? {0} nobody : ");
        const w = await readKey("0123456789".slice(0, r.members.length + 1));
        outNow("\n");
        if (w === "0") continue;
        const m = r.members[+w - 1];
        if (k === "E") {
          const x = await call("team/examine", { id: m.id });
          if (x && x.member) { const q = x.member; await out(PLY + esc(q.name) + T + ", the " + q.race + " " + q.cls + ", level " + WHITE + q.level + T + "\n" +
            T + "Hitpoints " + WHITE + q.hps + "/" + q.maxhps + T + "  Strength " + WHITE + q.str + T + "  Defence " + WHITE + q.def + "\n" +
            T + "Weapon " + ITEM + (q.weapon || "fists") + T + "  Armor " + ITEM + (q.armor || "none") + "\n" + T + "Kills: " + WHITE + n(q.mkills) + T + " monsters, " + WHITE + n(q.pkills) + T + " players\n"); }
        } else if (await yn("Throw " + esc(m.name) + " out of the team", "N")) await call("team/sack", { id: m.id });
        await pause(); continue;
      }
      if (k === "J" || k === "A") {
        await out(T + (k === "J" ? "Which gang would you like to join?" : "What gang would you like to join?") + "\n" + T + ":" + WHITE);
        const name = (await readLine({ max: 25 })).trim();
        if (!name) continue;
        if (k === "A") { await call("team/apply", { name }); await pause(); continue; }
        await out(T + "Enter password\n" + T + ":");
        const pw = await readLine({ max: 10, mask: true });
        await call("team/join", { name, pw });
        await pause(); continue;
      }
      if (k === "C") {
        if (!(await yn("Create a New Team", "N"))) continue;
        await out("\n" + HEAD + "Team Creation\n" + HEAD + "_".repeat(13) + "\n" + T + "So, " + PLY + esc(P.name) + T + ". You want to create a team for you and your\n" +
          T + "brave comrades. Well then, choose a teamname and password\n" + T + "and go and round up some fellows.\n\n" + T + "Choose a teamname (max 25 characters)\n" + T + ":" + WHITE);
        const name = (await readLine({ max: 25 })).trim();
        if (!name) continue;
        await out(T + "Choose a team password\n" + T + ":");
        const pw = await readLine({ max: 10, mask: true });
        await out(T + "Please verify (type password again)\n" + T + ":");
        const pw2 = await readLine({ max: 10, mask: true });
        if (pw !== pw2) { await out(RED + "Passwords don't match.\n"); await pause(); continue; }
        await call("team/create", { name, pw });
        await pause(); continue;
      }
      if (k === "Q") { if (P.team && await yn("Really Quit " + TC + esc(P.team) + T, "N")) await call("team/quit"); else if (!P.team) await out(HEAD + "You don't belong to a team.\n"); await pause(); continue; }
      if (k === "P") {
        if (!P.team) { await out(HEAD + "You don't belong to a team.\n"); await pause(); continue; }
        await out(T + "Enter old password\n" + T + ":"); const old = await readLine({ max: 10, mask: true });
        await out(T + "Enter new password\n" + T + ":"); const pw = await readLine({ max: 10, mask: true });
        await out(T + "Reenter for verification\n" + T + ":"); const pw2 = await readLine({ max: 10, mask: true });
        if (pw !== pw2) await out(T + "Verification failed. Try again.\n"); else await call("team/pw", { old, pw });
        await pause(); continue;
      }
      if (k === "M") {
        if (!P.team) { await out(HEAD + "You don't belong to a team.\n"); await pause(); continue; }
        await out(T + "Message to your teammates [1 line]\n" + T + ":" + WHITE);
        const text = await readLine({ max: 70 });
        if (text) await call("team/msg", { text });
        await pause();
      }
    }
  }

  // ------------------------------------------------------------ gang war (GANGWARS.PAS)
  async function gangWarScreen() {
    if (!P.team) { await out(RED + "You don't belong to a team!\n"); await pause(); return; }
    while (true) {
      cls();
      await out("\n" + header("Gang War") + "\n" + T + "Your team: " + TC + esc(P.team) + T + "   Team fights left: " + WHITE + P.tfights + "\n\n" +
        cols(["{C}heck teams", "{A}ttack team", "{R}eturn"]) + "\n" + T + "Gang war : ");
      const k = await readKey("CAR");
      outNow("\n");
      if (k === "R") return;
      const r = await call("team/info");
      if (!r) return;
      const others = r.ranks.filter(x => x.name.toUpperCase() !== P.team.toUpperCase());
      if (!others.length) { await out(T + "There are no other teams to fight.\n"); await pause(); continue; }
      others.slice(0, 9).forEach((x, i) => outNow(T + (k === "A" ? "{" + (i + 1) + "} " : "    ") + TC + pad(esc(x.name), 26) + T + pad(x.members + " member" + (x.members > 1 ? "s" : ""), 11) + WHITE + lpad(n(x.score), 10) + (x.turf ? GOLD + "  *town*" : "") + "\n"));
      if (k === "C") { await pause(); continue; }
      await out(T + "Attack which team? {0} none : ");
      const w = await readKey("0123456789".slice(0, Math.min(9, others.length) + 1));
      outNow("\n");
      if (w === "0") continue;
      const res = await call("gang/war", { team: others[+w - 1].name });
      await pause();
      if (res && res.dead) return "dead";
    }
  }

  // ------------------------------------------------------------ the Castle (CHALLENG.PAS, CASTLE.PAS)
  async function castle() {
    let r = await call("castle/info");
    if (!r) return;
    let c = r.castle;
    cls();
    await out("\n" + T + "You journey the winding road up to the gates of the Castle.\n" + T + "..\n");
    if (c.isKing) return throneRoom();
    await out(T + "Seeking the " + (c.sex === 2 ? "Queen" : "King") + "...\n");
    if (c.name) await out("\n" + T + "The almighty " + c.race + " " + KC + esc(c.name) + T + " is sitting comfortably on the throne.\n" + T + "It's about time somebody removed this self-righteous dictator!\n");
    else await out("\n" + T + "The throne is empty!\n");
    while (true) {
      await out("\n" + HI + "You are standing outside the Castle\n" + cols(["{T}he Royal Guard", "{P}rison", "{D}onate to the Royal Purse", "{I}nfiltrate the Castle", "{H}istory of Monarchs", "{R}eturn to town"]) +
        T + "Outside the Castle : ");
      const k = await readKey("TPDIHR");
      outNow("\n");
      if (k === "R") { await out(T + "You decide to head back..\n"); return; }
      if (k === "H") { await monarchs(); continue; }
      if (k === "D") {
        await out(T + "You decide to give a helping hand to the Royal Family.\n" + T + "Benevolence towards the Monarchy might prove to be a\n" + T + "good investment for the future.\n" +
          T + "You have " + GOLD + n(P.gold) + T + " gold coins.\n");
        const x = await num("How much will you donate", 0);
        if (x > 0 && await yn("Donate " + GOLD + n(x) + T + " gold coins", "Y")) await call("castle/donate", { amount: x });
        else if (x !== null) await out(RED + "Grr! Get out of here!\n");
        continue;
      }
      if (k === "T") {
        r = await call("castle/info"); if (!r) continue; c = r.castle;
        await out("\n" + HEAD + "The Royal Guard\n");
        if (!c.guards.length) await out(T + "No one serves in the Royal Guard.\n");
        for (const g of c.guards) await out(PLY + pad(esc(g.name), 20) + T + " level " + g.level + " " + g.race + " " + g.cls + "\n");
        if (c.isGuard) { if (await yn("Quit your Guard job", "N")) await call("castle/guard", { op: "quit" }); continue; }
        if (!(await yn("Apply for Royal Guard duty", "N"))) continue;
        await out(T + "You need to fill out this application and then await The Royal\n" + T + "Office decision. The " + (c.sex === 2 ? "Queen" : "King") + " also has to approve your application.\n");
        const pay = await num("How much do you demand for Daily Salary", 1000);
        if (pay !== null && await yn("Send this application", "Y")) await call("castle/guard", { op: "apply", pay });
        continue;
      }
      if (k === "P") { await prisonGate(); if (P.location === 6) return "jailed"; if (P.hps < 1) return "dead"; continue; }
      // infiltrate
      let ri = await call("castle/infiltrate", {});
      if (!ri) { await pause(); continue; }
      if (ri.empty) {
        await out(T + "The Castle seems to be in disarray!\n" + T + "No King or Queen is to be found anywhere. People are just\n" + T + "running around in a disorganized manner.\n");
        if (await yn("Proclaim yourself " + (P.sex === 2 ? "QUEEN" : "KING"), "N")) { const rc = await call("castle/infiltrate", { proclaim: true }); await pause(); if (rc && rc.crowned) return throneRoom(); }
        continue;
      }
      if (!ri.confirm) { await pause(); continue; }
      if (!(await yn("Infiltrate the Castle", "N"))) { await out(WHITE + "Weakling!\n"); continue; }
      ri = await call("castle/infiltrate", { go: true });
      const x = await siege(ri);
      if (x) return x;
      if (P.king) return throneRoom();
    }
  }
  async function siege(r) {
    while (r) {
      await pause();
      const x = await fightLoop(r);
      if (x) return x;
      if (P.king) { await out("\n" + GOLD + "Welcome your highness!\n"); await pause(); return null; }
      if (!P.siege) return null;
      if (P.siege === "guards" && !(await yn("Press on into the Castle", "Y"))) { await call("castle/siege", { abort: true }); return null; }
      r = await call("castle/siege", {});
    }
    return null;
  }
  async function monarchs() {
    const r = await call("monarchs");
    if (!r) return;
    await out("\n" + HI + "List of Monarchs\n");
    if (!r.monarchs.length) await out(T + "No one has ruled this realm yet.\n");
    for (const m of r.monarchs) await out(KC + pad(esc(m.name), 20) + T + pad(m.race, 9) + T + "crowned " + m.crowned + (m.ended ? ", " + (m.how || "gone") + " " + m.ended + " (" + m.days + " days)" : GOLD + "  reigning") + "\n");
    await pause();
  }

  // the ruler's own Castle (CASTLE.PAS)
  async function throneRoom() {
    while (true) {
      act("Usurper: the Castle");
      const r = await call("castle/info");
      if (!r) return;
      const c = r.castle;
      if (!c.isKing) return;
      cls();
      await out("\n" + header("The Castle of " + P.town) + T + "Day " + WHITE + (c.days + 1) + T + " of your reign.  Treasury: " + GOLD + n(c.treasury) + T + "  Tax: " + WHITE + c.tax + "%\n\n" +
        cols(["{P}rison cells", "{O}rders", "{C}heck Security", "{F}iscal matters", "{Q}uests", "{H}istory of Monarchs", "{A}bdicate", "{G}o to sleep", "{S}tatus", "{R}eturn to town"]) +
        "\n" + T + "Castle : ");
      const k = await readKey("POCFQHAGSR");
      outNow("\n");
      if (k === "R") return;
      if (k === "S") { await status(); continue; }
      if (k === "H") { await monarchs(); continue; }
      if (k === "G") {
        await out(T + "Taking your rest within the Castle walls can be the difference\n" + T + "between life or death.\n");
        if (await yn("Take your Royal Rest here", "N")) { const rs = await call("king/sleep"); if (rs && rs.slept) { await pause(); return "slept"; } }
        else await out(RED + "Nah, You are not really tired.\n");
        continue;
      }
      if (k === "A") { if (await yn("Abdicate and give up the Crown", "N")) { await call("king/abdicate"); await pause(); return; } continue; }
      if (k === "O") {
        await out(T + "Royal Proclamation [1 line]\n" + T + ":" + WHITE);
        const text = await readLine({ max: 70 });
        if (text) await call("king/proclaim", { text });
        await pause(); continue;
      }
      if (k === "F") {
        await out("\n" + T + "Treasury " + GOLD + n(c.treasury) + T + ", tax " + WHITE + c.tax + "%" + T + " (" + ["all", "good", "evil"][c.taxAlign] + " pay)\n" +
          cols(["{T}axes", "{A}dd gold to Treasury", "{W}ithdraw gold", "{R}eturn"]) + T + ": ");
        const f = await readKey("TAWR");
        outNow("\n");
        if (f === "T") {
          await out(HEAD + "Taxes are deducted from Players Bank Accounts every day.\n" + HEAD + "You can set the tax to be for GOOD, EVIL or ALL characters.\n");
          const x = await num("Set tax (0-5%)", c.tax);
          if (x === null) continue;
          let align = 0;
          if (x > 0) { await out(T + "Tax alignment: {A}ll must pay  {G}ood characters must pay  {E}vil characters must pay : "); align = "AGE".indexOf(await readKey("AGE")); outNow("\n"); }
          await call("king/tax", { tax: x, align });
        } else if (f === "A" || f === "W") {
          const x = await num(f === "A" ? "Add how much" : "Withdraw how much", 0);
          if (x > 0) await call("king/treasury", { op: f === "A" ? "add" : "withdraw", amount: x });
        }
        if (f !== "R") await pause();
        continue;
      }
      if (k === "C") { await security(c); continue; }
      if (k === "P") { await prisonCells(c); continue; }
      if (k === "Q") {
        await out("\n" + T + "You can issue " + WHITE + c.questsLeft + T + " more quests today.\n");
        if (!c.questsLeft || !(await yn("Issue a new Quest", "Y"))) continue;
        const difficulty = await num("Set Quest difficulty (1-10)", 5);
        await out(T + "Reward type: {0} nothing {1} experience {2} gold {3} potions {4} darkness {5} chivalry : ");
        const rtype = +(await readKey("012345")); outNow("\n");
        let reward = 1;
        if (rtype) { await out(T + "Reward size: {1} low {2} medium {3} high : "); reward = +(await readKey("123")); outNow("\n"); }
        await out(T + "Penalty for failure: {0} nothing {1} experience {2} gold {3} potions {4} darkness {5} chivalry : ");
        const ptype = +(await readKey("012345")); outNow("\n");
        let penalty = 1;
        if (ptype) { await out(T + "Penalty size: {1} low {2} medium {3} high : "); penalty = +(await readKey("123")); outNow("\n"); }
        const minlevel = await num("Minimum level", 1), maxlevel = await num("Maximum level", 100), days = await num("Days to complete (1-15)", 7);
        await out(T + "Your comment [1 line]\n" + T + ":" + WHITE);
        const comment = await readLine({ max: 60 });
        await call("king/quest", { difficulty, rtype, reward, ptype, penalty, minlevel, maxlevel, days, comment });
        await pause();
      }
    }
  }
  async function security(c) {
    while (true) {
      const r = await call("castle/info");
      if (!r) return;
      c = r.castle;
      await out("\n" + RED + "Royal Security\n" + "|07" + "_".repeat(14) + "\n" +
        T + "Moat: " + (c.moatNr ? WHITE + c.moatNr + " " + TALK + c.moat + (c.moatNr > 1 ? "s" : "") : DIM + "nothing") + "\n" +
        T + "Guards: " + (c.guards.length ? c.guards.map(g => PLY + esc(g.name) + DIM + " (" + n(g.pay) + "/day)").join(T + ", ") : DIM + "none") + "\n" +
        T + "Applications: " + (c.apps.length ? WHITE + c.apps.length : DIM + "none") + "\n\n" +
        cols(["{M}oat", "{H}ire guard", "{S}ack guard", "{R}eturn"]) + T + ": ");
      const k = await readKey("MHSR");
      outNow("\n");
      if (k === "R") return;
      if (k === "M") {
        await out("\n" + HEAD + "Moat creatures\n" + c.moatList.map((m, i) => T + "{" + (i + 1) + "} " + TALK + pad(m.name, 17) + GOLD + lpad(n(m.cost), 11) + T + " gold   " + m.hps + " hps").join("\n") +
          "\n" + T + "{X} drain the moat   {0} done : ");
        const w = await readKey("12345X0");
        outNow("\n");
        if (w === "0") continue;
        if (w === "X") { if (await yn("Remove all moat creatures", "N")) await call("king/moat", { op: "remove" }); continue; }
        const q = await num("How many", 1);
        if (!(q > 0)) continue;
        await out(T + "{I} will use my own funds.  {T}he royal treasury must pay. : ");
        const fund = await readKey("IT"); outNow("\n");
        await call("king/moat", { op: "buy", type: +w - 1, n: q, fund: fund === "T" ? "T" : "O" });
        continue;
      }
      if (k === "H") {
        if (!c.apps.length) { await out(T + "Nobody has applied.\n"); continue; }
        c.apps.forEach((a, i) => outNow(T + "{" + (i + 1) + "} " + PLY + pad(esc(a.name), 20) + T + " level " + a.level + " " + a.cls + ", wants " + GOLD + n(a.pay) + T + " a day\n"));
        await out(T + "Which one? {0} none : ");
        const w = await readKey("0123456789".slice(0, c.apps.length + 1)); outNow("\n");
        if (w === "0") continue;
        const a = c.apps[+w - 1];
        await out(T + "{H}ire  {R}eject : ");
        const d = await readKey("HR"); outNow("\n");
        await call("king/guard", { op: d === "H" ? "hire" : "reject", id: a.id });
        continue;
      }
      if (k === "S") {
        if (!c.guards.length) { await out(T + "You have no guards.\n"); continue; }
        c.guards.forEach((g, i) => outNow(T + "{" + (i + 1) + "} " + PLY + esc(g.name) + "\n"));
        await out(T + "Sack which guard? {0} none : ");
        const w = await readKey("0123456789".slice(0, c.guards.length + 1)); outNow("\n");
        if (w !== "0") await call("king/guard", { op: "sack", id: c.guards[+w - 1].id });
      }
    }
  }
  async function prisonCells(c) {
    while (true) {
      await out("\n" + HEAD + "The Royal Prison\n" + T + "Prison sentences left today: " + WHITE + c.prisonsLeft + T + ", executions left: " + WHITE + c.executeLeft + "\n" +
        cols(["{P}risoners", "{F}ree prisoner", "{I}mprison subject", "{E}xecute", "{R}eturn"]) + T + ": ");
      const k = await readKey("PFIER");
      outNow("\n");
      if (k === "R") return;
      if (k === "I") {
        await out(T + "You send for the Captain of the Guard.\n" + TALK + "Who shall we bring in sire?\n");
        const v = await pickPlayer("Name", { filter: x => !x.prison && !x.king });
        if (!v) continue;
        await out(PLY + esc(v.name) + T + " is brought before you in chains.\n\n" + HEAD + "And the charges ?\n" +
          cols(["{H}igh treason", "{P}ublic nuisance", "{D}isrespect to the Crown", "{C}riminal activities", "{N}o charges necessary", "{A}bort"]) + T + ": ");
        const ch = await readKey("HPDCNA"); outNow("\n");
        if (ch === "A") { await out(T + "You release " + PLY + esc(v.name) + T + ".\n"); continue; }
        await call("king/imprison", { id: v.id, charge: ch, days: 1 });
        const rr = await call("castle/info"); if (rr) c = rr.castle;
        continue;
      }
      const r = await call("king/prisoners");
      if (!r) continue;
      if (!r.prisoners.length) { await out(T + "The cells are empty.\n"); continue; }
      r.prisoners.slice(0, 9).forEach((q, i) => outNow(T + (k === "P" ? "    " : "{" + (i + 1) + "} ") + PLY + pad(esc(q.name), 20) + T + " " + q.race + (q.alive ? "" : RED + " (dead)") + T + " (" + WHITE + q.days + T + " day" + (q.days > 1 ? "s" : "") + " left)\n"));
      if (k === "P") continue;
      await out(T + (k === "F" ? "Free" : "Execute") + " which prisoner? {0} none : ");
      const w = await readKey("0123456789".slice(0, Math.min(9, r.prisoners.length) + 1)); outNow("\n");
      if (w === "0") continue;
      const q = r.prisoners[+w - 1];
      if (k === "E" && !(await yn("Have " + esc(q.name) + " executed", "N"))) continue;
      await call(k === "F" ? "king/free" : "king/execute", { id: q.id });
      const rr = await call("castle/info"); if (rr) c = rr.castle;
    }
  }

  // ------------------------------------------------------------ the prison (PRISONC.PAS / PRISONF.PAS)
  async function prisonCell() {
    let menu = true;
    while (true) {
      act("Usurper: in prison");
      if (menu) {
        cls();
        await out("\n" + header("The Royal Prison") + "\n" + T + "You are locked up in a cold, damp cell.\n" + T + "You have " + WHITE + Math.max(1, P.prisonDays) + T + " day" + (P.prisonDays > 1 ? "s" : "") + " left in prison.\n\n" +
          cols(["{W}ho else is here", "{D}emand to be released!", "{E}scape!", "{S}tatus", "{Q}uit"]));
        menu = false;
      }
      await out("\n" + T + "Prison (" + WHITE + P.escapes + T + " escape attempts left) : ");
      const k = await readKey("WDESQ");
      outNow("\n");
      if (k === "Q") {
        if (!(await yn("QUIT game", "N"))) continue;
        await out(HEAD + "You cover yourself with some hay and try to get some sleep.\n" + HEAD + "It will be a long and cold night with the rats...\n");
        await pause(); return;
      }
      if (k === "S") { await status(); menu = true; continue; }
      if (k === "D") { await call("prison/demand"); continue; }
      if (k === "W") {
        const r = await call("prison/info");
        if (!r) continue;
        await out("\n" + HEAD + "Prisoners\n" + HEAD + "_".repeat(9) + "\n");
        if (!r.others.length) await out("|06You are the only prisoner here right now!\n");
        for (const q of r.others) await out(PLY + esc(q.name) + T + " the " + q.race + (q.online ? GOLD + " (awake)" : q.alive ? T + " (sleeping)" : T + " (" + RED + "dead" + T + ")") + T + " (" + WHITE + q.days + T + " day" + (q.days > 1 ? "s" : "") + " left)\n");
        continue;
      }
      if (!(await yn("|06Jail-Break" + T, "Y"))) continue;
      const r = await call("prison/escape");
      if (r && r.free) { await pause(); await mainStreet(); return; }
    }
  }
  async function prisonGate() {
    while (true) {
      await out("\n" + HEAD + "The Prison\n" + cols(["{P}risoners", "{F}ree a prisoner", "{S}tatus", "{R}eturn"]) + T + ": ");
      const k = await readKey("PFSR");
      outNow("\n");
      if (k === "R") return;
      if (k === "S") { await status(); continue; }
      const r = await call("prison/list");
      if (!r) continue;
      if (!r.prisoners.length) { await out(T + "The cells are empty right now.\n"); continue; }
      r.prisoners.slice(0, 9).forEach((q, i) => outNow(T + (k === "F" ? "{" + (i + 1) + "} " : "    ") + PLY + pad(esc(q.name), 20) + T + " the " + q.race + (q.alive ? "" : RED + " (dead)") + T + " (" + WHITE + q.days + T + " day" + (q.days > 1 ? "s" : "") + " left)\n"));
      if (k === "P") continue;
      await out(T + "Who do you wanna set free? {0} nobody : ");
      const w = await readKey("0123456789".slice(0, Math.min(9, r.prisoners.length) + 1)); outNow("\n");
      if (w === "0") continue;
      const q = r.prisoners[+w - 1];
      if (!(await yn("Break " + esc(q.name) + " out", "N"))) continue;
      const res = await call("prison/free", { id: q.id });
      if (!res) continue;
      await pause();
      const x = await fightLoop(res);
      if (x) return x;
    }
  }

  // ------------------------------------------------------------ bounty hunting (BOUNTY.PAS)
  async function bounty() {
    while (true) {
      cls();
      await out("\n" + header("Bounty Hunters") + "\n" + T + "A wall covered with Wanted posters. Kill the wanted and the reward is yours.\n\n" +
        cols(["{W}anted posters", "{A}dd bounty", "{C}lear bounty", "{S}tatus", "{R}eturn"]) + T + "Bounty hunters : ");
      const k = await readKey("WACSR");
      outNow("\n");
      if (k === "R") return;
      if (k === "S") { await status(); continue; }
      if (k === "W" || k === "C") {
        const r = await call("bounty/list");
        if (!r) continue;
        const list = k === "C" ? r.wanted.filter(w => w.mine) : r.wanted;
        await out("\n" + HEAD + "Wanted " + RED + "DEAD" + HEAD + "                      Reward       Set by\n");
        if (!list.length) await out(T + (k === "C" ? "You have no posters up." : "No posters. The town is full of saints.") + "\n");
        list.slice(0, 15).forEach((w, i) => outNow(T + (k === "C" ? "{" + (i + 1) + "} " : "    ") + RED + pad(esc(w.target), 20) + T + " level " + pad(w.level, 4) + GOLD + lpad(n(w.gold), 11) + "  " + PLY + esc(w.by_name) + "\n"));
        if (k === "C" && list.length) {
          await out(T + "Clear which poster? {0} none : ");
          const w = await readKey("0123456789".slice(0, Math.min(9, list.length) + 1)); outNow("\n");
          if (w !== "0") await call("bounty/clear", { id: list[+w - 1].id });
        }
        await pause(); continue;
      }
      const v = await pickPlayer("Who are you looking for?", { filter: x => !x.king });
      if (!v) continue;
      await out(T + "You have " + GOLD + n(P.gold) + T + " gold coins.\n");
      const gold = await num("How much will you put on " + esc(v.name) + "s head", 0);
      if (!(gold > 0)) { await out(WHITE + "Get Real.\n"); continue; }
      const anon = await yn("Anonymously", "N");
      await call("bounty/add", { id: v.id, gold, anon });
      await pause();
    }
  }

  // ------------------------------------------------------------ royal quests (PLYQUEST.PAS)
  async function quests() {
    while (true) {
      const r = await call("quests/list");
      if (!r) return;
      cls();
      await out("\n" + header("Royal Quests") + "\n");
      if (!r.quests.length) await out(T + "There are no quests posted. The " + "Royals" + " have nothing for you.\n");
      const list = r.quests.slice(0, 9);
      list.forEach((q, i) => outNow(T + "{" + (i + 1) + "} " + (q.mine ? GOLD + "YOURS " : "") + T + "Difficulty " + WHITE + q.difficulty + T + ", " + WHITE + q.monsters + T + " beasts, levels " + q.minlevel + "-" + q.maxlevel +
        ", " + (q.mine ? WHITE + q.left + T + " days left" : q.days + " days") + "\n" + T + "     Reward: " + GOLD + q.reward + T + "  Penalty: " + RED + q.penalty + T + "  " + DIM + "\"" + esc(q.comment) + "\" -" + esc(q.by) + "\n"));
      await out("\n" + T + "Pick a quest, or {R}eturn : ");
      const k = await readKey("123456789".slice(0, list.length) + "R");
      outNow("\n");
      if (k === "R") return;
      const q = list[+k - 1];
      if (!q.mine) { if (await yn("Claim this Quest", "Y")) await call("quests/claim", { id: q.id }); await pause(); continue; }
      await out(T + "{G}o slay the beasts   {D}rop the quest   {A}bort : ");
      const a = await readKey("GDA"); outNow("\n");
      if (a === "D") { if (await yn("Give the Quest back", "N")) await call("quests/drop", { id: q.id }); continue; }
      if (a !== "G") continue;
      const res = await call("quests/go", { id: q.id });
      if (!res) { await pause(); continue; }
      await pause();
      const x = await fightLoop(res);
      await pause();
      if (x) return x;
    }
  }

  // ============================================================ phase 3: love, family and home
  // Dates, gifts and family evenings that wait for an answer (MAIL.PAS mail requests)
  async function answerRequests(list) {
    for (const q of list) {
      cls();
      const who = PLY + esc(q.from) + T;
      const heads = { immortal: " Divine Offer ", hold: " Invitation ", dinner: " Invitation ", kiss: " Invitation ", roses: " Roses ", chocolate: " Gift ", scorpions: " Gift ", family: " Home " };
      await out("\n" + RED + "<3<3<3" + HEAD + (heads[q.kind] || " Message ") + RED + "<3<3<3\n\n");
      const ask = {
        hold: [who + " would like to go out with you.", "Agree to date"],
        dinner: [who + " would like to take you out for dinner.", "Agree to date"],
        kiss: [who + " would like to kiss you!", "Agree to be kissed"],
        roses: [who + " has sent you Roses!", "Accept the Flowers"],
        chocolate: [who + " has sent you a present.\n" + T + "It's a box with a surprise inside!", "Open the Box"],
        scorpions: [who + " has sent you a present.\n" + T + "It's a box with a surprise inside!", "Open the Box"],
        family: ["Your spouse " + who + " left you a note:\n" + TALK + "  \"Let's spend a quiet evening at home together tonight.\"", "Agree"],
        gymcard: [who + " applies for a club card to your Gym.", "Give " + who + " a club card"],
        immortal: [(q.data && q.data.threat ? "The Immortal " + GODC + esc(q.from) + T + " sends word that you had better join " + GODC + "the flock" + T + "... or else!" : "The Immortal " + GODC + esc(q.from) + T + " invites you to join " + GODC + "the flock" + T + "."), "Worship " + GODC + esc(q.from) + T],
      }[q.kind] || [who + " wants something from you.", "Agree"];
      await out(T + ask[0] + "\n" + q.rel.map(l => uc(l)).join("\n") + "\n\n");
      const yes = await yn(ask[1], "Y");
      const r = await call("req/answer", { id: q.id, yes });
      if (r && r.dead) { await pause(); return "dead"; }
      if (r && r.liked) {
        if (await yn("Do you like " + PLY + esc(q.from) + T + " better now", "Y")) await call("love/better", r.liked);
        else await out(PLY + esc(q.from) + T + " is still a blockhead.\n");
      }
      await pause();
    }
  }
  async function nameBabies(list) {
    for (const b of list) {
      cls();
      await out("\n" + HEAD + "Babies!\n" + HEAD + "_______\n" + T + "A baby " + (b.sex === 2 ? "girl" : "boy") + (b.other ? " (with " + PLY + esc(b.other) + T + ")" : "") + " has not been named yet.\n");
      for (let i = 0; i < 3; i++) {
        await out(T + "Name your " + (b.sex === 2 ? "daughter" : "son") + " : " + WHITE);
        const name = (await readLine({ max: 20 })).trim();
        if (!name) break;
        if (await call("child/name", { id: b.id, name })) break;
      }
      await pause();
    }
  }
  async function findSomeone(prompt, filter) {
    const v = await pickPlayer(prompt, { filter: filter || (() => true) });
    return v;
  }
  function relWord(rel) { return { 20: "Love", 30: "Passion", 40: "Friendship", 50: "Trust", 60: "Respect", 70: "Neutral", 80: "Suspicion", 90: "Anger", 100: "Enemy", 110: "Hate" }[rel]; }

  // ------------------------------------------------------------ the Love Corner (LOVERS.PAS)
  async function loveCorner() {
    let menu = true;
    while (true) {
      act("Usurper: love corner");
      if (menu) {
        cls();
        await out("\n" + HEAD + "-=*=- Love Corner -=*=-\n\n" + T + "Come and train your romantic skills. There is nothing\n" + T + "like a big family and a house.\n" +
          T + "You should also make up to the people you have hurt through the\n" + T + "years. You can poison other persons lives here as well.\n\n" +
          cols(["{A}pproach somebody", "{C}hildren in the Realm", "{L}ove history", "{D}ivorce", "{V}isit Lydia", "{M}arried Couples", "{P}ersonal", "{E}xamine child", "{G}ift shop",
            "{S}tatus", "{R}eturn"], 25));
        menu = false;
      }
      await out("\n" + T + "Love Corner (" + WHITE + (P.intimacy ?? 0) + T + " intimate acts left) : ");
      const k = await readKey("ACLDVMPEGSR?");
      outNow("\n");
      menu = true;
      if (k === "R") return;
      if (k === "?") continue;
      if (k === "S") { await status(); continue; }
      if (k === "A") { const x = await approach(); if (x) return x; continue; }
      if (k === "C") { await childrenList("children/realm", "Children in the Realm"); continue; }
      if (k === "E") { await examineChild(); continue; }
      if (k === "L") { await loveHistory(); continue; }
      if (k === "M") { await marriedCouples(); continue; }
      if (k === "P") { const r = await call("love/relations"); if (r) await showRelations(r.relations, true); continue; }
      if (k === "V") { await gossip(); continue; }
      if (k === "G") { await giftShop(); continue; }
      if (k === "D") {
        await out("\n" + HEAD + pick(["Better get rid of the matrimonial bonds right away!", "Single Life! Here I come!"]) + "\n");
        const r = await call("love/divorce");
        if (r && r.offer) {
          await out(WHITE + "The family is gathered!\n" + T + "You and " + PLY + esc(r.offer.name) + T + " have been married for " + WHITE + n(r.offer.days) + T + " days.\n");
          if (await yn("Divorce " + PLY + esc(r.offer.name) + T, "N") && await yn("You will lose custody of your children! Go ahead anyway", "N")) await call("love/divorce", { confirm: true });
          else await out(WHITE + "Good choice! Don't give up your marriage for no good reason.\n");
        }
        await pause();
      }
    }
  }
  async function approach() {
    await out("\n" + HEAD + "What are you interested in\n" + T + "{F}emales\n" + T + "{M}ales\n" + T + "{B}oth\n" + T + "{R}eturn\n" + T + ":");
    const sx = await readKey("FMBR", { enter: "B" });
    outNow("\n");
    if (sx === "R") return;
    await out("|11*establish relation*\n");
    const v = await findSomeone("Meet with who?", x => sx === "B" || (sx === "F" ? x.sex === 2 : x.sex === 1));
    if (!v) { await pause(); return; }
    while (true) {
      const r = await call("love/approach", { id: v.id });
      if (!r || !r.target) { await pause(); return; }
      const t = r.target, heart = t.mine <= 40 ? "<3<3<3" : "+++";
      cls();
      await out("\n" + RED + heart + PLY + esc(P.name) + T + " and " + PLY + esc(t.name) + RED + heart + "\n\n" + t.looks.map(uc).join("\n") + "\n\n" + t.rel.map(uc).join("\n") + "\n\n" +
        T + "{C}hange attitude\n" + T + "{I}ntimate\n" + T + "{M}arry\n" + T + "{R}eturn\n\n" + T + "Choice :");
      const k = await readKey("CIMR");
      outNow("\n");
      if (k === "R") return;
      if (k === "C") {
        await out("\n" + T + "Declare Your Feelings for " + PLY + esc(t.name) + T + " !!\n" + "|09<R>espect <T>rust <F>riendship <P>assion <L>ove\n" + "|06<N>eutral\n" + RED + "<S>uspicion <A>nger <E>nemy <H>ate\n" + T + "(D)one\n\n" + T + "Pick a Feeling :");
        const f = await readKey("RTFPLNSAEHD");
        outNow("\n");
        const rel = { R: 60, T: 50, F: 40, P: 30, L: 20, N: 70, S: 80, A: 90, E: 100, H: 110 }[f];
        if (rel && await yn("Are You sure", "Y")) { await call("love/feel", { id: t.id, rel }); await pause(); }
        continue;
      }
      if (k === "I") {
        if ((P.intimacy ?? 0) < 1) { await out(RED + "You have no intimate sessions left today.\n"); await pause(); continue; }
        await out("\n" + HEAD + "How would you like to spend your time with " + PLY + esc(t.name) + HEAD + ".\n" + HEAD + "You have " + GOLD + n(P.intimacy) + HEAD + " intimate sessions left.\n\n" +
          T + "{H}old hands  {D}inner  {K}iss  {R}eturn\n" + T + "Romantic move :");
        const m = await readKey("HDKR");
        outNow("\n");
        if (m !== "R") { await call("love/date", { id: t.id, kind: m }); await pause(); }
        continue;
      }
      if (k === "M") {
        await out(WHITE + ".....hang on....\n");
        const o = await call("love/marry", { id: t.id });
        if (o && o.offer) {
          await out(WHITE + "MARRY\n" + (o.offer.times ? WHITE + "You and " + PLY + esc(t.name) + WHITE + " have been married " + GOLD + n(o.offer.times) + WHITE + " time" + (o.offer.times > 1 ? "s" : "") + " before.\n" : ""));
          if (await yn("Marry " + PLY + esc(t.name) + T, "N")) {
            if (P.gold < o.offer.cost) await out(RED + "Your wedding will cost " + GOLD + n(o.offer.cost) + RED + ".\n" + RED + "You don't have the gold!\n");
            else if (await yn("Pay " + GOLD + n(o.offer.cost) + T + " gold coins for the wedding", "Y")) await call("love/marry", { id: t.id, confirm: true });
          }
        }
        await pause();
        continue;
      }
    }
  }
  async function showRelations(rel, own) {
    cls();
    await out("\n" + HEAD + (own ? "Your relations" : esc(rel.who) + "s relations") + "\n" + HEAD + "______________\n");
    if (!rel.list.length) await out(T + "No relations worth mentioning.\n");
    for (const x of rel.list.slice(0, 7)) await out(uc(x.l1) + "\n" + uc(x.l2) + "\n");
    if (rel.list.length > 7) await out(DIM + "(and " + (rel.list.length - 7) + " more)\n");
    if (rel.summary.length) await out("\n" + rel.summary.map(l => uc(l.replace(/#/g, own ? "you" : esc(rel.who)).replace(/\$/g, own ? "ve" : "s"))).join("\n") + "\n");
    await pause();
  }
  async function loveHistory() {
    while (true) {
      cls();
      await out("\n" + HEAD + "-*- History of Love -*-\n\n" + T + "{M}arriages & Divorces   {1} Current Marriages\n" + T + "{C}hild-births & Leavers  {R}eturn\n\n" + T + ":");
      const k = await readKey("MC1R");
      outNow("\n");
      if (k === "R") return;
      if (k === "1") { await marriedCouples(); continue; }
      const r = await call("love/history", { kind: k === "C" ? "child" : "love" });
      if (!r) return;
      cls();
      await out("\n" + HEAD + (k === "C" ? "Child-births & Leavers" : "Marriages & Divorces") + "\n" + HEAD + "______________________\n");
      if (!r.history.length) await out(T + "Nothing yet.\n");
      for (const h of r.history) await out("|02[" + h.day + "] " + uc(h.body) + "\n");
      await pause();
    }
  }
  async function marriedCouples() {
    const r = await call("love/couples");
    if (!r) return;
    cls();
    await out("\n" + HEAD + "Married Couples\n" + HEAD + "_______________\n");
    if (!r.couples.length) await out(T + "Nobody is married in this town.\n");
    for (const x of r.couples.slice(0, 16)) await out(PLY + pad(esc(x.a), 20) + T + " and " + PLY + pad(esc(x.b), 20) + T + " " + WHITE + lpad(n(x.days), 5) + T + " days" + (x.kids ? ", " + WHITE + x.kids + T + " kid" + (x.kids > 1 ? "s" : "") : "") + "\n");
    await pause();
  }
  async function childrenList(action, title, body) {
    const r = await call(action, body || {});
    if (!r) return null;
    const list = r.children || [];
    cls();
    await out("\n" + HEAD + title + "\n" + HEAD + "#  " + pad("Name", 20) + pad("Gender", 8) + pad("Age", 5) + pad("Status", 11) + pad("Health", 11) + "Parents\n");
    if (!list.length) await out(T + "No children.\n");
    list.slice(0, 15).forEach((c, i) => outNow(WHITE + pad(String(i + 1), 3) + KIDC + pad(esc(c.name), 20) + T + pad(c.sex === 2 ? "female" : "male", 8) + pad(String(c.age), 5) +
      (c.location ? GOLD + pad("Orphanage", 11) : "|11" + pad("Home", 11)) + (c.health === "normal" ? WHITE + pad("excellent", 11) : RED + pad("*" + c.health + "*", 11)) +
      PLY + esc(c.mother || "?").slice(0, 10) + T + "/" + PLY + esc(c.father || "?").slice(0, 10) + "\n"));
    return list.slice(0, 15);
  }
  async function chooseChild(list, prompt) {
    if (!list || !list.length) { await pause(); return null; }
    const v = await num(prompt || "Which child (0 = none)", 0);
    if (!v || v < 1 || v > list.length) return null;
    return list[v - 1];
  }
  async function viewChild(c) {
    cls();
    await out("\n" + KIDC + esc(c.name) + T + " (born " + GOLD + c.born + T + ")\n" + "|01=-=-=-=-=-=-=-=-=-=-=-=-=\n" +
      T + "Age: " + HI + c.age + T + (c.age > 1 ? " years" : " year") + "\n" + T + "Sex: " + HI + (c.sex === 2 ? "female" : "male") + "\n\n" +
      T + "Location: " + HI + (c.location ? GOLD + "Royal Orphanage" : WHITE + "home") + "\n" + T + "Health: " + HI + (c.health === "normal" ? "normal" : RED + c.health + "!") + "\n" +
      T + "Soul: " + HI + c.soul + "\n" + (c.bastard ? T + "Born out of wedlock.\n" : "") + "\n" +
      T + "Mother: " + PLY + (esc(c.mother) || RED + "*UNKNOWN*") + "\n" + T + "Father: " + PLY + (esc(c.father) || RED + "*UNKNOWN*") + "\n" +
      (c.orgMother && c.orgMother !== c.mother ? T + "Biological Mother: " + PLY + esc(c.orgMother) + "\n" : "") + (c.orgFather && c.orgFather !== c.father ? T + "Biological Father: " + PLY + esc(c.orgFather) + "\n" : "") +
      (c.motherAccess ? "" : RED + esc(c.mother) + " is DENIED access to " + esc(c.name) + "\n") + (c.fatherAccess || !c.father ? "" : RED + esc(c.father) + " is DENIED access to " + esc(c.name) + "\n") +
      T + (c.royal ? "CHILD IS ROYAL" : "child is not of royal blood") + "\n");
    await pause();
  }
  async function examineChild() {
    await out("\n|11-*Examine Child*-\n");
    const list = await childrenList("children/realm", "Children in the Realm");
    const c = await chooseChild(list, "Examine which child (0 = none)");
    if (c) await viewChild(c);
  }
  async function gossip() {
    while (true) {
      await out("\n" + PLY + "Lydia" + T + " can help you with various problems.\n\n" + T + "{S}py on relations\n" + T + "{P}oison relation\n" + T + "{R}eturn\n\n" + T + "Gossip-monger : ");
      const k = await readKey("SPR");
      outNow("\n");
      if (k === "R") return;
      if (k === "S") {
        await out("\n" + PLY + "Lydia" + T + " the gossip-monger knows everything worth knowing\n" + T + "of people when it comes to love and relations.\n" + T + "You must pay her " + GOLD + "1,500" + T + " gold coins for any kind of information.\n");
        if (!(await yn("Agreed", "Y"))) { await out(RED + "Begone!\n"); continue; }
        const v = await findSomeone("Who's relations would you like to examine?");
        if (!v) continue;
        const r = await call("love/spy", { id: v.id });
        if (r && r.relations) await showRelations(r.relations, false);
        continue;
      }
      await out("\n|09-*Dirty Trick*-\n" + T + "Name the two persons who's relation you would like to ruin\n" + T + "(failed attempts will be reported to the people you are trying to hurt!)\n");
      const a = await findSomeone("|11first person you want to harm");
      if (!a) continue;
      const b = await findSomeone("|11second person you want to harm");
      if (!b) continue;
      const o = await call("love/poison", { a: a.id, b: b.id });
      if (o && o.offer && await yn("Setup " + PLY + esc(a.name) + T + " against " + PLY + esc(b.name) + T + " for " + GOLD + n(o.offer.price) + T + " gold", "Y")) await call("love/poison", { a: a.id, b: b.id, confirm: true });
      await pause();
    }
  }
  async function giftShop() {
    await out("\n" + T + "You enter the small Gift Shop.\n");
    while (true) {
      await out("\n" + HEAD + "Gift Shop\n" + T + "{B}ouquet of roses  {S}urprise Box  {H}elp  {R}eturn\n" + T + "Gift Shop : ");
      const k = await readKey("BSHR");
      outNow("\n");
      if (k === "R") return;
      if (k === "H") { await out(WHITE + "Buy a gift to impress your friend or date.\n" + WHITE + "Send a nasty surprise to your enemies.\n"); continue; }
      if (k === "B") {
        if (!(await yn("Pay " + GOLD + "1,500" + T + " for a bouquet of Roses", "Y"))) continue;
        const v = await findSomeone("Who's the sweet-heart?");
        if (v && await yn("Send " + "|11Bouquet" + T + " to " + PLY + esc(v.name) + T, "Y")) await call("love/gift", { id: v.id, kind: "roses" });
        continue;
      }
      const v = await findSomeone("Who shall receive the gift-box?");
      if (!v) continue;
      await out(WHITE + "OK.\n" + T + "Select Gift\n" + T + "{C}hocolate\n" + T + "{S}corpions\n" + T + "{A}bort\n" + T + ":");
      const g = await readKey("CSA");
      outNow("\n");
      if (g === "A") continue;
      const kind = g === "C" ? "chocolate" : "scorpions";
      const o = await call("love/gift", { id: v.id, kind });
      if (!o || !o.offer) continue;
      await out(T + "Sending " + (g === "C" ? GOLD + "Chocolate" : MON + "scorpions") + T + " to " + PLY + esc(v.name) + T + " will cost " + GOLD + n(o.offer.price) + T + ".\n" +
        T + (g === "C" ? "Nice nice! Delivering Chocolate is a nice gesture." : "Naughty naughty! Delivering scorpions is not a very nice thing to do.") + "\n");
      if (await yn("Go ahead", "Y")) await call("love/gift", { id: v.id, kind, confirm: true });
    }
  }

  // ------------------------------------------------------------ Home Sweet Home (HOME.PAS)
  async function home() {
    let menu = true;
    while (true) {
      act("Usurper: at home");
      const r = await call("home/info");
      if (!r) return;
      if (menu) {
        cls();
        await out("\n" + HEAD + "Home Sweet Home\n" + HEAD + "_______________\n\n" + (r.spouse ? T + "You are married to " + PLY + esc(r.spouse) + T + ".\n" : "") +
          T + "Your place is nothing to write home about.\n" + T + "Most people would call it a dump...\n\n" +
          cols(["{L}ist Children", "{N}ursery", "{H}ome evening", "{M}anage custody", "{S}tatus", "{G}o to sleep", "{R}eturn"], 22));
        menu = false;
      }
      await out("\n" + T + "Home : ");
      const k = await readKey("LNHMSGR?");
      outNow("\n");
      if (k === "R") { await out(T + "Ahh, back in the busy streets.\n"); return; }
      if (k === "?") { menu = true; continue; }
      if (k === "S") { await status(); menu = true; continue; }
      if (k === "L") { await ownChildren(r); menu = true; continue; }
      if (k === "G") {
        if (await yn("Go to sleep", "N")) { const x = await call("home/sleep"); if (x && x.slept) { await pause(); return "slept"; } }
        else await out(RED + "Nah, you can sleep later!\n");
        continue;
      }
      if (k === "H") {
        if (!r.spouse) { await out(RED + "You are not married!\n"); continue; }
        if (await yn("Spend an evening at home with " + PLY + esc(r.spouse) + T, "N")) await call("home/family");
        else await out(WHITE + "Not right now. You have this headache.\n");
        continue;
      }
      if (k === "N") { await nursery(); menu = true; continue; }
      if (k === "M") { await custody(); menu = true; continue; }
    }
  }
  async function ownChildren(r) {
    cls();
    await out("\n|11  -*-Your Children-*-\n");
    if (!r.children.length) await out(T + "You have no children.\n");
    for (const c of r.children.slice(0, 15)) await out(KIDC + pad(esc(c.name), 20) + T + pad(c.sex === 2 ? "female" : "male", 8) + pad(c.age + (c.age > 1 ? " years" : " year"), 10) +
      (c.location ? GOLD + pad("Orphanage", 11) : "|11" + pad("Home", 11)) + (c.health === "normal" ? WHITE + "excellent" : RED + "*" + c.health + "*") + T + "  " + c.kind + (c.access ? "" : RED + " (no custody)") + "\n");
    await pause();
  }
  async function nursery() {
    while (true) {
      cls();
      await out("\n" + HEAD + "The Nursery\n" + HEAD + "___________\n\n" + T + "{C}hildren\n" + T + "{P}lay with other children (nice)\n" + T + "{T}ransfer your child to the |11Royal Care-House" + T + ".\n" + T + "{S}tatus\n" + T + "{R}eturn\n\n" + T + "Nursery : ");
      const k = await readKey("CPTSR");
      outNow("\n");
      if (k === "R") return;
      if (k === "S") { await status(); continue; }
      if (k === "C") { const r = await call("home/info"); if (r) await ownChildren(r); continue; }
      if (k === "P") {
        await out(WHITE + "Party!\n" + "|11Invite a bunch of kids to play with your children.\n");
        await call("home/party");
        await pause();
        continue;
      }
      await out(WHITE + "*Get rid of those annoying kids*\n");
      const list = await childrenList("home/info", "Your Children");
      const c = await chooseChild(list, "Which child (0 = none)");
      if (!c) continue;
      await out(T + "Are you really sure about this!? You may never see " + KIDC + esc(c.name) + T + " again.\n");
      if (await yn("Transfer " + KIDC + esc(c.name) + T + " to the |13Royal Orphanage" + T, "N")) await call("home/child", { id: c.id, op: "orphanage" });
      await pause();
    }
  }
  async function custody() {
    while (true) {
      cls();
      await out("\n" + HEAD + "Custody of Children\n" + HEAD + "___________________\n\n" + T + "{C}hildren\n" + T + "{S}hare custody " + GOLD + "(nice)\n" + T + "{A}bandon child " + RED + "(bad)\n" +
        T + "{O}rphanage " + "|04(very bad)\n" + T + "{H}elp\n" + T + "{R}eturn\n\n" + T + "Custody : ");
      const k = await readKey("CSAOHR");
      outNow("\n");
      if (k === "R") return;
      if (k === "H") {
        await out(WHITE + "When parents divorce, the children stay with one of them.\n" + WHITE + "You can share the custody with the other parent again, give up\n" +
          WHITE + "your own custody, or send the child to the Royal Orphanage.\n");
        await pause(); continue;
      }
      if (k === "C") { const r = await call("home/info"); if (r) await ownChildren(r); continue; }
      const list = await childrenList("home/info", "Your Children");
      const c = await chooseChild(list, "Which child (0 = none)");
      if (!c) continue;
      const op = { S: "share", A: "abandon", O: "orphanage" }[k];
      if (await yn(k === "S" ? "Share custody of " + esc(c.name) : k === "A" ? "Abandon " + esc(c.name) : "Send " + esc(c.name) + " to the Royal Orphanage", "N")) await call("home/child", { id: c.id, op });
      await pause();
    }
  }

  // ============================================================ the Supreme Being (SUPREMEC.PAS)
  async function supreme() {
    cls();
    await out("\n" + T + "Slowly descending through the black mountain you suddenly find\n" + T + "yourself standing in front of three large metal doors.\n" + T + "You must choose one of these.\n\n" +
      GOLD + "{G}olden door\n" + "|07{S}ilver door\n" + "|06{B}ronze door\n" + T + ":");
    const d = await readKey("GSB");
    outNow("\n");
    const body = { door: d };
    if (d === "G" && P.dark <= 0) {
      await out("|11The Old Woman\n" + T + "\"I see that your soul is clean!\", the old woman cackles.\n" + T + "\"I can help you in your final quest if you give me 25 healing potions!\"\n");
      body.give = await yn("Give her the potions", "N");
    }
    if (d === "S" && P.chiv <= 0) {
      await out("|11The Red Turtle\n" + WHITE + "\"I can help you in your quest adventurer!\"" + T + ", the turtle says.\n");
      body.listen = await yn("Go ahead and listen to the animal", "N");
      if (body.listen) {
        await out(WHITE + "\"Answer these two questions right and I might help you\" :\n");
        body.a1 = await num("1. How many level masters are there in your town", 0);
        body.a2 = await num("2. How old are you?", 0);
      }
    }
    if (d === "B") {
      await out("|11The Oracle\n" + T + "The Oracle sits on a pillar and has a white staff in her right hand.\n" + T + "In her left hand the Oracle has a black staff.\n" + T + "{W}hite staff\n" + T + "{B}lack staff\n" + T + ":");
      body.staff = await readKey("WB"); outNow("\n");
    }
    if (!(await call("supreme/doors", body))) return;
    await pause();
    cls();
    await out("\n" + T + "**Final Encounter**\n" + T + "You have reached the deep, deep gap where Earth breathes...\n" + T + "With your wisdom and experience you soon realize that\n" + T + "this is the final test of your ability.\n\n" +
      T + "You have entered a large hall. The ground is filled\n" + T + "with rocks and some sort of sticky oil.\n" + T + "In the center of the hall you can see a stone altar.\n" + T + "Placed on the altar is a cup filled with a strange liquid.\n" +
      T + "As you examine the surroundings you can feel the presence of\n" + T + "something powerful watching you...\n\n" + T + "What will you do with the Cup on the altar ?\n" + T + "{D}rink the potion\n" + T + "{I}gnore\n" + T + ":");
    const c = await readKey("DI");
    outNow("\n");
    const r = await call("supreme/cup", { drink: c === "D" });
    if (!r) return;
    await pause();
    const x = await monsterFight(r);
    if (x === "dead") return "dead";
    if (P.completed) { await afterLife(); return "dead"; }
  }
  async function afterLife() {
    cls();
    await out("\n" + HEAD + "After-life\n" + T + "It's now time to decide if your time on Earth has come\n" + T + "to an end. Our almighty Father has a room for you in his\n" +
      T + "pantheon. However, your duty has been long and hard on earth.\n" + T + "You might want to stay mortal and enter the last dreamless sleep.\n\n" +
      T + "{B}ecome a God" + (P && P.sex === 2 ? "dess" : "") + "\n" + T + "{R}est In Peace\n" + T + ":");
    const k = await readKey("BR");
    outNow("\n");
    if (k === "R") { await call("supreme/after", { choice: "R" }); await pause(); return; }
    for (let i = 0; i < 5; i++) {
      await out(TALK + "So, what name do you want to be known by?\n" + T + ":" + WHITE);
      const name = (await readLine({ max: 22 })).trim();
      if (!name) continue;
      if (!(await yn(GODC + esc(name) + T + " is what you want", "Y"))) continue;
      const r = await call("supreme/after", { choice: "B", name });
      if (r && r.retired) { await pause(); await godWorld(); return; }
    }
  }

  // ============================================================ the Temple of the Gods (TEMPLE.PAS)
  async function selectGod(gods, prompt) {
    if (!gods.length) { await out(RED + "There are no Gods in this realm yet.\n"); return null; }
    await out(T + prompt + "\n" + gods.slice(0, 9).map((g, i) => T + "{" + (i + 1) + "} " + GODC + pad(esc(g.name), 22) + T + pad(g.title, 15) + WHITE + n(g.believers) + T + " believers").join("\n") + "\n" + T + "{A}bort : ");
    const k = await readKey("123456789".slice(0, Math.min(9, gods.length)) + "A");
    outNow("\n");
    return k === "A" ? null : gods[+k - 1];
  }
  async function temple() {
    let menu = true;
    while (true) {
      act("Usurper: temple of the gods");
      const r = await call("temple/info");
      if (!r) return;
      if (menu) {
        cls();
        await out("\n" + HEAD + " -*- Temple of the Gods -*-\n\n" + T + "The Temple area is crowded with monks, preachers and\n" + T + "processions of priests on their way to the altars.\n" + T + "The doomsday prophets are trying to get your attention.\n\n" +
          (r.god ? T + "You worship " + GODC + esc(r.god) + T + ".\n" : T + "You are not a believer.\n") + "\n" +
          cols(["{W}orship", "{D}esecrate altar", "{H}oly News", "{A}ltars", "{C}ontribute", "{G}od ranking", "{S}tatus", "{R}eturn"], 22));
        menu = false;
      }
      await out("\n" + T + "Temple area : ");
      const k = await readKey("WDHACGSR?");
      outNow("\n");
      if (k === "R") return;
      if (k === "?") { menu = true; continue; }
      if (k === "S") { await status(); menu = true; continue; }
      if (k === "A" || k === "G") {
        cls();
        await out("\n" + HEAD + (k === "A" ? "The Altars" : "God ranking") + "\n" + HEAD + pad("Name", 24) + pad("Rank", 16) + lpad("Believers", 10) + (k === "G" ? lpad("Power", 12) : "") + "\n");
        if (!r.gods.length) await out(T + "No altars have been raised. No mortal has reached the heavens yet.\n");
        for (const g of r.gods.slice(0, 16)) await out(GODC + pad(esc(g.name), 24) + T + pad(g.title, 16) + WHITE + lpad(n(g.believers), 10) + (k === "G" ? GOLD + lpad(n(g.exp), 12) : "") + "\n");
        await pause(); menu = true; continue;
      }
      if (k === "H") {
        const h = await call("temple/holynews");
        if (!h) continue;
        cls();
        await out("\n" + HEAD + "Holy News\n" + HEAD + "_________\n");
        if (!h.history.length) await out(T + "The heavens are silent.\n");
        for (const x of h.history) await out("|02[" + x.day + "] " + uc(x.body) + "\n");
        await pause(); menu = true; continue;
      }
      if (k === "W") {
        const body = {};
        if (r.god) {
          await out(T + "You currently worship " + GODC + esc(r.god) + T + ".\n");
          if (!(await yn("Have you lost your faith in " + GODC + esc(r.god) + T, "N"))) { await out(RED + "Good for you. The gods don't take too kindly on apostates.\n"); continue; }
          body.abandon = true;
          if (await yn("Send a note to " + GODC + esc(r.god) + T, "Y")) { await out(GOLD + "Note:" + WHITE); body.note = await readLine({ max: 70 }); }
        }
        const g = await selectGod(r.gods.filter(x => x.name !== r.god), HEAD + "Select a God to worship");
        if (g) body.god = g.id;
        if (body.god || body.abandon) await call("temple/worship", body);
        await pause(); menu = true; continue;
      }
      if (k === "C") {
        if ((P.chivnr ?? 1) < 1) { await out(RED + "You have no good deeds left today.\n"); continue; }
        const g = await selectGod(r.gods, HI + "-* Who shall receive your gift *-");
        if (!g) continue;
        if (r.god && r.god !== g.name) {
          await out(RED + esc(g.name) + " is not your God! Are you sure about this?\n" + RED + "The mighty " + esc(r.god) + " is not going to be happy.\n");
          if (!(await yn("Continue", "N"))) { await out(T + "Good for you!\n"); continue; }
        }
        await out(HI + "-* Sacrifice to the Gods *-\n" + T + "Send gold to Heaven " + GOLD + "(0 - " + n(P.gold) + ")\n");
        const x = await num("How much", 0);
        if (x > 0 && await yn("Sacrifice " + GOLD + n(x) + T + " gold to " + GODC + esc(g.name) + T, "N")) await call("temple/sacrifice", { god: g.id, gold: x });
        await pause(); menu = true; continue;
      }
      if (k === "D") {
        if (!(await yn("Do you really want to upset the gods", "Y"))) { await out(T + "good for you!\n"); continue; }
        const g = await selectGod(r.gods, T + "Whose altar?");
        if (g && await yn("Desecrate " + GODC + esc(g.name) + "s" + T + " altar", "N")) await call("temple/desecrate", { god: g.id });
        await pause(); menu = true; continue;
      }
    }
  }

  // ============================================================ the Divine Realm (GODWORLD.PAS)
  async function gcall(action, body) {   // like call(), for the Immortals
    try {
      const r = await api("door/usurper/" + action, body || {});
      if (r.out && r.out.length) await out(r.out.join("\n") + "\n|07");
      if (r.god) G = r.god;
      return r;
    } catch (e) {
      if (e instanceof BoardError) { await out("\n" + RED + esc(e.message) + "|07\n"); return null; }
      throw e;
    }
  }
  async function pickMortal(prompt) {
    await out(T + prompt + "\n" + T + ": " + WHITE);
    const s = (await readLine({ max: 20 })).trim();
    if (!s) return null;
    const r = await gcall("god/find", { name: s });
    if (!r || !r.found.length) { await out(RED + "Nobody by that name.\n"); return null; }
    for (const v of r.found.slice(0, 9)) { outNow(PLY + esc(v.name) + T + " (level " + v.level + " " + v.race + " " + v.cls + ") "); if (await yn("", "N")) return v; }
    return null;
  }
  async function godWorld() {
    const r0 = await gcall("god/enter");
    if (!r0) return;
    if (r0.mail && r0.mail.length) await showMail(r0.mail);
    let menu = true;
    while (true) {
      act("Usurper: in the Divine Realm");
      if (menu) {
        cls();
        await out("\n" + HEAD + "-**- The Divine Heaven -**-\n\n" + T + "You are standing on the slope of Trazz...\n" + T + "Floating around you are the billion stars of the sky.\n\n" +
          cols(["{I}mmortals", "{D}ivine intervention", "{V}isit Manwe", "{B}elievers", "{L}ist Mortals", "{E}xamine mortal", "{1} Immortal News", "{C}omment to the Mortals", "{N}ews", "{F}lock inspection", "{S}tatus", "{Q}uit"], 26));
        menu = false;
      }
      await out("\n" + T + "Heaven (" + GODC + esc(G.name) + T + ", " + WHITE + G.deeds + T + " deeds left) : ");
      const k = await readKey("IDVBLE1CNFSQ?");
      outNow("\n");
      menu = true;
      if (k === "Q") { await out(T + "You leave the heavens for now.\n"); return; }
      if (k === "?") continue;
      if (k === "S") {
        cls();
        await out("\n" + T + "You are " + GODC + esc(G.name) + "\n" + T + "Rank .. " + "|07" + G.title + " (level " + G.level + ")\n" + T + "Believers .. |07" + n(G.believers) + "\n" + T + "Deeds left .. |07" + G.deeds + "\n" + T + "Power .. |07" + n(G.exp) + "\n");
        await pause(); continue;
      }
      if (k === "I") {
        const r = await gcall("god/list");
        if (!r) continue;
        cls();
        await out("\n" + HEAD + "Immortals\n" + HEAD + pad("Name", 24) + pad("Rank", 16) + lpad("Believers", 10) + lpad("Power", 12) + "\n");
        for (const g of r.gods.slice(0, 16)) await out(GODC + pad(esc(g.name), 24) + T + pad(g.title, 16) + WHITE + lpad(n(g.believers), 10) + GOLD + lpad(n(g.exp), 12) + "\n");
        await pause(); continue;
      }
      if (k === "B" || k === "F") {
        let body = {};
        if (k === "F") {
          const l = await gcall("god/list");
          if (!l) continue;
          const g = await selectGod(l.gods.filter(x => x.id !== G.id), T + "Whose flock?");
          if (!g) continue;
          body = { god: g.id };
        }
        const r = await gcall("god/believers", body);
        if (!r) continue;
        cls();
        await out("\n" + HEAD + (k === "B" ? "Your Believers" : "Flock Inspection") + "\n" + HEAD + "______________\n");
        if (!r.flock.length) await out(T + "Nobody.\n");
        for (const m of r.flock.slice(0, 16)) await out(PLY + pad(esc(m.name), 21) + T + "level " + pad(String(m.level), 4) + pad(m.race + " " + m.cls, 22) + (m.alive ? HI + "alive" : RED + "dead") + "\n");
        await pause(); continue;
      }
      if (k === "L") {
        const r = await gcall("god/mortals");
        if (!r) continue;
        cls();
        await out("\n" + HEAD + "The Mortals\n" + HEAD + pad("Name", 21) + pad("Race", 9) + pad("Class", 10) + lpad("Level", 6) + "  Status\n");
        for (const m of r.mortals.slice(0, 16)) await out(PLY + pad(esc(m.name), 21) + T + pad(m.race, 9) + pad(m.cls, 10) + WHITE + lpad(m.level, 6) + "  " + (m.alive ? HI + "alive" : RED + "dead") + (m.god === G.id ? GODC + "  (yours)" : "") + "\n");
        await pause(); continue;
      }
      if (k === "E") {
        const v = await pickMortal("Examine which mortal?");
        if (!v) continue;
        const r = await gcall("god/examine", { id: v.id });
        if (!r || !r.mortal) continue;
        const m = r.mortal;
        cls();
        await out("\n" + PLY + esc(m.name) + T + ", level " + WHITE + m.level + T + " " + m.race + " " + m.cls + (m.king ? KC + "  (the ruler)" : "") + (m.prison ? RED + "  (in prison)" : "") + "\n\n" + m.looks.map(uc).join("\n") + "\n\n" +
          T + "Hitpoints : " + WHITE + n(m.hps) + "/" + n(m.maxhps) + "\n" + T + "Gold      : " + GOLD + n(m.gold) + T + " (bank " + GOLD + n(m.bank) + T + ")\n" + T + "Chivalry  : " + WHITE + n(m.chiv) + T + "   Darkness : " + WHITE + n(m.dark) + "\n" +
          T + "Worships  : " + (m.god ? GODC + esc(m.god) : T + "nobody (a pagan)") + "\n" + (m.team ? T + "Team      : " + TC + esc(m.team) + "\n" : ""));
        await pause(); continue;
      }
      if (k === "1") {
        const r = await gcall("god/holynews");
        if (!r) continue;
        cls();
        await out("\n" + HEAD + "Immortal News\n" + HEAD + "_____________\n");
        for (const x of r.history) await out("|02[" + x.day + "] " + uc(x.body) + "\n");
        await pause(); continue;
      }
      if (k === "N") { await newsPaper(); continue; }
      if (k === "C") {
        if (!(await yn("Make a statement to the Mortal World", "N"))) continue;
        await out(HI + "Enter your message\n" + T + ":" + WHITE);
        const s = await readLine({ max: 70 });
        if (s && await yn("Send this to the Mortal World", "Y")) await gcall("god/comment", { text: s });
        else await out(RED + "They don't deserve your words of wisdom!\n");
        await pause(); continue;
      }
      if (k === "V") {
        await out(T + "You enter " + "|06the Halls of Manwe" + T + ".\n" + T + "{A}sk for power  {S}tatus  {R}eturn : ");
        const a = await readKey("ASR"); outNow("\n");
        if (a === "A") { await gcall("god/manwe"); await pause(); }
        if (a === "S") { await gcall("god/status"); await out(T + "You are " + GODC + esc(G.name) + T + ", " + G.title + " (level " + G.level + "), power " + WHITE + n(G.exp) + "\n"); await pause(); }
        continue;
      }
      if (k === "D") { await divineIntervention(); continue; }
    }
  }
  async function divineIntervention() {
    while (true) {
      cls();
      await out("\n|09**Use your Powers**\n" + T + "{M}ortals\n" + T + "{P}risoners\n" + T + "{H}elp\n" + T + "{R}eturn\n\n" + T + "Divine Intervention : ");
      const k = await readKey("MPHR");
      outNow("\n");
      if (k === "R") return;
      if (k === "H") { await out("\n|11Chose category of people to use your powers on.\n"); await pause(); continue; }
      if (k === "P") {
        const r = await gcall("god/prisoners");
        if (!r) continue;
        await out("\n" + T + "You examine the Royal Prison.\n");
        if (!r.prisoners.length) { await out(T + "The cells are empty.\n"); await pause(); continue; }
        r.prisoners.slice(0, 9).forEach((x, i) => outNow(T + "{" + (i + 1) + "} " + PLY + pad(esc(x.name), 21) + T + "level " + x.level + "\n"));
        await out(T + "Who should be set free? {A}bort : ");
        const c = await readKey("123456789".slice(0, Math.min(9, r.prisoners.length)) + "A");
        outNow("\n");
        if (c !== "A") await gcall("god/free", { id: r.prisoners[+c - 1].id });
        await pause(); continue;
      }
      await out("\n|11You prepare to make use of your powers on the mortals.\n\n" + T + "{G}et a believer\n" + T + "{P}oison relation\n" + T + "{R}eturn\n\n" + T + "Influence Mortals : ");
      const m = await readKey("GPR");
      outNow("\n");
      if (m === "G") {
        const v = await pickMortal("Who would you like to recruit?");
        if (!v) continue;
        await out(GOLD + "How will you persuade " + PLY + esc(v.name) + GOLD + "?\n" + T + "{N}ormal invitation\n" + T + "{T}hreat\n" + T + "{A}bort\n" + T + ":");
        const how = await readKey("NTA"); outNow("\n");
        if (how === "A") { await out(MAG + "You have better things to do.\n"); continue; }
        await gcall("god/recruit", { id: v.id, threat: how === "T" });
        await pause();
      }
      if (m === "P") {
        await out(T + "hehe...\n|09-*Dirty Trick*-\n" + T + "Name the two persons who's relation you would like to ruin\n");
        const a = await pickMortal("|11first person you want to harm");
        if (!a) continue;
        const b = await pickMortal("|11second person you want to harm");
        if (!b) continue;
        await gcall("god/poison", { a: a.id, b: b.id });
        await pause();
      }
    }
  }

  // ============================================================ dungeon events (DUNGEVC.PAS, DUNGEV2.PAS)
  // The board asks; the options come with the answer. Fights in between go through monsterFight.
  async function eventLoop(r) {
    while (r) {
      if (r.dead) { await pause(); return "dead"; }
      if (r.uman) { await pause(); const x = await umanCave(); if (x) return x; return; }
      if (r.fight) {
        await pause();
        if (await monsterFight(r) === "dead") return "dead";
        r = lastR;
        if (!r || !r.event) { await pause(); return; }
        continue;
      }
      const e = r.event;
      if (!e) { await pause(); return; }
      let body;
      if (e.number) {
        const v = await num(e.prompt || "How much", 0);
        body = { key: "#", n: v || 0 };
      } else {
        await out("\n" + e.options.map(o => T + "{" + o[0] + "} " + esc(o[1])).join(e.options.length > 4 ? (e.options.length > 8 ? "   " : "\n") : "\n") + "\n" + T + (e.prompt ? esc(e.prompt) + " " : "") + ":");
        const k = await readKey(e.options.map(o => o[0]).join(""));
        outNow("\n");
        body = { key: k };
      }
      r = await call("dng/event", body);
    }
  }

  // ============================================================ the Cave of Uman (UMAN.PAS)
  async function umanCave() {
    let menu = true;
    while (true) {
      act("Usurper: the Cave of Uman");
      if (menu) {
        cls();
        await out("\n|11** Cave of Uman **\n" + T + "Hidden deep in the mountain, Uman is the oasis for many\n" + T + "travellers seeking a place of refuge.\n\n" +
          T + "{H}igh and Low\n" + T + "{T}ame the Bear\n" + T + "{I}ndian Wrestling\n" + T + "{S}tatus\n" + T + "{R}eturn to Dungeons\n");
        menu = false;
      }
      await out("\n" + T + "Uman Cave (H,T,I,S,R,?) : ");
      const k = await readKey("HTISR?");
      outNow("\n");
      if (k === "?") { menu = true; continue; }
      if (k === "R") { await out(HI + "You head back.\n"); return; }
      if (k === "S") { await status(); menu = true; continue; }
      if (k === "H") {
        while (true) {
          await out(T + "You have " + GOLD + n(P.gold) + T + " gold coins.\n");
          const bet = await num("Enter your bet (max 15,000)", 0);
          if (!bet || bet > P.gold || bet > 15000) { await out(WHITE + "Get lost!\n"); break; }
          await out(T + "{H}igh or {L}ow card :");
          const hl = await readKey("HL"); outNow("\n");
          await call("uman/hilo", { bet, hl });
          if (!(await yn("Play again", "Y"))) break;
        }
        continue;
      }
      if (k === "T") {
        const o = await call("uman/bear", { start: true });
        if (!o || !o.bearOffer) { await pause(); continue; }
        await out(GOLD + "Tame the BEAR\n" + T + "You must make the Bear to sit in |05" + o.bearOffer.rounds + T + " rounds.\n" + T + "You will have a whip and some fruits which you\n" + T + "can use to achieve your goal.\n" +
          T + "The Bear will respond in different ways to your actions.\n" + T + "Depending on its mood it might attack or obey you.\n" + T + "(the trick is to know when to use what)\n" +
          T + "If you succeed you will collect " + GOLD + n(o.bearOffer.price) + T + " gold coins.\n" + T + "The Entrance Fee is " + GOLD + n(o.bearOffer.fee) + T + " gold coins.\n");
        if (!(await yn("Go ahead", "N"))) continue;
        let r = await call("uman/bear", { start: true, confirm: true });
        while (r && r.bear) {
          await out(DIM + r.bear.rounds + " rounds left\n" + T + "{F}ruit\n" + T + "{W}hip\n" + T + ":");
          const m = await readKey("FW"); outNow("\n");
          r = await call("uman/bear", { move: m });
          if (r && r.dead) { await pause(); return "dead"; }
        }
        await pause(); menu = true; continue;
      }
      // Indian Wrestling
      const l = await call("uman/wrestlers");
      if (!l) continue;
      cls();
      await out("\n" + RED + "* Indian Wrestling *\n" + "|11 last games\n" + (l.log.length ? l.log.map(x => uc(x.body) + DIM + " [" + x.day + "]").join("\n") : DIM + " none yet") + "\n\n" +
        "|04Who would you like to meet? (" + WHITE + (P.wrestlings ?? 0) + "|04 matches left today)\n");
      const list = l.wrestlers.slice(0, 9);
      if (!list.length) { await out(T + "Nobody is around to wrestle.\n"); await pause(); menu = true; continue; }
      list.forEach((w, i) => outNow(T + "{" + (i + 1) + "} " + "|11" + pad(esc(w.name), 21) + WHITE + pad(w.how, 12) + (w.fought ? GOLD + "*You have fought " + esc(w.name) + "*" : "") + "\n"));
      await out(T + "{A}bort : ");
      const c = await readKey("123456789".slice(0, list.length) + "A");
      outNow("\n");
      if (c === "A") { menu = true; continue; }
      let r = await call("uman/wrestle", { id: list[+c - 1].id });
      while (r && r.wrestle) {
        const w = r.wrestle;
        await out("|04********************\n" + RED + "Your power : |04" + w.p1 + "/" + w.o1 + "\n" + PLY + esc(w.name) + "s" + RED + " power : |04" + w.p2 + "/" + w.o2 + "\n" +
          T + "{1} press firmly  {2} power move  {3} rest\n" + T + "Your move :");
        const m = await readKey("123"); outNow("\n");
        r = await call("uman/wrestle", { move: m });
      }
      await pause(); menu = true;
    }
  }

  // ============================================================ the Marketplace (MARKET.PAS)
  async function marketplace() {
    while (true) {
      act("Usurper: the marketplace");
      cls();
      await out("\n" + HEAD + "-**- The Old Marketplace -**-\n\n" + T + "The marketplace is filled with people and creatures.\n" + T + "Selling, buying, arguing or just looking. Everybody\n" + T + "is doing something. What shall you do?\n\n" +
        cols(["{B}eggars wall", "{T}rain with master", "{A}labats store", "{P}layers Market", "{S}tatus", "{R}eturn"], 24) + "\n" + T + "Market : ");
      const k = await readKey("BTAPSR");
      outNow("\n");
      if (k === "R") return;
      if (k === "S") { await status(); continue; }
      if (k === "A" || k === "P") { await out(WHITE + "This place is not available in Usurper Classic mode.\n"); await pause(); continue; }
      if (k === "T") { await trainer(); continue; }
      const r = await call("market/beggars");
      if (!r) continue;
      cls();
      await out("\n" + HEAD + "Beggars Wall\n" + HEAD + "____________\n" + T + "You approach the great wall where all the beggars\n" + T + "are gathered with their cups and loud shouting...\n" + T + "You look around to see who's here :\n");
      const list = r.beggars.filter(b => b.alive).slice(0, 9);
      if (!list.length) { await out(T + "They are all gone. Perhaps they ran away when\n" + T + "you arrived...\n"); await pause(); continue; }
      list.forEach((b, i) => outNow(T + "{" + (i + 1) + "} " + PLY + esc(b.name) + " : " + TALK + b.line + "\n"));
      await out(T + "{A}ttack!  {G}ive alms  {S}kip action : ");
      const a = await readKey("AGS"); outNow("\n");
      if (a === "S") continue;
      await out(T + (a === "A" ? "Who must die?" : "Who shall receive your gift?") + " : ");
      const w = await readKey("123456789".slice(0, list.length)); outNow("\n");
      const v = list[+w - 1];
      if (a === "G") {
        const x = await num("Amount to give (max " + n(P.gold) + ")", 0);
        if (x > 0 && await yn("Give " + GOLD + n(x) + T, "Y")) await call("market/alms", { id: v.id, gold: x });
      } else {
        await out(T + "{S}trangle  {B}ash head  {W}ring neck  {C}ut throat  S{t}ab :");
        const how = await readKey("SBWCT"); outNow("\n");
        await call("market/kill", { id: v.id, how });
      }
      await pause();
    }
  }
  async function trainer() {
    cls();
    await out("\n" + HEAD + "Small Hut\n" + T + "You enter the little hut where the master lives.\n" + T + "Two young men with shaved heads armed with sticks\n" + T + "watch you closely when you enter.\n" + T + "The Master has arrived.\n" +
      TALK + " Would you like to train close-combat moves or increase your\n" + TALK + " immunity to diseases ?\n" + T + "{F}ancy moves\n" + T + "{I}mmunity against diseases\n" + T + "{R}eturn\n" + T + "Train :");
    const k = await readKey("FIR"); outNow("\n");
    if (k === "R") { await out(WHITE + "Nothing!\n" + TALK + "I don't need your help old man!\n"); return; }
    if (k === "I") { await call("market/train", { what: "I" }); await pause(); return; }
    const r = await call("market/train");
    if (!r) return;
    cls();
    await out("\n" + TALK + "Which skill would you like to improve?" + T + " (" + WHITE + r.train.trains + T + " training sessions left)\n" +
      r.train.skills.map((x, i) => T + "{" + "TDUBLJKNCHPISR"[i] + "} " + pad(x.name, 15) + "|06- " + x.rank).join("\n") + "\n" + T + "{A}bort :");
    const c = await readKey("TDUBLJKNCHPISRA"); outNow("\n");
    if (c === "A") return;
    await out(T + "{F}ull training  {O}nly once :");
    const f = await readKey("FO"); outNow("\n");
    await call("market/train", { what: String("TDUBLJKNCHPISR".indexOf(c) + 1), full: f === "F" });
    await pause();
  }
  async function sendStuff() {
    const v = await pickPlayer("Who do you wanna send stuff to?", { filter: x => x.team && x.team === P.team });
    if (!v) { await pause(); return; }
    await out(T + "Send stuff to " + PLY + esc(v.name) + "\n" + T + "{M}oney  {H}ealing Potions  {D}one :");
    const k = await readKey("MHD"); outNow("\n");
    if (k === "D") return;
    const x = await num("How many? (you have " + n(k === "M" ? P.gold : P.healing) + ")", 0);
    if (x > 0 && await yn("Send " + n(x) + (k === "M" ? " gold" : " potions") + " to " + esc(v.name), "N")) await call("team/send", { id: v.id, what: k === "M" ? "gold" : "potions", n: x });
    await pause();
  }

  // ============================================================ the Shady Shops: Bobs Beer Hut (SHADY.PAS, BOBS.PAS, BRAWLC.PAS)
  async function xtraShops() {
    while (true) {
      cls();
      await out("\n" + T + "You enter the part of Town where the law seldom enters.\n\n" + HEAD + "-*- Shady Shops -*-\n" + T + "You stumble in to the dark areas of the town.\n" + T + "Trouble is never far away in these neighbourhoods.\n\n" +
        T + "{B}eer Hut\n" + T + "{R}eturn to street\n\n" + T + "Shady Shops : ");
      const k = await readKey("BR"); outNow("\n");
      if (k === "R") return;
      while (true) {
        cls();
        await out("\n" + HEAD + "Bobs Beer\n" + T + "The place is full of loud and drunk characters.\n" + PLY + "Ted the Bartender" + T + " is wiping the counter.\n\n" + T + "{B}rawl\n" + T + "{S}tatus\n" + T + "{R}eturn\n\n" + T + "Beer Hut : ");
        const b = await readKey("BSR"); outNow("\n");
        if (b === "R") break;
        if (b === "S") { await status(); continue; }
        if (!(await yn("Start a fight", "N"))) continue;
        await out(T + "Well then, choose your weapon :\n" + T + "{1} Chair\n" + T + "{2} Stool\n" + T + "{3} Bottle\n" + T + "{4} Fists\n" + T + ":");
        const weapon = +(await readKey("1234")); outNow("\n");
        await out(T + "How do you wanna start the brawl ?\n" + T + "{S}pill Beer  {C}rack a bottle  {P}ush  {T}rip  {I}nsult :");
        const how = await readKey("SCPTI"); outNow("\n");
        let r = await call("brawl/start", { weapon, how });
        while (r && r.brawl) {
          const br = r.brawl;
          if (br.phase === "object") {
            await out(T + "{G}rab it  {D}uck :");
            const g = await readKey("GD"); outNow("\n");
            r = await call("brawl/act", { key: g });
            continue;
          }
          await out(T + "You can see : " + (br.ted ? PLY + "{*} Ted  " : "") + br.foes.map(f => T + "{" + f.key + "} " + WHITE + f.n + " " + f.race).join("  ") + "\n" + T + "Choose opponent :");
          const tg = await readKey((br.ted ? "*" : "") + br.foes.map(f => f.key).join("")); outNow("\n");
          await out(T + "Action (" + GOLD + "A" + T + ".." + GOLD + "N" + T + " = Tackle, Drop-Kick, Uppercut, Bite, Leg-Sweep, JointBreak, Knifehand,\n" + T + " Nerve Punch, Chokehold, Headbash, Pull Hair, Kick, Straight Punch, Ram; " + GOLD + "0" + T + "=Flee" + (br.weapon ? ", " + GOLD + "T" + T + "=Throw object" : "") + "):");
          const mv = await readKey("ABCDEFGHIJKLMN0" + (br.weapon ? "T" : "")); outNow("\n");
          r = await call("brawl/act", { target: tg, move: mv });
        }
        await pause();
      }
    }
  }

  // ============================================================ the Gym (GYM.PAS)
  async function gym() {
    while (true) {
      act("Usurper: the gym");
      const r = await call("gym/info");
      if (!r) return;
      const g = r.gym;
      cls();
      if (!g.member) {
        await out("\n" + HEAD + "Outside the Gym\n" + (g.team ? T + "The Gym is in the hands of " + TC + esc(g.team) + T + ".\n" : WHITE + "The Gym is free to take over!\n") +
          T + "The Gym is for owners and members only.\n" + T + "Get your sorry butt out of here NOW! (unless you want it kicked)\n\n" + T + "{A}pply for membership\n" + T + "{T}ake over the Gym! (fistfight)\n" + T + "{R}eturn\n\n" + T + "Outside the Gym : ");
        const k = await readKey("ATR"); outNow("\n");
        if (k === "R") return;
        if (k === "A") { await call("gym/apply"); await pause(); continue; }
        if (g.team && !(await yn("Take on the " + TC + esc(g.team) + T + " crew", "N"))) { await out(RED + "CHICKEN!\n"); await pause(); continue; }
        await call("gym/takeover"); await pause(); continue;
      }
      await out("\n" + HEAD + "The Gym\n" + T + "The private Gym for tough people with an attitude.\n" + PLY + "Hazzan" + T + ", the masseur, is watching you.\n" +
        (g.owner ? GOLD + "The Gym is owned by your gang!\n" : T + "The Gym is in the hands of " + TC + esc(g.team) + T + ".\n") + "\n" +
        cols(["{L}ist members", "{W}ork out", "{B}arrel Masters", "{T}ug-of-war", "{M}assage", "{S}tatus", "{Q}uit as member", "{R}eturn"].concat(g.owner ? ["{A}bandon control", "{D}istribute card", "{E}xclude member"] : []), 22) +
        "\n" + T + "The Gym (" + WHITE + g.sessions + T + " sessions left) : ");
      const k = await readKey("LWBTMSQR" + (g.owner ? "ADE" : "")); outNow("\n");
      if (k === "R") return;
      if (k === "S") { await status(); continue; }
      if (k === "L") { cls(); await out("\n" + HEAD + "Gym members\n" + g.members.map(m => PLY + pad(esc(m.name), 21) + T + "level " + m.level + (m.owner ? GOLD + "  owner" : "")).join("\n") + "\n"); await pause(); continue; }
      if (k === "W") { await out(T + "{L}ift beer-barrels  {R}eturn :"); if ((await readKey("LR")) === "L") { outNow("\n"); await call("gym/barrels"); await pause(); } continue; }
      if (k === "B") {
        const b = await call("gym/barrels", { list: true });
        if (b) { cls(); await out("\n" + HEAD + "Barrel Hall of Fame\n" + (b.barrels.length ? b.barrels.map((x, i) => WHITE + lpad(i + 1, 3) + " " + PLY + pad(esc(x.name), 21) + GOLD + lpad(n(x.n), 8) + T + " barrels  " + x.race + " " + x.cls).join("\n") : T + "Nobody yet.") + "\n"); await pause(); }
        continue;
      }
      if (k === "M") {
        const o = await call("gym/massage");
        if (o && o.offer && await yn("Pay " + GOLD + n(o.offer.cost) + T + " for a Massage", "N")) await call("gym/massage", { confirm: true });
        await pause(); continue;
      }
      if (k === "T") {
        await out(T + "Which team will you challenge?\n" + T + ": " + WHITE);
        const t = (await readLine({ max: 30 })).trim();
        if (t) await call("gym/tug", { team: t });
        await pause(); continue;
      }
      if (k === "Q") { if (await yn("Really leave the Gym", "N")) { await call("gym/quit"); await pause(); return; } continue; }
      if (k === "A") { if (await yn("Abandon control of the Gym", "N")) await call("gym/abandon"); await pause(); continue; }
      const v = await pickPlayer(k === "D" ? "Give a club card to who?" : "Throw out who?");
      if (v) await call(k === "D" ? "gym/card" : "gym/exclude", { id: v.id });
      await pause();
    }
  }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
};
