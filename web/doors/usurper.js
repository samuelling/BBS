// USURPER — the terminal side of the door. Every rule and die roll lives on the board
// (worker/doors/usurper.js); this file draws the screens and asks the questions.
//
// USURPER (c) 1993-2009 Jakob Dangarden. Ported by Rick Parrish, bug fixes by Dan Zingaro.
// Converted for The Septic Tankz from the Usurper source (https://github.com/rickparrish/Usurper).
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
  const money = v => (v === 1 ? "gold coin" : "gold coins");
  let P = null;        // the character as the board last described it

  // Calls the game. Board refusals are printed and come back as null; a dropped carrier still hangs up.
  async function call(action, body) {
    try {
      const r = await api("door/usurper/" + action, body || {});
      if (r.p) P = r.p;
      if (r.out && r.out.length) await out(r.out.join("\n") + "\n|07");
      return r;
    } catch (e) {
      if (e instanceof BoardError) { await out("\n" + RED + esc(e.message) + "|07\n"); return null; }
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
    "|08  Converted for The Septic Tankz (core game: Main Street, dungeons, shops,\n" +
    "|08  inn, bank, Level Master, player fights, news).\n");
  await pause();

  let r = await call("enter");
  if (!r) return;
  if (!r.p && !(await createCharacter())) return;
  if (r.mail && r.mail.length) await showMail(r.mail);
  if (r.barred) {
    await out("\n" + RED + "Since your last visit ...\n\n" + T + "You may return tomorrow and regain some of your lost pride...\n");
    await pause();
    return;
  }
  if (r.p) {
    if (r.wasAt > 0) await out("\n" + T + "You wake up in your room at the Inn, well rested, and walk down to the street.\n");
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
          "{C}hallenges", "{N}ews", "{L}ist Characters", "{F}ame", "{Q}uit Game"]) +
        "\n" + (P.need === 0 ? HI + " (you are eligible for a level raise!)\n" : "") +
        T + " Main Street (" + GOLD + n(P.gold) + T + " gold, " + WHITE + P.hps + "/" + P.maxhps + T + " hps) : ");
      const k = await readKey("SDBIMVWA1CNLFQ");
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
      if (k === "C") { const x = await dormitory(); if (x === "slept" || x === "dead") return; }
      if (k === "N") await newsPaper();
      if (k === "L") await listCharacters(false);
      if (k === "F") await listCharacters(true);
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
        await out("\n" + header("The Dungeons of " + P.dungeon) + cols(["{L}ook for creatures", "{H}ealing", "{Q}uick heal", "{C}hange level", "{S}tatus", "{R}eturn to town"]));
        menu = false;
      }
      await out("\n" + T + "[" + "|11" + P.fights + T + " fights left]  " + (P.need === 0 ? HI + "(you are eligible for a level raise!)" : "") + "\n" +
        T + "Dungeon level " + MAG + P.dl + T + " (" + WHITE + P.hps + "/" + P.maxhps + T + " hps, " + WHITE + P.healing + T + " potions) " + DIM + "{?}" + T + " : ");
      const k = await readKey("LHQCSR?");
      outNow("\n");
      if (k === "?") { menu = true; continue; }
      if (k === "R") return;
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
      TALK + "What shall it be ? " + T + "Ravanella asks.\n\n" + cols(["{H}ealing potions", "{R}eturn"]));
    while (true) {
      await out("\n" + T + "Magic Shop (H,R) : ");
      const k = await readKey("HR");
      outNow("\n");
      if (k === "R") return;
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
        cols(["{G}et a Room", "{A}ttack Guest", "{S}tatus", "{R}eturn"]) + "\n" + T + "Inn (G,A,S,R) : ");
      const k = await readKey("GASR");
      outNow("\n");
      if (k === "R") return;
      if (k === "S") { await status(); continue; }
      if (k === "G") { if (await getRoom()) return "slept"; continue; }
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
        for (const s of r.sleepers.slice(0, 15)) await out(PLY + esc(s.name) + T + ", the " + s.race.toLowerCase() + " (" + "|03level " + s.level + " " + s.cls + T + ")\n");
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
      for (const x of r.rows.slice(0, 16)) await out(PLY + pad(esc(x.name), 21) + T + pad(x.race, 9) + pad(x.cls, 10) + WHITE + lpad(x.level, 6) + GOLD + lpad(n(x.exp), 13) + "  " + (x.alive ? HI + "alive" : RED + "dead") + "\n");
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
      T + "{D}ormitory   {I}nn room   {A}bort : ");
    const k = await readKey("DIA", { enter: "D" });
    outNow("\n");
    if (k === "A") return false;
    if (k === "I") return getRoom();
    await out(T + "You enter the Dormitory to get a good nights sleep.\n");
    const r = await call("sleep", { floor: 0 });
    if (r && r.slept) { await pause(); return true; }
    return false;
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
};
