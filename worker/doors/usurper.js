// USURPER for The Septic Tankz — the board-side game engine.
//
// USURPER (c) 1993-2009 Jakob Dangarden. Ported by Rick Parrish, bug fixes by Dan Zingaro.
// This file is a conversion of parts of the Usurper source (https://github.com/rickparrish/Usurper)
// to JavaScript for this board. Like the original it is free software: you can redistribute it
// and/or modify it under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option) any later version.
// It is distributed WITHOUT ANY WARRANTY; see the GNU General Public License for details.
//
// Ported here (game rules, numbers and most of the wording come from these Pascal units):
//   USERHUNC.PAS  character creation, start values by class and race, the Since-your-last-visit check
//   GAMEC.PAS     Main Street;  MAINT.PAS  the daily reset (fights, interest, resurrection)
//   DUNGEONC.PAS  the Dungeons: monster selection by level, the monk who sells potions, death
//   PLVSMON.PAS   player vs monsters (attack, retreat, heal, fight to death, beg, backstab,
//                 soul strike, gnoll bite, monster spells);  CAST.PAS / SPELLSU.PAS  spells
//   VARIOUS.PAS   normal_attack, normal_defence, dungeon_reward, healing, quick_healing
//   VARIOUS2.PAS  level_raise and raise_player (stat gains per class and Master);  LEVMAST.PAS
//   WEAPSHOP.PAS / ARMSHOP.PAS  classic-mode shops;  MAGIC.PAS  potions;  HEALERC.PAS  the Healer
//   BANK.PAS  deposits;  INNC.PAS  rooms and bribes;  DORM.PAS + VARIOUS3.PAS  the Dormitory and
//   Attack_Guest (pick-pocket, murder, wake and challenge);  PLVSPLC.PAS + PLVSPL2.PAS  player fights
//   Phase 2 (see docs/USURPER.md): TCORNER.PAS + GANGWARS.PAS + SORTTEAM.PAS  gangs, gang wars and
//   town control;  CHALLENG.PAS + CASTLE.PAS + CHALLKNG.PAS + KMAINT.PAS  the Castle, the throne,
//   royal guards, the moat, taxes and the treasury;  PRISONC.PAS + PRISONC1.PAS + PRISONF.PAS  the
//   prison;  BOUNTY.PAS + WANTEDSC.PAS + VARIOUS2.PAS  wanted posters and bounties;  GAMEC.PAS +
//   MAINT.PAS  the Beggars Wall;  RQUESTS.PAS + PLYQUEST.PAS + KMAINT.PAS  royal quests.
// Configuration follows Usurper's own defaults (SAMPLES/USURPER.CFG and the fallbacks in the code):
// CLASSIC game mode, 25 dungeon fights and 3 player fights a day, 10,000 gold to start.
//
// Every rule and every die roll happens here; the terminal only shows what this returns.

import { MONSTERS, WEAPONS, ARMORS, LEVELS } from "./usurper_data.js";

const CFG = {
  town: "Valhalla", dungeon: "Drunghin",
  tully: "Tully", reese: "Reese", ravanella: "Ravanella", lobba: "Lobba", garth: "Garth",
  startMoney: 10000, dngFights: 25, plFights: 3, maxHeals: 125, abase: 0.25,
  levelDiff: 5, interest: 3, difficulty: 2, pickpocket: 3, darkDeeds: 6,
  // phase 2 (USURPER.CFG lines 13, 89, 121-122, 131, 133, 138; VARIOUS.PAS fallbacks)
  teamFights: 2, maxTeam: 5, townReward: 5000, kingLevel: 25, prisonEscapes: 3, kingImprisonDays: 1,
  questsPerDay: 3, questsAtOnce: 3, maxPosters: 50, beggarCost: 500, beggarGift: 1000, kingGuards: 5,
};
// Where a character sleeps (usurper_players.location).
const LOC = { dorm: 0, castle: 5, prison: 6, beggar: 7 };
const BEAT_MS = 75_000;

// Colors: Usurper's palette from the sample config (green text, light green highlights).
const T = "|02", HI = "|10", TALK = "|03", PLY = "|11", MON = "|12", ITEM = "|13", GOLD = "|14", WHITE = "|15", HEAD = "|05", RED = "|12", MAG = "|13";

const CLASSES = ["Alchemist", "Assassin", "Barbarian", "Bard", "Cleric", "Jester", "Magician", "Paladin", "Ranger", "Sage", "Warrior"];
const C = Object.fromEntries(CLASSES.map((c, i) => [c, i]));
const RACES = ["Human", "Hobbit", "Elf", "Half-Elf", "Dwarf", "Troll", "Orc", "Gnome", "Gnoll", "Mutant"];
const R = Object.fromEntries(RACES.map((r, i) => [r.replace("-", ""), i]));
const SPELLCASTER = new Set([C.Cleric, C.Magician, C.Sage]);
// USERHUNC.PAS: start values by class [hps, str, def, sta, agi, cha, dex, wis, mana]
const CLASS_START = [
  [1, 2, 1, 1, 2, 4, 3, 5, 0], [3, 4, 3, 3, 4, 2, 5, 2, 0], [5, 5, 4, 5, 4, 1, 2, 1, 0], [3, 4, 3, 3, 3, 4, 4, 3, 0],
  [3, 3, 2, 2, 2, 4, 2, 4, 20], [2, 3, 2, 2, 5, 3, 5, 1, 0], [2, 1, 1, 1, 2, 5, 2, 4, 40], [4, 4, 3, 4, 2, 2, 3, 3, 0],
  [3, 3, 3, 4, 3, 2, 4, 3, 0], [1, 1, 2, 2, 2, 3, 3, 5, 40], [4, 4, 4, 4, 3, 2, 2, 2, 0],
];
// ... and the race bonus [hps, str, def, sta, age base, age spread]
const RACE_START = [
  [14, 4, 4, 4, 15, 5], [12, 2, 3, 3, 20, 15], [11, 3, 2, 3, 20, 15], [13, 2, 3, 4, 16, 10], [17, 5, 5, 4, 25, 15],
  [20, 7, 7, 5, 15, 15], [14, 3, 4, 3, 15, 10], [12, 2, 3, 3, 15, 15], [9, 2, 2, 2, 18, 10], [0, 0, 0, 0, 18, 15],
];
// VARIOUS2.PAS raise_player: per-level gains [hps, str, def, sta, agi, cha, dex, wis, mana]
const CLASS_GAIN = [
  [2, 2, 2, 1, 1, 3, 1, 5, 0], [3, 3, 4, 3, 4, 1, 3, 1, 0], [7, 5, 5, 5, 2, 1, 1, 1, 0], [5, 3, 3, 2, 3, 3, 3, 3, 0],
  [6, 3, 3, 3, 2, 5, 2, 3, 10], [4, 3, 5, 1, 5, 5, 1, 0, 0], [4, 1, 2, 1, 2, 2, 2, 5, 20], [6, 4, 4, 4, 2, 3, 1, 1, 0],
  [6, 3, 4, 4, 3, 3, 2, 5, 0], [4, 2, 2, 1, 2, 2, 2, 5, 25], [6, 4, 4, 4, 4, 1, 3, 1, 0],
];
const MASTERS = ["Akrappa", "Singuman", "Ishana", "Dzarrgo", "Agni", "Apollonia", "Sachmez", "Umilak", "Asanga", "Gregorius"];
const MASTER_TITLES = ["The Wise", "Bearer of Light and Fire", "The Last Northern Princess", "The Ancient Stone Lord", "The Shadow Dweller",
  "last Pupil of Sagan, the Sage", "The Great and Evil Witchmaster", "The Demon Tamer", "The Mysterious", "The Patriarch"];
// SPELLSU.PAS / CAST.PAS. Spell n needs level LEVEL_NEEDED[n-1] and costs 10*n mana.
const LEVEL_NEEDED = [1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80];
const SPELL_NAMES = {
  [C.Cleric]: ["Cure Light", "Armor", "Baptize Monster", "Cure Critical", "Disease", "Holy Explosion", "Invisibility", "Angel", "Call Lightning", "Heal", "Divination", "Gods Finger"],
  [C.Magician]: ["Magic Missile", "Shield", "Sleep", "Web", "Power Hat", "Fireball", "Fear", "Lightning Bolt", "Prismatic Cage", "Pillar of Fire", "Power word KILL", "Summon Demon"],
  [C.Sage]: ["Fog of War", "Poison", "Freeze", "Duplicate", "Roast", "Hit Self", "Escape", "Giant", "Steal", "Energy Drain", "Summon Demon", "Death Kiss"],
};
const SPELL_UTTER = {
  [C.Cleric]: ["Abrazak", "Razzxixx", "Ushmanikixz", "Garghamangan", "Meshushattagut", "Kazarbah", "Xamientivah", "Bokajinnah", "Tenibma", "Sondocesah", "Swiillixtavh", "Umbarakahstahx"],
  [C.Magician]: ["Zazzaknah", "Mokkoshu", "Sabdrak", "Sekaramata", "Viloshmazza", "Zimmokoth", "Urpashke", "Egribegah", "Ynoskattarb", "Aivannaxievh", "Gnisuremvenodh", "Mattravidduzzievh"],
  [C.Sage]: ["Umannaghra", "Gonngexha", "Artizafisch", "Ishusabbhes", "Sheshnaxe", "Xoxxammeuh", "Reprusu", "Setuminahx", "Algesmoxhu", "Noitarudamin", "Attigribinnizsch", "Edujnomed"],
};
// The spells whose effects are converted so far: { kind, lo, spread, multi }.
//   heal: hit points back; dmg: damage to a monster (or all of them when multi); ward: armor bonus for
//   the rest of the fight; hold: the target can't strike (Baptize / Sleep / Freeze).
const SPELLS = {
  [C.Cleric]: { 1: { kind: "heal", lo: 4, spread: 3 }, 2: { kind: "ward", lo: 5 }, 3: { kind: "hold", keep: true }, 4: { kind: "heal", lo: 20, spread: 5 },
    6: { kind: "dmg", lo: 20, spread: 11, multi: true }, 9: { kind: "dmg", lo: 80, spread: 10 }, 10: { kind: "heal", lo: 200, spread: 0 }, 12: { kind: "dmg", lo: 220, spread: 31 } },
  [C.Magician]: { 1: { kind: "dmg", lo: 4, spread: 3 }, 2: { kind: "ward", lo: 4 }, 3: { kind: "hold", keep: true }, 5: { kind: "heal", lo: 60, spread: 20 },
    6: { kind: "dmg", lo: 60, spread: 11 }, 8: { kind: "dmg", lo: 60, spread: 10 }, 10: { kind: "dmg", lo: 100, spread: 12 }, 11: { kind: "dmg", lo: 220, spread: 45 } },
  [C.Sage]: { 1: { kind: "ward", lo: 3 }, 3: { kind: "hold", keep: false }, 5: { kind: "dmg", lo: 50, spread: 15, multi: true }, 6: { kind: "dmg", lo: 70, spread: 11 },
    10: { kind: "dmg", lo: 130, spread: 11 }, 12: { kind: "dmg", lo: 240, spread: 50 } },
};
const MON_SPELLS = ["Cause Damage", "Snakes", "Cyclone", "Summon Undead", "Vice of Death", "Drain Life"];
const MON_SPELL_COST = [10, 20, 25, 30, 35, 40];
const MAX_MON = 17;
const DISEASES = [["blind", "Blindness"], ["plague", "Plague"], ["smallpox", "Smallpox"], ["measles", "Measles"], ["leprosy", "Leprosy"]];
const ROOMS = [0, 200, 900, 3200, 7500];          // INNC.PAS roomcost, by floor
const BRIBES = [0, 2500, 5000, 7500, 12500];      // ... and what it takes to get near the room
const FLOORS = ["the Dormitory", "a room downstairs", "a room on the first floor", "a room on the second floor", "a room on the third floor"];

// ---------------------------------------------------------------- small helpers
const random = n => (n > 0 ? Math.floor(Math.random() * n) : 0);     // Pascal random(n)
const pick = a => a[random(a.length)];
const cs = n => Math.round(n || 0).toLocaleString("en-US");          // commastr
const nm = s => String(s || "").replace(/[|{}\x00-\x1f]/g, "").slice(0, 20);
const him = p => (p.sex === 2 ? "her" : "him"), he = p => (p.sex === 2 ? "she" : "he"), his = p => (p.sex === 2 ? "her" : "his");
const He = p => (p.sex === 2 ? "She" : "He");
const raceLow = r => RACES[r].toLowerCase();
const money = n => (n === 1 ? "gold coin" : "gold coins");
function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function dayDiff(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
function xpNeed(p) {   // level_raise: experience still needed for the next level (0 = ready)
  if (p.level >= 100) return Infinity;
  return Math.max(0, LEVELS[p.level - 1] - p.exp);
}
function hitOutput(v) { return v <= 5 ? "Light" : v <= 20 ? "Medium" : v <= 100 ? "Hard" : v <= 200 ? "Heavy" : v <= 2000 ? "Extreme" : v <= 9999 ? "ULTRA" : "MAX"; }
function condition(now, max) {   // VARIOUS.PAS condition()
  const r = max ? now / max : 0;
  if (now <= 0) return "dead";
  return r >= 1 ? "unhurt" : r > 0.75 ? "lightly wounded" : r > 0.5 ? "wounded" : r > 0.25 ? "badly wounded" : "near death";
}

// ---------------------------------------------------------------- storage
async function loadRow(db, id) { return db.prepare("SELECT * FROM usurper_players WHERE user_id = ?").bind(id).first(); }
function parse(row) { if (!row) return null; const p = JSON.parse(row.data); p.id = row.user_id; return p; }
async function save(db, p, t) {
  const { id, ...data } = p;
  await db.prepare(
    "UPDATE usurper_players SET name = ?2, level = ?3, exp = ?4, location = ?5, hps = ?6, allowed = ?7, data = ?8, updated = ?9, team = ?10 WHERE user_id = ?1"
  ).bind(id, p.name, p.level, p.exp, p.location, p.hps, p.allowed ? 1 : 0, JSON.stringify(data), t, p.team || "").run();
}
async function news(db, t, head, ...lines) {
  await db.prepare("INSERT INTO usurper_news (day, at, head, body) VALUES (?, ?, ?, ?)").bind(today(), t, head, lines.filter(Boolean).join("\n")).run();
}
async function mail(db, t, toId, head, ...lines) {
  await db.prepare("INSERT INTO usurper_mail (to_id, at, head, body) VALUES (?, ?, ?, ?)").bind(toId, t, head, lines.filter(Boolean).join("\n")).run();
}
async function onlineIds(db) {
  const rows = (await db.prepare("SELECT user_id FROM line WHERE token IS NOT NULL AND user_id IS NOT NULL AND beat > ?").bind(Date.now() - BEAT_MS).all()).results;
  return new Set(rows.map(r => r.user_id));
}

// MAINT.PAS, run lazily: the first time a character is touched on a new day.
function maintain(p) {
  const d = today();
  if (p.day === d) return false;
  const days = p.day ? Math.max(1, Math.min(30, dayDiff(p.day, d))) : 1;
  p.day = d;
  if (p.hps < 1) p.hps = p.maxhps;           // resurrect the dead
  p.allowed = true;
  p.fights = CFG.dngFights;
  p.pfights = CFG.plFights;
  p.darknr = CFG.darkDeeds;
  p.chivnr = CFG.darkDeeds;
  p.pick = CFG.pickpocket;
  p.tfights = CFG.teamFights;
  p.escapes = CFG.prisonEscapes;
  p.questsToday = 0;
  p.mana = p.maxmana;
  p.newDays = days;            // the async half of the day's maintenance (dailyRealm) reads this
  for (let i = 0; i < days; i++) {           // bank interest, once per day that passed
    if (p.bank > 100 && p.bank < 1.5e9) { const x = Math.round(p.bank * (1 + CFG.interest / 100)) - p.bank; p.bank += x; p.interest = (p.interest || 0) + x; }
  }
  p.ageplus = (p.ageplus || 0) + days;
  if (p.ageplus > 20 && random(4) === 0) { p.age++; p.ageplus = 0; }
  return true;
}

function view(p) {
  const need = xpNeed(p);
  const known = SPELLCASTER.has(p.cls) ? LEVEL_NEEDED.map((lv, i) => i + 1).filter(n => p.level >= LEVEL_NEEDED[n - 1]) : [];
  return {
    name: p.name, sex: p.sex, race: RACES[p.race], cls: CLASSES[p.cls], level: p.level, exp: p.exp, need: need === Infinity ? null : need,
    hps: p.hps, maxhps: p.maxhps, str: p.str, def: p.def, sta: p.sta, agi: p.agi, cha: p.cha, dex: p.dex, wis: p.wis,
    mana: p.mana, maxmana: p.maxmana, gold: p.gold, bank: p.bank, healing: p.healing, maxheals: CFG.maxHeals,
    weapon: WEAPONS[p.weapon - 1] ? WEAPONS[p.weapon - 1][0] : "", wpow: p.wpow, armor: ARMORS[p.armor - 1] ? ARMORS[p.armor - 1][0] : "", apow: p.apow,
    fights: p.fights, pfights: p.pfights, darknr: p.darknr, pick: p.pick, mkills: p.mkills, mdefeats: p.mdefeats, pkills: p.pkills, pdefeats: p.pdefeats,
    age: p.age, master: MASTERS[(+p.master || 10) - 1], masterNo: p.master, dl: p.dl || p.level, location: p.location, chiv: p.chiv, dark: p.dark,
    spells: known.map(n => ({ n, name: SPELL_NAMES[p.cls][n - 1], cost: n * 10, ok: !!(SPELLS[p.cls] || {})[n] })),
    diseases: DISEASES.filter(([k]) => p[k]).map(([, v]) => v),
    caster: SPELLCASTER.has(p.cls), canBackstab: p.cls === C.Assassin, canSoul: p.cls === C.Paladin, interest: p.interest || 0,
    town: CFG.town, dungeon: CFG.dungeon,
    team: p.team || "", tfights: p.tfights ?? CFG.teamFights, king: !!p.king, prisonDays: p.prisonDays || 0, escapes: p.escapes ?? CFG.prisonEscapes,
    royquests: p.royquests || 0, siege: p.siege ? p.siege.stage : null,
  };
}

// ---------------------------------------------------------------- combat pieces (VARIOUS.PAS)
function normalAttack(a) {      // classic mode
  let t = (a.wpow || 0) + random(a.str);
  if (t < 0) t = 0;
  if (a.str > 4) t += Math.floor(a.str / 5);
  return Math.max(0, t);
}
function normalDefence(d) {     // armor absorbs abase * apow; spell wards add to it
  let yy = d.apow > 1 ? Math.round(CFG.abase * d.apow) : 0;
  yy += d.ward || 0;
  if (SPELLCASTER.has(d.cls) && d.mana < d.maxmana) d.mana++;     // casters regain a little mana each blow
  return Math.max(0, yy);
}
function dungeonReward(dl) { return dl * (random(50) + 75) + random(75) * 3; }
function quickHeal(pl, out, self = true) {   // quick_healing / computer_healing: 5 hps per potion
  if (pl.hps >= pl.maxhps) { if (self) out.push(GOLD + "You don't need healing."); return 0; }
  if (pl.healing < 1) { if (self) out.push(RED + "You need healing, but dont have any potions!"); return 0; }
  const x = pl.maxhps - pl.hps;
  let zz = Math.floor(x / 5);
  if (zz * 5 + pl.hps < pl.maxhps) zz++;
  if (zz === 0) zz = 1;
  if (self) out.push(T + "You need " + GOLD + cs(zz) + T + " " + (zz > 1 ? "potions" : "potion") + ".");
  if (zz > pl.healing) zz = pl.healing;
  pl.healing -= zz;
  const before = pl.hps;
  pl.hps = Math.min(pl.maxhps, pl.hps + zz * 5);
  if (self) {
    out.push(T + "You quaffed " + WHITE + cs(zz) + T + " potion" + (zz > 1 ? "s" : "") + " and regained " + WHITE + cs(pl.hps - before) + T + " hitpoints.");
    out.push(T + "You have " + WHITE + cs(pl.healing) + T + " potions left.");
  } else out.push(PLY + pl.name + T + " quaffed " + cs(zz) + " potion" + (zz > 1 ? "s" : "") + "!");
  return zz;
}
function healN(pl, n, out) {    // Healing: quaff a chosen number
  n = Math.max(0, Math.min(Math.trunc(+n || 0), pl.healing));
  if (pl.hps >= pl.maxhps) { out.push(T + "You don't need healing."); return; }
  if (!n) return;
  let x = n * 5;
  if (x + pl.hps > pl.maxhps) {
    x = pl.maxhps - pl.hps;
    let zz = Math.floor(x / 5); if (zz * 5 + pl.hps < pl.maxhps) zz++; if (!zz) zz = 1;
    out.push(RED + "You only need " + WHITE + cs(zz) + RED + " potions.");
    n = zz;
  }
  pl.healing -= n; pl.hps = Math.min(pl.maxhps, pl.hps + x);
  out.push(T + "You quaffed " + WHITE + cs(n) + T + " potions");
  out.push(T + "You regained " + WHITE + cs(x) + T + " hitpoints  (" + cs(pl.hps) + "/" + cs(pl.maxhps) + ")");
  out.push(T + "You have " + WHITE + cs(pl.healing) + T + " potions left");
}

// ---------------------------------------------------------------- the character
function newPlayer(user, sex, race, cls) {
  const cs0 = CLASS_START[cls], rs = RACE_START[race];
  const p = {
    name: nm(user.handle), sex, race, cls, level: 1, exp: 10, gold: CFG.startMoney, bank: 0, healing: 125,
    fights: CFG.dngFights, pfights: CFG.plFights, darknr: 3, chivnr: 3, chiv: 0, dark: 0, master: "1", allowed: true,
    location: 0, mkills: 0, mdefeats: 0, pkills: 0, pdefeats: 0, weapon: 0, wpow: 0, armor: 0, apow: 0, pick: CFG.pickpocket,
    hps: cs0[0], str: cs0[1], def: cs0[2], sta: cs0[3], agi: cs0[4], cha: cs0[5], dex: cs0[6], wis: cs0[7], mana: cs0[8], maxmana: cs0[8],
    age: rs[4] + random(rs[5]), ageplus: 0, day: today(), interest: 0, dl: 1, fight: null, monk: false,
  };
  if (race === R.Mutant) {
    p.hps += random(10) + 10; p.str += random(8) + 1; p.def += random(8) + 1; p.sta += random(5) + 1;
  } else { p.hps += rs[0]; p.str += rs[1]; p.def += rs[2]; p.sta += rs[3]; }
  p.maxhps = p.hps;
  return p;
}

// raise_player: one or more levels at once, gains by class, adjusted by the chosen Master.
function raise(p, out) {
  if (xpNeed(p) !== 0) return 0;
  let right = 1, lev = p.level + 1;
  while (lev <= 99 && LEVELS[lev - 1] <= p.exp) { right++; lev++; }
  let [i, j, x, rnd, z, q, zz, yy, cp] = CLASS_GAIN[p.cls].map(v => v * right);
  for (let n = 0; n < right; n++) {
    switch (p.master) {
      case "2": i++; j++; x++; q = 0; if (cp > 0) cp -= 5; break;
      case "3": i -= 2; j--; x--; rnd += 2; z++; q++; yy += 2; if (cp > 0) cp += 5; break;
      case "4": i += 2; j++; x -= 2; rnd++; zz++; z--; yy = 0; if (cp > 0) cp += 8; break;
      case "5": i--; j--; x -= 2; rnd += 3; z += 2; yy += 3; break;
      case "6": i += 2; j++; x += 2; rnd = 1; z = 1; yy = 1; if (cp > 0) cp += 7; break;
      case "7": i = 1; j = 1; x = 1; q = 0; z += 3; yy += 3; zz += 3; if (cp > 0) cp += 12; break;
      case "8": i = 1; j += 2; x++; z = 1; yy++; zz = 0; q = 0; if (cp > 0) cp += 14; break;
      case "9": i--; j--; q++; if (cp > 0) cp += 11; break;
      case "0": i += 2; x += 2; z += 2; yy = 0; q += 3; break;
    }
  }
  p.level += right;
  out.push(TALK + "You are now a level " + WHITE + p.level + " " + TALK + CLASSES[p.cls] + "!");
  out.push(T + "You raised " + WHITE + right + T + " level" + (right > 1 ? "s" : "") + ".", "", HI + "Congratulations!");
  const gain = (k, v, label) => { if (v > 0 && p[k] <= 5000) { p[k] += v; out.push(T + "Your " + label + " increased by " + cs(v) + "!"); } };
  if (i > 0 && p.maxhps <= 5000) { p.maxhps += i; p.hps = p.maxhps; out.push(T + "Your hps increased by " + cs(i) + "!"); }
  gain("str", j, "strength"); gain("def", x, "defence"); gain("sta", rnd, "stamina"); gain("agi", z, "agility");
  gain("cha", q, "charisma"); gain("dex", zz, "dexterity"); gain("wis", yy, "wisdom");
  if (cp > 0 && p.maxmana <= 5000) { p.maxmana += cp; p.mana = p.maxmana; out.push(T + "Your mana increased by " + cs(cp) + " !"); }
  let memex = 0;
  for (let n = 0; n < right; n++) { let g = p.level * 5000 + random(10000); if (p.race === R.Gnoll) g += random(22000); memex += g; }
  p.gold += memex;
  out.push(T + "You also receive " + GOLD + cs(memex) + T + " " + money(memex) + ".");
  if (SPELLCASTER.has(p.cls)) {
    LEVEL_NEEDED.forEach((lv, k) => { if (p.level >= lv && p.level - right < lv) out.push(GOLD + "You have learned a new spell - " + "|11" + SPELL_NAMES[p.cls][k]); });
  }
  return right;
}

// ---------------------------------------------------------------- dungeon fights (PLVSMON.PAS)
function makeMonster(idx) {
  const m = MONSTERS[Math.max(0, Math.min(MONSTERS.length - 2, idx))];
  return { name: m[0], str: m[1], hps: m[1] * 3, max: m[1] * 3, def: 0, ml: m[2], mana: m[2] * 60, spells: m[3], ph: m[4], res: random(50), poisoned: false, hold: 0 };
}
function aliveMons(f) { return f.mons.filter(m => m.hps > 0); }
function monsterList(f) {
  const counts = new Map();
  for (const m of aliveMons(f)) counts.set(m.name, (counts.get(m.name) || 0) + 1);
  return [...counts].map(([n, c]) => (c > 1 ? cs(c) + " " + n + "s" : n)).join(", ");
}
function fightView(p) {
  const f = p.fight;
  if (!f) return null;
  if (f.mode === "dng") return { mode: "dng", dl: f.dl, list: monsterList(f), mons: f.mons.map((m, i) => ({ i, name: m.name, hps: m.hps, alive: m.hps > 0 })), toDeath: !!f.toDeath };
  if (f.mode === "pvp") return { mode: "pvp", foe: f.foe.name, foeHps: f.foe.hps, foeMax: f.foe.maxhps, toDeath: !!f.toDeath };
  return { mode: f.mode, foe: f.foe && f.foe.name, gold: f.gold };
}

function startDungeonFight(p, out) {
  const dl = Math.min(100, Math.max(1, p.dl || p.level));
  p.fights--;
  const mons = [makeMonster((dl - 1) * 10 + random(10))];
  let yy = CFG.difficulty === 1 ? 1 : random(CFG.difficulty) + 1;
  if (yy > MAX_MON) yy = MAX_MON;
  for (let i = 2; i <= yy; i++) {
    const xx = Math.max(1, (dl - 4) * 10), x = dl * 10;
    mons.push(makeMonster(xx + random(x - xx)));
  }
  p.fight = { mode: "dng", dl, mons, toDeath: false };
  p.monk = false;
  p.ward = 0;
  const m = mons[0];
  if (m.ph) out.push("", MON + m.name + T + ": " + TALK + m.ph);
}

function playerDiesInDungeon(p, killer, out, ctx, how) {
  if (p.fight && p.fight.purpose) how = "special";   // moat, prison gate, quest: purposeDone writes the news
  p.hps = 0;
  p.allowed = false;      // no resurrections left today (Usurper's default)
  p.mdefeats++;
  p.fight = null;
  p.ward = 0;
  out.push("", "|04You are DEAD!", T + "You lose all the gold you were carrying.", "", T + "Darkness...");
  p.gold = 0;
  ctx.later.push(() => mail(ctx.db, ctx.t, p.id, "Your Death", "You were slaughtered by a " + killer + "."));
  if (how === "special") {
    // nothing here
  } else if (how === "coward") {
    ctx.later.push(() => news(ctx.db, ctx.t, "Coward!", PLY + p.name + T + pick([" was killed by a ", " was slain by a ", " was slaughtered by a ", " was defeated by a "]) + "monster, when trying to escape battle!"));
  } else if (how === "beg") {
    const s = pick([" begged for " + his(p) + " miserable life, but ", " tried to convince a grim monster not to kill " + him(p) + ", but ",
      " cried and begged for " + his(p) + " life, but ", " wept and begged for mercy, but ", " gave up before " + his(p) + " superior foe, but ",
      " met superior forces, begged for " + his(p) + " life, but ", " chickened out in a fight! Begged, but "]);
    const s2 = pick([" was brutally mutilated by a monster!", " was slain by a monster foe!", " was slaughtered by a monster!", " was killed without any mercy!",
      " received what " + he(p) + " deserved. Death...", " was eliminated by a nice monster!", " was killed...", " the monster didn't show any mercy...",
      " was killed instantly!", " was mutilated and tortured!"]);
    ctx.later.push(() => news(ctx.db, ctx.t, "Chicken in the Dungeons!", PLY + p.name + T + s + p.name + s2));
  } else {
    const s = pick([" was killed by a ", " was slain by a ", " was slaughtered by a ", " was defeated by a "]) + MON + killer + T + " in the dungeons.";
    ctx.later.push(() => news(ctx.db, ctx.t, pick(["Dungeon", "Tragic", "Deceased", "Slain", "Killed", "Death"]), PLY + p.name + T + s));
  }
}

function monsterDied(p, f, m, out) {
  if (random(5) === 0) { out.push(T + "The " + m.name + " looks surprised when your final blow", T + "causes its instant death!"); }
  out.push(GOLD + "You have killed the " + m.name + "!");
  p.mkills++;
  const xp = dungeonReward(f.dl);
  p.exp += xp;
  out.push(T + "You receive " + GOLD + cs(xp) + T + " experience points!");
  const g = random(300) * f.dl + random(500);
  p.gold += g;
  out.push(T + "You search the corpse and find " + GOLD + cs(g) + T + " " + money(g) + "!");
}

// One monster casts (Monster_Magic_Attack). Returns true if it cast instead of striking.
function monsterCasts(p, f, m, out) {
  const can = [];
  for (let s = 0; s < 6; s++) if ((m.spells >> s) & 1 && m.mana >= MON_SPELL_COST[s]) can.push(s);
  if (!can.length || random(2) !== 0) return false;
  const s = pick(can);
  m.mana -= MON_SPELL_COST[s];
  out.push(MON + m.name + WHITE + " casts a SPELL on You!" + T + " (" + MON_SPELLS[s] + ")");
  if (random(2) === 0) { out.push(HEAD + "But it failed."); return true; }
  let dmg = 0;
  if (s === 0) dmg = m.ml * 3;
  else if (s === 1) { out.push(RED + "Silver Snakes appear in a puff of smoke!"); dmg = m.ml * 2; }
  else if (s === 2) { out.push(RED + "They have summoned a CYCLONE!"); dmg = m.ml * 2; }
  else if (s === 3) {
    const [nmz] = random(2) ? ["Corpse"] : ["Zombie"];
    out.push(RED + "From the ground, a " + nmz + " suddenly rises!");
    if (f.mons.length < MAX_MON) f.mons.push({ name: nmz, str: 15, hps: 50, max: 50, def: 15, ml: 1, mana: 0, spells: 0, ph: "Kill.Kill.", res: 0, poisoned: false, hold: 0, wpow: 7 });
    return true;
  } else if (s === 4) { out.push(RED + p.name + " has been seized by cramps!", RED + p.name + " is incapacitated!"); dmg = m.ml * 2; }
  else { out.push(RED + "A bright spark of red energy hits " + p.name + "!"); dmg = m.ml; }
  out.push("|11You are " + (s === 5 ? "zapped" : s === 1 ? "bitten" : s === 2 ? "swept away and hurt" : "hurt") + " for " + cs(dmg) + " damage!");
  p.hps -= dmg;
  return true;
}

// A full round: the player's blow (if any), poison ticks, then every monster strikes back.
function dungeonRound(p, f, opts, out, ctx) {
  const alive = aliveMons(f);
  let mon = f.mons[opts.target] && f.mons[opts.target].hps > 0 ? f.mons[opts.target] : alive[0];
  // monster_charge (mode 1)
  for (const m of f.mons) {
    if (m.str < 10) m.str = 10;
    const w = m.wpow || 0;
    m.punch = w + random(w) + Math.floor(m.str / 3);
    if (random(3) === 0) m.punch += random(5) + 1;
  }
  if (!opts.casted && !opts.healedOnly) {
    let punch = normalAttack(p);
    if (opts.soul > 0) { const zz = random(opts.soul) + p.level; punch += zz; out.push(T + "Soulstrike hits " + mon.name + " for " + cs(zz) + " points!"); }
    if (p.race === R.Gnoll && !mon.poisoned && random(4) + 1 === 3) { out.push(T + "**Poisonous Gnollbite!**"); mon.poisoned = true; }
    if (p.hps > p.maxhps) p.hps = p.maxhps;
    if (opts.stab > 0) punch += opts.stab;
    if (opts.stab === -1) { mon.punch += p.level + 3; punch = 0; }
    if (opts.stab !== -1 && punch === 0) out.push(T + "You missed your blow!");
    if (punch > 0) {
      out.push(RED + "You hit the " + mon.name + " for " + cs(punch) + " damage!");
      let x = mon.def + random(Math.floor(mon.def / 8));
      if (x > 0) { if (x > punch) x = punch; punch -= x; out.push("|03" + mon.name + "s armor absorbed " + cs(x) + " points!"); }
      mon.hps -= punch;
      if (mon.hps < 1) monsterDied(p, f, mon, out);
    }
  }
  for (const m of aliveMons(f)) {
    if (m.poisoned) { const x = random(5) + 1; out.push(MON + m.name + T + " suffers from poison!"); m.hps -= x; if (m.hps < 1) monsterDied(p, f, m, out); }
  }
  // monster attacks
  for (const m of f.mons) {
    if (m.hps < 1 || p.hps < 1) continue;
    if (m.hold > 0) { out.push(MON + m.name + T + " can't move!"); if (!m.holdKeep || random(2) === 0) m.hold = 0; continue; }
    if (monsterCasts(p, f, m, out)) { if (p.hps < 1) { playerDiesInDungeon(p, m.name, out, ctx); return; } continue; }
    if (m.punch < 1) { out.push(MON + m.name + MAG + " missed you completely!"); continue; }
    out.push(MON + m.name + RED + " hits You for " + hitOutput(m.punch) + " damage!");
    let absorb = Math.min(normalDefence(p), m.punch);
    if (absorb > 0) { out.push("|03  (armor absorbed " + Math.round(absorb * 100 / m.punch) + "%)"); m.punch -= absorb; }
    if (m.punch > 0) p.hps -= m.punch;
    if (p.hps < 1) { playerDiesInDungeon(p, m.name, out, ctx); return; }
  }
  if (!aliveMons(f).length) endDungeonFight(p, out);
}

function endDungeonFight(p, out) {
  p.fight = null;
  p.ward = 0;
  out.push("", HI + "You have cleared the area.");
  if (p.healing < CFG.maxHeals && p.hps > 0) {
    p.monk = true;     // DUNGEONC.PAS: a monk offers potions after the fight
  }
}

// ---------------------------------------------------------------- player fights (PLVSPLC.PAS / PLVSPL2.PAS)
function snapshot(v) {
  return { id: v.id, name: v.name, sex: v.sex, race: v.race, cls: v.cls, level: v.level, hps: v.maxhps, maxhps: v.maxhps, str: v.str,
    wpow: v.wpow, apow: v.apow, healing: v.healing, mana: v.mana, maxmana: v.maxmana, gnollp: 0, weapon: v.weapon };
}
function startPvp(p, v, kind, out) {
  p.pfights--;
  p.ward = 0;
  p.fight = { mode: "pvp", kind, foe: snapshot(v), toDeath: false, gnollp: 0, loc: v.location };
  out.push("", HEAD + "Player Fight!!", "");
  out.push(PLY + v.name + T + (v.weapon > 0 ? " looks grim as " + he(v) + " swings " + his(v) + " weapon!" : " looks a little worried as " + he(v) + " swings " + his(v) + " fists!"));
  const s = pick(["Hey you! come and meet your destiny!", "You fight me? Hahaha!", "Come on!", "I'm gonna hack you to pieces!", "Come on " + raceLow(p.race) + "! I'm waiting!",
    "Come over here and I'll teach you a lesson!", "Bah! Another piece of garbage that needs taking care of!", "Oh my! Why don't you run back to mama!", "Prepare to die, you worthless worm!", "Scared?"]);
  out.push(TALK + s + T + ", " + PLY + v.name + T + " screams!");
}

function pvpRound(p, f, opts, out) {
  const foe = f.foe;
  if (foe.hps > foe.maxhps) foe.hps = foe.maxhps;
  if (p.hps > p.maxhps) p.hps = p.maxhps;
  // does the computer-controlled player quaff potions?
  if (foe.hps + 5 <= foe.maxhps && foe.healing > 0) quickHeal(foe, out, false);
  if (p.race === R.Gnoll && !foe.gnollp && random(4) + 1 === 3) { out.push("|04**Poisonous Gnollbite!**", "|04You managed to poison " + him(foe) + "!"); foe.gnollp = 1; }
  if (foe.race === R.Gnoll && !f.gnollp && random(4) + 1 === 3) { out.push("|04**Poisonous Gnollbite!**", "|04The swine managed to poison you!"); f.gnollp = 1; }
  if (f.gnollp) { const x = random(foe.level) + 1; out.push("|04You suffered " + WHITE + cs(x) + "|04 points from poison!"); p.hps -= x; }
  if (foe.gnollp) { const x = random(p.level) + 1; out.push(PLY + foe.name + RED + " suffers " + WHITE + cs(x) + RED + " points from poison!"); foe.hps -= x; }
  let pp = opts.healedOnly ? 0 : normalAttack(p), fp = normalAttack(foe), stab2 = 0;
  if (opts.soul > 0) { pp = random(opts.soul) + p.level; out.push(T + "Soulstrike hits " + PLY + foe.name + T + " for " + WHITE + cs(pp) + T + " points!"); }
  if (foe.cls === C.Assassin && random(3) === 0 && foe.weapon > 0) {
    out.push(PLY + foe.name + T + " tries to Backstab you!");
    if (random(3) === 0) { out.push(T + "You scream out in pain as " + PLY + foe.name + T + " cuts you !"); stab2 = Math.floor(foe.maxhps / 2); }
    else { stab2 = -1; out.push(T + "But misses!"); }
  }
  if (foe.cls === C.Paladin && foe.hps > 100 && random(3) === 0) {
    const zz = Math.floor(foe.hps / 3); foe.hps -= zz; fp = random(zz) + foe.level;
    out.push(T + "Soulstrike from " + PLY + foe.name + T + " hits you for " + WHITE + cs(zz) + T + " points!");
  }
  const stab1 = opts.stab || 0;
  if (!opts.healedOnly) {
    if (pp === 0 && stab1 !== -1) out.push(T + "You miss your blow against " + PLY + foe.name + "!");
    if (pp > 0 && stab1 !== -1) {
      out.push(T + "You hit " + PLY + foe.name + T + " for " + WHITE + cs(pp) + T + " points!");
      const ab = Math.min(normalDefence(foe), pp);
      if (ab > 0) { out.push(PLY + foe.name + "s" + T + " armor absorbed " + WHITE + cs(ab) + T + " points!"); pp -= ab; }
    }
  }
  if (fp === 0 && stab2 !== -1) out.push(PLY + foe.name + T + " missed you completely!");
  if (fp > 0 && stab2 !== -1) {
    out.push(PLY + foe.name + T + " hits you for " + WHITE + cs(fp) + T + " points!");
    const ab = Math.min(normalDefence(p), fp);
    if (ab > 0) { out.push(T + "Your armor absorbed " + WHITE + cs(ab) + T + " points!"); fp -= ab; }
  }
  if (stab1 > 0) pp += stab1;
  if (stab2 > 0) fp += stab2;
  if (stab1 === -1) { pp = 0; fp += p.level; }
  if (stab2 === -1) { fp = 0; pp += foe.level; }
  if (pp < 2 && fp < 2) { pp += random(5) + 2; fp += random(5) + 2; }   // no eternal fights
  p.hps -= Math.max(0, fp);
  foe.hps -= Math.max(0, pp);
  // should the computer player beg for mercy?
  if (foe.hps < 4 && foe.hps > 0 && p.hps > 0 && foe.healing < 1 && random(5) === 1) {
    out.push("", T + "Enemy Surrender!", T + "*****************", PLY + foe.name + T + " throws " + him(foe) + "self before your feet and begs for mercy!",
      T + "The crowd around you scream for blood, except " + PLY + foe.name + "s" + T + " friends!",
      T + "They hand you a big axe...and then there is silence when everybody", T + "awaits your decision.");
    f.mode = "beg";
  }
}

// The fight is over; write the results into both characters (the victim is reloaded fresh).
async function pvpVictory(p, f, ctx, out, spared) {
  const foe = f.foe, v = parse(await loadRow(ctx.db, foe.id));
  const x = (random(50) + 250) * foe.level;
  if (spared) {
    const xs = 100 * foe.level + random(250);
    out.push("", T + "To the crowds disappointment you let " + PLY + foe.name + T + " go.", T + "That was an act of chivalry!",
      T + "You receive " + WHITE + cs(xs) + T + " experience points for this fight!", T + "Your soul lightens!");
    p.exp += xs; p.chiv += random(25) + 15;
    if (v) { v.hps = 0; await save(ctx.db, v, ctx.t); }
    ctx.later.push(() => mail(ctx.db, ctx.t, foe.id, "Enemy Spared You!", "You begged for mercy when " + p.name + " attacked you.", p.name + " spared your miserable life.", "(you are a such a coward!)"));
    ctx.later.push(() => news(ctx.db, ctx.t, "Player Fight!", PLY + p.name + T + " challenged " + PLY + foe.name + T + " and won! " + PLY + foe.name + T + " begged for mercy!",
      " and " + PLY + p.name + T + " spared " + his(foe) + " life! What an act of chivalry!"));
    p.fight = null;
    return;
  }
  out.push("", T + "Victory!", T + "You have slain your foe!", T + "You receive " + WHITE + cs(x) + T + " experience points!");
  p.exp += x; p.pkills++;
  if (f.mode === "beg") { p.dark += 25; p.darknr = Math.max(0, p.darknr - 1); }
  const gold = v ? v.gold : 0;
  if (v) { v.hps = 0; v.pdefeats++; await save(ctx.db, v, ctx.t); }
  await collectBounty(ctx, p, foe, out);
  const line = pick([" screamed when cold steel took " + his(foe) + " life!", " screamed in horror when " + he(foe) + " met death!", " looked surprised when " + he(foe) + " was cut to pieces!",
    " screamed as " + he(foe) + " received the deathblow!", " gave a short scream when " + his(foe) + " skull was cut in two!", " died like a wimp!", "s skull was cut in two by a battleaxe!"]);
  ctx.later.push(() => news(ctx.db, ctx.t, "Player Fight!", PLY + p.name + T + " challenged " + PLY + foe.name + T + " and won!", RED + foe.name + T + line));
  // Usurper asks whether to take the purse; the answer comes back as "pvp/loot".
  p.fight = { mode: "loot", foe: { id: foe.id, name: foe.name, sex: foe.sex }, gold };
  if (gold > 0) out.push("", PLY + foe.name + "s" + T + " purse has " + GOLD + cs(gold) + T + " " + money(gold) + " in it!");
}
async function pvpDefeat(p, f, ctx, out) {
  const foe = f.foe, v = parse(await loadRow(ctx.db, foe.id));
  out.push("", T + "With your last strength you try a blow aginst your foe,", T + "but in vain! You have lost the fight!",
    T + "Just before you die, you hear " + PLY + foe.name + T + " laughing at your", T + "pathetic attempt!");
  const lost = p.gold;
  if (lost > 0) out.push(PLY + foe.name + T + " took your gold!");
  if (v) {
    v.exp += (random(50) + 250) * p.level; v.gold += lost; v.pkills++;
    await collectBounty(ctx, v, p, null);
    await save(ctx.db, v, ctx.t);
    ctx.later.push(() => mail(ctx.db, ctx.t, v.id, "Victory!", p.name + " attacked you while you were sleeping, but you won the fight!",
      lost > 0 ? "You took " + cs(lost) + " " + money(lost) + " from the corpse." : ""));
  }
  p.gold = 0; p.hps = 0; p.allowed = false; p.pdefeats++; p.fight = null;
  ctx.later.push(() => mail(ctx.db, ctx.t, p.id, "Your Death", "You were slain by " + foe.name + "!", lost > 0 ? foe.name + " emptied your purse. You lost " + cs(lost) + " " + money(lost) + "!" : ""));
  const fn = PLY + foe.name + T;
  const s = pick([[" challenged " + fn + "!", " " + p.name + " lost both the fight and " + his(p) + " head!"], [" challenged " + fn + " but was massacred!"],
    [" assaulted " + fn + " but died in the attempt!"], [" attacked " + fn + "! It was a mistake..."], [" attacked " + fn + " but was terminated."],
    [" assaulted " + fn + " but was defeated!"], [" jumped " + fn + " but was mangled!"]]);
  ctx.later.push(() => news(ctx.db, ctx.t, "Player Fight!", PLY + p.name + T + s[0], s[1] ? RED + s[1] : ""));
  out.push("", T + "Darkness...");
}

// ---------------------------------------------------------------- the door's commands
export async function handle(action, body, ctx) {
  const { db, user } = ctx;
  const t = ctx.now();
  const c = { db, t, later: [] };
  const out = [];
  const finish = async (p, extra = {}) => {
    if (p) await save(db, p, t);
    for (const fn of c.later) await fn();
    return { out, p: p ? view(p) : null, fight: p ? fightView(p) : null, monk: !!(p && p.monk), ...extra };
  };

  // The Daily News and the character list don't need a character.
  if (action === "news") {
    const day = body.yesterday ? new Date(Date.now() - 86400000) : new Date();
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
    const rows = (await db.prepare("SELECT head, body, at FROM usurper_news WHERE day = ? ORDER BY id LIMIT 200").bind(d).all()).results;
    return { day: d, rows };
  }
  if (action === "list") {
    const rows = (await db.prepare("SELECT data, user_id FROM usurper_players ORDER BY exp DESC LIMIT 100").all()).results.map(r => {
      const q = JSON.parse(r.data);
      return { name: q.name, race: RACES[q.race], cls: CLASSES[q.cls], level: q.level, exp: q.exp, mkills: q.mkills, pkills: q.pkills, alive: q.hps > 0, sex: q.sex, team: q.team || "", king: !!q.king, prison: q.location === LOC.prison };
    });
    return { rows };
  }

  let row = await loadRow(db, user.id);
  if (action === "create") {
    if (row) ctx.fail("You already have a character.");
    const sex = +body.sex === 2 ? 2 : 1, race = Math.trunc(+body.race), cls = Math.trunc(+body.cls);
    if (!(race >= 0 && race < RACES.length && cls >= 0 && cls < CLASSES.length)) ctx.fail("Pick a race and a class.");
    if ((race === R.Troll || race === R.Orc) && cls === C.Paladin) ctx.fail("Impossible combination! You cannot be a Troll or Orc in combination with the Paladin profession.");
    const p = newPlayer(user, sex, race, cls);
    await db.prepare("INSERT INTO usurper_players (user_id, name, level, exp, location, hps, allowed, data, updated) VALUES (?, ?, 1, 10, 0, ?, 1, '{}', ?)")
      .bind(user.id, p.name, p.hps, t).run();
    p.id = user.id;
    c.later.push(() => news(db, t, "New Player!", " We welcome " + PLY + p.name + T + ", a young brave " + RACES[race], " who seeks fortune and glory!"));
    return finish(p);
  }
  if (!row) {
    if (action === "enter") return { p: null, out: [] };
    ctx.fail("Create a character first.");
  }
  const p = parse(row);
  p.name = nm(user.handle) || p.name;   // follow the board handle
  if (maintain(p)) await dailyRealm(p, c);
  if (p.location === LOC.prison && action !== "enter" && !action.startsWith("prison/") && action !== "status" && action !== "news" && action !== "list") {
    ctx.fail("You are locked up in the Royal Prison!");
  }
  if (p.hps < 1 && p.allowed && action !== "enter") p.hps = p.maxhps;   // died while away but still allowed in (as "enter" does)
  const realm = await realmAction(action, body, p, c, ctx, out, finish);
  if (realm) return realm;

  if (action === "enter") {
    const mails = (await db.prepare("SELECT id, head, body, at FROM usurper_mail WHERE to_id = ? AND seen = 0 ORDER BY id LIMIT 30").bind(p.id).all()).results;
    if (mails.length) await db.prepare("UPDATE usurper_mail SET seen = 1 WHERE to_id = ? AND id <= ?").bind(p.id, mails[mails.length - 1].id).run();
    const wasAt = p.location;
    if (!p.allowed) {
      await save(db, p, t);
      return { p: view(p), out, mail: mails, barred: true };
    }
    if (p.hps < 1) p.hps = p.maxhps;      // killed while away, but still allowed in: back on your feet
    if (p.location === LOC.prison) {      // PRISONC.PAS: prisoners wake up in their cell
      p.fight = null; p.monk = false; p.siege = null;
      return finish(p, { mail: mails, wasAt, prison: true });
    }
    p.location = 0;                       // everyone wakes up in town
    // A fight left hanging by a dropped carrier: dungeon fights are lost, loot defaults to taking it.
    if (p.fight && p.fight.mode === "loot") await takePurse(p, p.fight, c, true);
    p.fight = null; p.monk = false; p.siege = null;
    return finish(p, { mail: mails, wasAt, kingNews: await kingLine(db) });
  }
  if (!p.allowed) ctx.fail("You may return tomorrow and regain some of your lost pride...");

  const needNoFight = () => { if (p.fight && p.fight.mode !== "loot") ctx.fail("You are in the middle of a fight!"); };

  switch (action) {
    case "status": return finish(p);

    // -------- the Dungeons
    case "dng/level": {
      needNoFight();
      const zz = Math.trunc(+body.level);
      const old = p.dl || p.level;
      if (zz >= p.level && zz <= p.level + 10 && zz <= 100) {
        p.dl = zz;
        out.push(zz === old ? "|03You remain on level " + MAG + zz : zz > old ? "|03You descend to level " + MAG + zz : "|03You ascend to level " + MAG + zz);
      } else out.push(T + "You are on level " + MAG + old);
      return finish(p);
    }
    case "dng/enter": {
      needNoFight();
      p.dl = Math.min(100, p.level);
      return finish(p);
    }
    case "dng/look": {
      needNoFight();
      p.monk = false;
      if (p.fights <= 0) { out.push(RED + "Sorry, you have no fights left for today."); return finish(p); }
      startDungeonFight(p, out);
      return finish(p);
    }
    case "fight": {
      const f = p.fight;
      if (!f || f.mode !== "dng") ctx.fail("You aren't fighting anything.");
      const cmd = String(body.cmd || "A").toUpperCase();
      const special = async how => { if (f.purpose) { const r = await purposeDone(p, f, c, out, how); if (r === "jailed") return finish(p, { jailed: true }); } return null; };
      const settle = async () => {
        if (f.purpose && p.hps < 1) await purposeDone(p, f, c, out, "died");
        else if (f.purpose && !p.fight) await purposeDone(p, f, c, out, "won");
        return finish(p, { dead: p.hps < 1 });
      };
      if (cmd === "R") {
        if (random(2) === 0) { out.push(T + "You have escaped battle!", HI + "You managed to escape!"); p.fight = null; return (await special("fled")) || finish(p); }
        out.push(T + "The monster won't let you escape!");
        const xx = random(f.dl * 10) + 3;
        out.push(T + "As you cowardly turn and run, you feel pain when something", T + "hits you in the back for " + cs(xx) + " points");
        p.hps -= xx;
        if (p.hps <= 0) {
          out.push(RED + "You have been slain!");
          playerDiesInDungeon(p, aliveMons(f)[0].name, out, c, "coward");
          await special("died");
          return finish(p, { dead: true });
        }
        out.push(RED + "You failed to escape!");
        return finish(p);
      }
      if (cmd === "B") {
        if (random(3) === 0) {
          out.push(T + "You throw yourself to the ground and plead for mercy!", T + "But the monster doesn't seem to care", T + "about your pathetic whining!", "",
            T + "You soon realize that your life has come to an end...", "|04Splatt! Splatt! Your limbs are torn apart...");
          playerDiesInDungeon(p, aliveMons(f)[0].name, out, c, "beg");
          await special("died");
          return finish(p, { dead: true });
        }
        out.push(T + "You throw yourself to the ground and plead for mercy!", T + "Your foe doesn't seem to care", T + "about whether you live or die.", "",
          T + "You soon realize that you will make it out of this situation!", T + "You watch how your foe slowly lurks away...");
        p.fight = null;
        return (await special("begged")) || finish(p);
      }
      const opts = { target: Math.trunc(+body.target) || 0 };
      if (cmd === "Q" || cmd === "H") {
        if (cmd === "Q") { if (p.hps >= p.maxhps) { out.push(HEAD + "You are in no need of healing!"); return finish(p); } quickHeal(p, out); }
        else healN(p, body.n, out);
      } else if (cmd === "C") {
        if (!castSpell(p, f, Math.trunc(+body.spell), opts, out)) return finish(p);
        opts.casted = true;
      } else if (cmd === "1") {
        if (p.cls === C.Assassin) {
          if (p.weapon === 0) { out.push(T + "You don't have a weapon!"); return finish(p); }
          const m = f.mons[opts.target] && f.mons[opts.target].hps > 0 ? f.mons[opts.target] : aliveMons(f)[0];
          out.push(T + "You try to Backstab the " + m.name + "!");
          if (random(3) === 0) { out.push(T + "You manage to cut the " + m.name + "!", T + "The " + m.name + " screams in pain!"); opts.stab = Math.floor(p.maxhps / 2); }
          else { out.push(T + "You missed!"); opts.stab = -1; }
        } else if (p.cls === C.Paladin) {
          const zz = Math.trunc(+body.amount);
          if (p.hps < 2) { out.push(T + "Sorry, too few hitpoints left!"); return finish(p); }
          if (!(zz > 0 && zz < p.hps)) { out.push(T + "Aborted."); return finish(p); }
          p.hps -= zz; opts.soul = zz;
        } else return finish(p);
      } else if (cmd === "F") {
        f.toDeath = true;
        out.push("|04IT'S YOU OR THEM!!");
        for (let r = 0; r < 300 && p.fight && p.hps > 0; r++) {
          if (p.hps + 3 < p.maxhps && p.healing > 0) quickHeal(p, out);
          dungeonRound(p, f, { target: 0 }, out, c);
        }
        return settle();
      }
      dungeonRound(p, f, opts, out, c);
      return settle();
    }
    case "heal": {   // outside a fight: (H)ealing and (Q)uick heal in the dungeon menu
      if (body.quick) quickHeal(p, out); else healN(p, body.n, out);
      return finish(p);
    }
    case "monk": {   // the monk after a fight, and Ravanella's Magic Shop: level*5 a potion
      const where = body.shop ? "shop" : "monk";
      if (where === "monk" && !p.monk) ctx.fail("The monk has gone.");
      const z = p.level * 5;
      let max = Math.floor(p.gold / z);
      if (p.healing + max > CFG.maxHeals) max = CFG.maxHeals - p.healing;
      const n = Math.max(0, Math.min(Math.trunc(+body.n || 0), max));
      p.monk = false;
      if (n > 0) {
        p.healing += n; p.gold -= n * z;
        out.push(TALK + "Ok, it's a deal.", T + "You buy " + "|11" + cs(n) + T + " potions.");
        if (where === "monk") out.push(PLY + "The Monk " + T + pick(["smiles at you.", "stares at you.", "waves goodbye.", "smirks.", "walks away.", "burps.", "is silent.", "smiles", "wishes you good luck."]));
      } else out.push(TALK + "No deal.");
      return finish(p);
    }

    // -------- shops (classic mode: one weapon, one armor)
    case "shop/list": {
      const items = body.kind === "armor" ? ARMORS : WEAPONS;
      return { items: items.map(([n, v, pw]) => [n, v, pw]) };
    }
    case "shop/buy": case "shop/best": case "shop/sell": {
      needNoFight();
      const armor = body.kind === "armor", items = armor ? ARMORS : WEAPONS, key = armor ? "armor" : "weapon", pow = armor ? "apow" : "wpow";
      const owner = armor ? CFG.reese : CFG.tully;
      if (action === "shop/sell") {
        if (!p[key]) { out.push(TALK + "Sell what?"); return finish(p); }
        const it = items[p[key] - 1], xx = Math.floor(it[1] / 2);
        if (!body.confirm) return finish(p, { offer: { name: it[0], price: xx } });
        p.gold += xx; p[key] = 0; p[pow] = 0;
        out.push(T + (armor ? "You give " + owner + " your armor, and receive the gold." : "You give the troll your weapon, and receive the gold."));
        return finish(p);
      }
      if (p[key]) { out.push(TALK + (armor ? "Get rid of your old armor first!" : "Get rid of your old weapon first!")); return finish(p); }
      let n = Math.trunc(+body.n);
      if (action === "shop/best") {
        if (p.gold <= 0) { out.push(TALK + "Haha! Get out of my store you halfwit!", TALK + "Come back when you have enough gold!"); return finish(p); }
        n = 0;
        for (let i = 1; i <= items.length; i++) { if (p.gold >= items[i - 1][1]) n = i; else break; }
        if (!n) { out.push(TALK + "Sorry friend! I don't have any " + (armor ? "armor" : "weapon") + " You can afford."); return finish(p); }
      }
      if (!(n >= 1 && n <= items.length)) ctx.fail("No such item.");
      let [name, price, power] = items[n - 1];
      if (!armor && p.race === R.Troll) price -= Math.round(price * 0.1);   // trolls stick together
      if (!body.confirm) return finish(p, { offer: { n, name, price, power, troll: !armor && p.race === R.Troll } });
      if (p.gold < price) { out.push(TALK + "No gold, no goods!" + T + (armor ? "" : ", the troll snores.")); return finish(p); }
      p.gold -= price; p[key] = n; p[pow] = power;
      out.push(T + (armor ? owner + " hands you the " + name + "." : "Ok. says the old troll and hands you the weapon."), T + "You give " + (armor ? owner : "the greedy creature") + " the gold.");
      c.later.push(() => news(db, t, armor ? "Armor" : "Weapon", " " + PLY + p.name + T + " bought " + (/^[aeiou]/i.test(name) ? "an " : "a ") + ITEM + name + T + "."));
      return finish(p);
    }

    // -------- the Healer: cures diseases (HEALERC.PAS)
    case "healer": {
      const costs = [5000, 6000, 7000, 7500, 8500].map(x => x * p.level);
      const which = String(body.which || "");
      const have = DISEASES.map(([k], i) => i).filter(i => p[DISEASES[i][0]]);
      if (!which) return finish(p, { costs });
      const list = which === "all" ? have : have.filter(i => String(i) === which);
      const total = list.reduce((s, i) => s + costs[i], 0);
      if (!list.length) { out.push(T + "You are not affected by that."); return finish(p, { costs }); }
      if (p.gold < total) { out.push(T + "You can't afford it!"); return finish(p, { costs }); }
      p.gold -= total; for (const i of list) p[DISEASES[i][0]] = false;
      out.push(T + "The healers chant and burn their herbs. You feel much better!");
      return finish(p, { costs });
    }

    // -------- the Bank (Lobba)
    case "bank": {
      needNoFight();
      const amt = Math.trunc(+body.amount);
      if (body.op === "deposit") {
        const x = Math.max(0, Math.min(amt >= 0 ? amt : p.gold, p.gold));
        p.gold -= x; p.bank += x;
        out.push(T + "You deposit " + GOLD + cs(x) + T + " gold.");
      } else if (body.op === "withdraw") {
        const x = Math.max(0, Math.min(amt >= 0 ? amt : p.bank, p.bank));
        p.bank -= x; p.gold += x;
        out.push(T + "You withdraw " + GOLD + cs(x) + T + " gold.");
      }
      return finish(p);
    }

    // -------- the Level Masters
    case "master/raise": {
      needNoFight();
      const sagee = MASTERS[(+p.master || 10) - 1];
      if (p.level > 99) {
        out.push(PLY + sagee + T + " clears his throat and speaks : " + TALK + "You cannot receive further", TALK + "levels from me. You must seek help elsewhere from now on.");
        return finish(p);
      }
      out.push(PLY + sagee + T + " looks at you carefully; ", "", TALK + "You are a fine looking " + raceLow(p.race));
      const x = xpNeed(p);
      if (x !== 0) {
        out.push(TALK + "but you are not yet fully qualified to receive a raise to level " + (p.level + 1) + ".", TALK + "You need " + WHITE + cs(x) + TALK + " experience points!");
        return finish(p);
      }
      out.push(TALK + "and you fully deserve a raise.");
      const n = raise(p, out);
      c.later.push(() => news(db, t, "Level Raise", " " + PLY + p.name + T + " the " + CLASSES[p.cls] + " reached level " + WHITE + p.level + T + (n > 1 ? " (" + n + " levels at once!)" : ".")));
      return finish(p);
    }
    case "master/choose": {
      needNoFight();
      const m = String(body.master || "");
      if (!/^[0-9]$/.test(m) || m === p.master) return finish(p);
      const yy = p.level * 30000;
      if (!body.confirm) return finish(p, { offer: { name: MASTERS[(+m || 10) - 1], price: yy } });
      if (p.gold < yy) { out.push(T + "And You can't afford it!"); return finish(p); }
      p.gold -= yy; p.master = m;
      out.push(HI + "You have a new Master!");
      return finish(p);
    }

    // -------- where to sleep (the session ends after this)
    case "sleep": {
      needNoFight();
      const floor = Math.trunc(+body.floor) || 0;
      if (floor === LOC.beggar) {   // GAMEC.PAS: a seat at the Beggars Wall
        if (p.gold < CFG.beggarCost) { out.push(T + "You can't afford it!"); return finish(p, { slept: false }); }
        p.gold -= CFG.beggarCost;
        p.location = LOC.beggar;
        out.push(T + "You take your seat among the other beggars.", T + "You pray that people will have mercy upon you.", T + "(at least so you can get those " + GOLD + cs(CFG.beggarCost) + T + " back)");
        c.later.push(() => news(db, t, "Beggar", " " + PLY + p.name + T + " dozed off at the Beggars Wall."));
        return finish(p, { slept: true });
      }
      if (floor < 0 || floor > 4) ctx.fail("No such room.");
      if (floor > 0) {
        if (p.gold < ROOMS[floor]) { out.push(T + "You can't afford it!"); return finish(p, { slept: false }); }
        p.gold -= ROOMS[floor];
        c.later.push(() => news(db, t, "Inn", " " + PLY + p.name + T + " is staying in a room at the Inn."));
        out.push(T + "You pay " + GOLD + cs(ROOMS[floor]) + T + " gold and get the key.", T + "You lock the door and go to sleep.");
      } else {
        out.push(T + "You take one of the free beds in the dormitory.", T + "Soon you fall asleep to the heavy breathing from the", T + "sleeping adventurers...");
      }
      p.location = floor;
      return finish(p, { slept: true });
    }

    // -------- the Dormitory and the Inn: sleeping players you can attack
    case "sleepers": {
      const inn = !!body.inn, online = await onlineIds(db);
      const rows = (await db.prepare(
        "SELECT user_id, data FROM usurper_players WHERE user_id != ? AND hps > 0 AND allowed = 1 AND " + (inn ? "location BETWEEN 1 AND 4" : "location IN (0, 7)") + " ORDER BY exp DESC LIMIT 60"
      ).bind(p.id).all()).results;
      const list = [];
      for (const r of rows) {
        if (online.has(r.user_id)) continue;
        const q = JSON.parse(r.data);
        list.push({ id: r.user_id, name: q.name, race: RACES[q.race], cls: CLASSES[q.cls], level: q.level, floor: q.location, bribe: BRIBES[q.location] || 0, sex: q.sex, beggar: q.location === LOC.beggar, team: q.team || "" });
      }
      return finish(p, { sleepers: list });
    }
    case "attack": {
      needNoFight();
      const vid = Math.trunc(+body.id), how = String(body.how || "W").toUpperCase();
      if (vid === p.id) ctx.fail("That's you.");
      const vr = await loadRow(db, vid);
      const v = parse(vr);
      if (!v) ctx.fail("Couldn't locate that character.");
      if (maintain(v)) { await dailyRealm(v, c); await save(db, v, t); }
      if ((await onlineIds(db)).has(vid)) { out.push(PLY + v.name + RED + " is awake and walking the streets!"); return finish(p); }
      if (!(v.hps > 0 && v.allowed)) { out.push(PLY + v.name + T + " isn't here."); return finish(p); }
      if (v.location === LOC.prison || v.location === LOC.castle) { out.push(PLY + v.name + T + " isn't here."); return finish(p); }
      const inn = v.location >= 1 && v.location <= 4;
      if (!!body.inn !== inn) { out.push(PLY + v.name + T + " has left " + his(v) + " bed!"); return finish(p); }
      if (p.level - v.level > CFG.levelDiff) { out.push(RED + (inn ? "That would be too easy!" : "Nah, that wouldn't be a fair fight!")); return finish(p); }
      if (inn) {   // INNC.PAS Attack_Player: bribe your way to the room, then a player fight
        if (p.pfights < 1) { out.push(RED + "Sorry, but you have run out of player fights."); return finish(p); }
        const xx = BRIBES[v.location];
        if (p.gold < xx) { out.push(T + "You don't have " + cs(xx) + " gold for the bribes."); return finish(p); }
        p.gold -= xx;
        out.push(WHITE + "You pay.", T + "The innkeeper looks the other way while you sneak up the stairs.");
        startPvp(p, v, "inn", out);
        return finish(p);
      }
      if (how === "P") { await pickpocket(p, v, String(body.steal || "G").toUpperCase(), out, c); return finish(p); }
      if (how === "M") {
        if (p.pfights < 1) { out.push(T + "Sorry, but you have run out of player fights."); return finish(p); }
        if (p.darknr < 1) { out.push(T + "Sorry, but you have run out of Dark Deeds."); return finish(p); }
        out.push(RED + "Dirty deed!", T + "You sneak up to " + PLY + v.name + "s" + T + " bed and ready your weapon.");
        if (random(4) !== 0) {
          out.push(T + "Just before you reach " + PLY + v.name + T + ", the foul creature wakes up and jumps", T + "out of " + his(v) + " bed.",
            TALK + "So you don't dare to face me in the open you COWARD! " + PLY + v.name + T + " screams.",
            T + "Everybody in the dormitory is awake and gathered around you.", T + "You realize that soon you will be fighting for your life.");
          c.later.push(() => news(db, t, "Attempted Murder!", " The evil " + RACES[p.race] + " " + PLY + p.name + T + " tried to murder " + PLY + v.name + T + "!"));
          c.later.push(() => mail(db, t, v.id, "Attempt on Your Life!", p.name + " tried to murder you while you were sleeping!", "But you woke up just before the creep was about to strangle you!"));
          p.darknr--; p.dark += 50;
          startPvp(p, v, "murder", out);
          return finish(p);
        }
        out.push("|07Evil Deed", "", T + "You quickly strangle " + PLY + v.name + T + " and then leave the room before", T + "anyone notice anything. As you leave the dormitory you",
          T + "hear screaming; " + TALK + "Murder! Murder! " + PLY + v.name + TALK + " has been murdered!\"", T + "You smile, and disappear out on the street...", "", HI + "** Successful Murder **");
        const x = random(75) * v.level, dk = random(25) + 20;
        p.exp += x; p.dark += dk; p.darknr--;
        out.push(T + "You receive " + WHITE + cs(x) + T + " experience points for this vicious deed!", T + "Your soul darkens for " + WHITE + cs(dk) + T + " hell points!");
        v.hps = 0; await save(db, v, t);
        await collectBounty(c, p, v, out);
        c.later.push(() => news(db, t, "Murder!", " Somebody put " + his(p) + " hands around " + PLY + v.name + "s" + T + " throat and squeezed!",
          " Rumours has it that the " + RACES[p.race] + " " + PLY + p.name + T + " had something to do with it!"));
        c.later.push(() => mail(db, t, v.id, "Your Death", "You were murdered by " + p.name + "!", "It was a cowards deed! You were killed in your sleep!"));
        return finish(p);
      }
      // W: wake up and challenge
      if (p.pfights < 1) { out.push(T + "You have no player fights left."); return finish(p); }
      out.push("|07You kick " + PLY + v.name + "|07 out of " + his(v) + " bed and challenge " + him(v) + "!",
        "|07\"Wake up you sloppy pig! Time to die!\" You scream in " + his(v) + " ear.", PLY + v.name + "|07 doesn't seem to be very frightened of your threats.",
        "|07" + He(v) + " grins as " + he(v) + " straps on " + his(v) + " equipment...");
      startPvp(p, v, "wake", out);
      return finish(p);
    }
    case "pvp": {
      const f = p.fight;
      if (!f || f.mode !== "pvp") ctx.fail("You aren't fighting anyone.");
      const cmd = String(body.cmd || "A").toUpperCase();
      const opts = {};
      if (cmd === "Q") { quickHeal(p, out); opts.healedOnly = true; }
      else if (cmd === "H") { healN(p, body.n, out); opts.healedOnly = true; }
      else if (cmd === "1") {
        if (p.cls === C.Assassin) {
          if (!p.weapon) { out.push(T + "You don't have a weapon!"); return finish(p); }
          out.push(T + "You try to Backstab " + PLY + f.foe.name + T + "!");
          if (random(3) === 0) { out.push(T + "You manage to cut " + him(f.foe) + "!"); opts.stab = Math.floor(p.maxhps / 2); } else { out.push(T + "You missed!"); opts.stab = -1; }
        } else if (p.cls === C.Paladin) {
          const zz = Math.trunc(+body.amount);
          if (!(zz > 0 && zz < p.hps)) { out.push(T + "Aborted."); return finish(p); }
          p.hps -= zz; opts.soul = zz;
        }
      }
      const rounds = cmd === "F" ? 300 : 1;
      if (cmd === "F") { f.toDeath = true; out.push("|04IT'S YOU OR " + (f.foe.sex === 2 ? "HER" : "HIM") + "!!"); }
      for (let r = 0; r < rounds; r++) {
        if (cmd === "F" && p.hps + 3 < p.maxhps && p.healing > 0) quickHeal(p, out);
        pvpRound(p, f, r === 0 ? opts : {}, out);
        if (f.mode === "beg" || p.hps < 1 || f.foe.hps < 1) break;
        out.push(PLY + "Your" + T + " hitpoints : " + WHITE + cs(p.hps) + T + "   " + PLY + f.foe.name + "s" + T + " hitpoints : " + WHITE + cs(f.foe.hps));
      }
      if (f.kind === "guard" || f.kind === "throne" || f.kind === "pguard") {
        if (f.mode === "beg") { f.mode = "pvp"; out.push(T + "You show no mercy."); f.foe.hps = 0; }
        if (p.hps < 1) { await siegeDuelLost(p, f, c, out); return finish(p, { dead: true }); }
        if (f.foe.hps < 1) { await siegeDuelWon(p, f, c, out); return finish(p, { dead: p.hps < 1 }); }
        return finish(p);
      }
      if (f.mode === "beg") return finish(p);
      if (p.hps < 1 && f.foe.hps < 1) {
        out.push("", RED + "Both you and " + PLY + f.foe.name + RED + " suffer from fatal wounds.", RED + "There is darkness...");
        const v = parse(await loadRow(db, f.foe.id));
        if (v) { v.hps = 0; v.pdefeats++; await save(db, v, t); }
        c.later.push(() => mail(db, t, f.foe.id, "Your Death", p.name + " attacked you while you were sleeping.", "You fought back. You killed each other!"));
        c.later.push(() => news(db, t, "Player Fight!", " " + PLY + p.name + T + " attacked " + PLY + f.foe.name + T + ". " + RED + "They were both killed!"));
        p.hps = 0; p.allowed = false; p.gold = 0; p.pdefeats++; p.fight = null;
        return finish(p, { dead: true });
      }
      if (f.foe.hps < 1) { await pvpVictory(p, f, c, out, false); return finish(p); }
      if (p.hps < 1) { await pvpDefeat(p, f, c, out); return finish(p, { dead: true }); }
      return finish(p);
    }
    case "pvp/spare": {
      const f = p.fight;
      if (!f || f.mode !== "beg") ctx.fail("Nobody is begging.");
      if (body.spare) await pvpVictory(p, f, c, out, true);
      else {
        out.push("", T + "With a beautiful swing, you took " + his(f.foe) + " head off!", T + "The crowd cheer when you hold up " + PLY + f.foe.name + "s" + T + " head for them!", T + "Your soul darkens!");
        await pvpVictory(p, f, c, out, false);
      }
      return finish(p);
    }
    case "pvp/loot": {
      const f = p.fight;
      if (!f || f.mode !== "loot") ctx.fail("There's nothing to loot.");
      await takePurse(p, f, c, !!body.take, body.note, out);
      out.push("", "|11Good work!");
      return finish(p);
    }
  }
  ctx.fail("Unknown command.", 404);
}

// After a won player fight: take the purse (or not) and tell the victim.
async function takePurse(p, f, c, take, note, out = []) {
  const v = parse(await loadRow(c.db, f.foe.id));
  let gold = 0;
  if (v && take && v.gold > 0) { gold = v.gold; v.gold = 0; await save(c.db, v, c.t); }
  p.gold += gold;
  if (gold > 0) out.push(T + "You take " + GOLD + cs(gold) + T + " " + money(gold) + ".");
  const purse = gold > 0 ? p.name + " emptied your purse, you lost " + cs(gold) + " " + money(gold) + "!"
    : v && v.gold > 0 ? p.name + " let you keep your purse with " + cs(v.gold) + " " + money(v.gold) + "." : "";
  const where = FLOORS[(f.loc || 0)] || "the Dormitory";
  c.later.push(() => mail(c.db, c.t, f.foe.id, "Defeat!", "While you were asleep in " + where + ", " + p.name + " attacked you!",
    "You were slain by " + p.name + "! " + He(p) + " was too strong for you!", purse,
    note ? "Just before you died, " + p.name + " said: " + String(note).replace(/[|{}\x00-\x1f]/g, "").slice(0, 70) : ""));
  p.fight = null;
}

// Pick-pocket a sleeper (VARIOUS3.PAS Attack_Guest 'P'). Failure means a fight.
async function pickpocket(p, v, steal, out, c) {
  if (p.pick < 1) { out.push(RED + "You have no attempts left. Try again tomorrow!"); return {}; }
  if (v.gold < 1 && v.healing < 1) { out.push(T + "Nah, " + PLY + v.name + T + " has nothing of value."); return {}; }
  p.pick--;
  let money_ = steal !== "P" && v.gold > 0, potions = !money_ && v.healing > 0;
  if (!money_ && !potions) money_ = true;
  out.push(T + "You sneak up beside " + PLY + v.name + "s" + T + " bed...");
  out.push(money_ ? T + "You cautiously lift " + PLY + v.name + "s" + T + " hand from " + his(v) + " purse......." : T + "You cautiously lift " + PLY + v.name + "s" + T + " head from the pillow.......");
  if (random(3) === 0) {
    if (money_) {
      const g = v.gold; p.gold += g; v.gold = 0;
      out.push(T + "You took " + GOLD + cs(g) + T + " " + money(g) + "!", "", HI + "Good work!");
      c.later.push(() => news(c.db, c.t, pick(["Pick-Pockets at the Dormitory", "Cleptomaniac on the lose!"]), " " + PLY + v.name + T + " woke up at the Dormitory, noticing " + his(v) + " purse missing."));
      c.later.push(() => mail(c.db, c.t, v.id, pick(["Thieves!", "Kleptomaniac!"]), "Some malicious character emptied your purse while you", "were sleeping. The thief got away with " + cs(g) + " " + money(g) + "."));
    } else {
      const n = v.healing; p.healing += n; v.healing = 0;
      out.push(T + "You took " + GOLD + cs(n) + T + " healing potions!", "", HI + "Good work!");
      c.later.push(() => news(c.db, c.t, pick(["Pick-Pockets at the Dormitory", "Cleptomaniac on the lose!"]), " " + PLY + v.name + T + " woke up at the Dormitory, noticing that many", " of " + his(v) + " Healing Potions were missing!"));
      c.later.push(() => mail(c.db, c.t, v.id, pick(["Thieves!", "Kleptomaniac!"]), "Some unscrupulous character put his arm under your pillow last night while you", "were sleeping. The thief got away with " + cs(n) + " potions."));
    }
    await save(c.db, v, c.t);
    return {};
  }
  if (random(2) === 0) out.push("", RED + "Oh no! " + PLY + v.name + RED + " woke up! And " + he(v) + " is angry...");
  else out.push("", RED + "Suddenly " + PLY + v.name + RED + " opens " + his(v) + " eyes!", TALK + " I was never asleep! I have been watching you! Thieving scoundrel!");
  p.pfights++;     // a pick-pocket brawl doesn't use up one of the day's player fights
  startPvp(p, v, "pick", out);
  return {};
}

// Spells in the dungeon. Returns false if nothing was cast.
function castSpell(p, f, n, opts, out) {
  if (!SPELLCASTER.has(p.cls)) { out.push(T + "You don't know any spells."); return false; }
  if (!(n >= 1 && n <= 12) || p.level < LEVEL_NEEDED[n - 1]) { out.push(T + "You don't know that spell."); return false; }
  const sp = (SPELLS[p.cls] || {})[n];
  if (!sp) { out.push(T + "That spell is lost to time on this board."); return false; }
  const cost = n * 10;
  if (p.mana < cost) { out.push(T + "You don't have enough mana."); return false; }
  p.mana -= cost;
  out.push(PLY + p.name + T + " utters " + TALK + "'" + SPELL_UTTER[p.cls][n - 1] + "'" + T + " (" + SPELL_NAMES[p.cls][n - 1] + ")");
  const targets = sp.multi ? aliveMons(f) : [f.mons[opts.target] && f.mons[opts.target].hps > 0 ? f.mons[opts.target] : aliveMons(f)[0]];
  if (sp.kind === "heal") {
    const x = sp.lo + random(sp.spread);
    p.hps = Math.min(p.maxhps, p.hps + x);
    out.push(T + "You regain some hitpoints!");
  } else if (sp.kind === "ward") {
    p.ward = (p.ward || 0) + sp.lo;
    out.push(T + "You feel protected!");
  } else {
    for (const m of targets) {
      const res = m.res <= 10 ? 20 : m.res <= 20 ? 18 : m.res <= 30 ? 16 : m.res <= 40 ? 14 : 12;
      if (random(res) === 0) { out.push("|13The spell doesn't affect " + MON + m.name + "|13!"); continue; }
      if (sp.kind === "hold") {
        m.hold = 1; m.holdKeep = sp.keep;
        out.push(T + m.name + (p.cls === C.Magician ? " suddenly goes to sleep!" : " suddenly freezes!"));
      } else {
        const dmg = sp.lo + random(sp.spread);
        out.push(T + "The spell hits the " + MON + m.name + T + " for " + WHITE + cs(dmg) + T + " damage!");
        m.hps -= dmg;
        if (m.hps < 1) monsterDied(p, f, m, out);
      }
    }
  }
  return true;
}

// =====================================================================================
// PHASE 2: the realm. Gangs, the Castle and the throne, the prison, bounties, the
// Beggars Wall and royal quests. Converted from TCORNER, GANGWARS, SORTTEAM, CHALLENG,
// CASTLE, CHALLKNG, KMAINT, MAINT, PRISONC, PRISONC1, PRISONF, BOUNTY, WANTEDSC,
// VARIOUS2, GAMEC, RQUESTS and PLYQUEST (.PAS).
// =====================================================================================

// EDITOR/MOATRES.PAS: the creatures a ruler can put in the moat. [name, cost, hps, armor, attack]
const MOAT = [["Eel", 2500, 50, 15, 15], ["Crocodile", 15000, 90, 25, 25], ["Giant Octopussy", 50000, 150, 30, 30],
  ["Hippo", 125000, 300, 32, 32], ["Lake Monster", 1100000, 950, 55, 55]];
const CHARGES = { H: ["was arrested for High Treason!", "You were arrested for High Treason."],
  P: ["was arrested for indecent behaviour.", "You were arrested for being a public nuisance."],
  D: ["was arrested for mocking the Royal Family.", "You were arrested for mocking the Royal Family."],
  C: ["was arrested for alleged criminal activities.", "You were arrested for alleged criminal activities."],
  N: ["was arrested; no official explanation has been given.", "No explanation why you were arrested was given."] };
const QREWARD = ["nothing", "experience", "gold", "healing potions", "darkness", "chivalry"];
const kingString = sex => (sex === 2 ? "Queen" : "King");
const KC = "|14";   // the ruler's color
const TC = "|11";   // team color
const clean = (v, n) => String(v ?? "").replace(/[|{}\x00-\x1f]/g, "").trim().slice(0, n);

async function teamHash(name, pw) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("usurper-team|" + name.toUpperCase() + "|" + pw));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- the King record (INIT.PAS KingRec)
function newKing() {   // VARIOUS.PAS New_King
  return { name: "", id: null, sex: 1, race: 0, days: 0, tax: 0, taxAlign: 0, treasury: 0, prisonsLeft: 4, executeLeft: 3,
    questsLeft: CFG.questsPerDay, moat: null, moatNr: 0, guards: [], apps: [], day: today() };
}
async function loadKing(c) {
  const row = await c.db.prepare("SELECT data FROM usurper_realm WHERE k = 'king'").first();
  const k = row ? { ...newKing(), ...JSON.parse(row.data) } : newKing();
  if (k.day !== today()) await kingDaily(c, k);
  return k;
}
async function saveKing(c, k) {
  await c.db.prepare("INSERT OR REPLACE INTO usurper_realm (k, data) VALUES ('king', ?)").bind(JSON.stringify(k)).run();
}
// MAINT.PAS / KMAINT.PAS, the Castle's half of the day: new allowances, guard salaries, stale quests.
async function kingDaily(c, k) {
  const days = Math.max(1, Math.min(30, dayDiff(k.day || today(), today())));
  k.day = today();
  k.prisonsLeft = 4; k.executeLeft = 3; k.questsLeft = CFG.questsPerDay;
  if (k.id) k.days += days;
  for (const g of k.guards) {
    const pay = (g.pay || 0) * days;
    if (pay <= 0) continue;
    if (k.treasury >= pay) {
      k.treasury -= pay;
      await c.db.prepare("UPDATE usurper_players SET data = json_set(data, '$.bank', json_extract(data, '$.bank') + ?) WHERE user_id = ?").bind(pay, g.id).run();
    } else if (k.id) {
      await mail(c.db, c.t, g.id, "No Salary!", "The Royal Treasury couldn't pay your salary of " + cs(pay) + " gold.", "The " + kingString(k.sex) + " is broke!");
    }
  }
  // quests nobody finished in time are taken back (KMAINT.PAS)
  const qs = (await c.db.prepare("SELECT id, data, occupier FROM usurper_quests WHERE done = 0 AND occupier IS NOT NULL").all()).results;
  for (const r of qs) {
    const q = JSON.parse(r.data);
    q.occdays = (q.occdays || 0) + days;
    if (q.occdays > q.days) {
      await c.db.prepare("UPDATE usurper_quests SET done = 2, data = ? WHERE id = ?").bind(JSON.stringify(q), r.id).run();
      await mail(c.db, c.t, r.occupier, "Quest Failed", "You didn't complete the Royal Quest in time.", "The Quest has been cancelled.");
    } else await c.db.prepare("UPDATE usurper_quests SET data = ? WHERE id = ?").bind(JSON.stringify(q), r.id).run();
  }
  await saveKing(c, k);
}
async function kingLine(db) {
  const row = await db.prepare("SELECT data FROM usurper_realm WHERE k = 'king'").first();
  if (!row) return null;
  const k = JSON.parse(row.data);
  return k.name ? kingString(k.sex) + " " + k.name + " rules the realm (day " + cs(k.days + 1) + " of the reign)" : null;
}

// ---------------------------------------------------------------- the player's half of the day (MAINT.PAS)
async function dailyRealm(p, c) {
  const days = p.newDays || 1;
  delete p.newDays;
  // prison sentences run out
  if (p.location === LOC.prison) {
    for (let i = 0; i < days && p.location === LOC.prison; i++) {
      if ((p.prisonDays || 0) < 1) {
        p.location = LOC.dorm; p.prisonDays = 0;
        c.later.push(() => news(c.db, c.t, "Prisoner Released", " " + PLY + p.name + T + " was released from prison."));
      } else p.prisonDays--;
    }
  }
  // a night at the Beggars Wall pays, if you live through it
  if (p.location === LOC.beggar && p.hps > 0) {
    p.bank += CFG.beggarGift;
    c.later.push(() => mail(c.db, c.t, p.id, "Begging", "You received " + cs(CFG.beggarGift) + " gold coins when you sat begging."));
  }
  // the Royal Tax comes out of the bank
  if (!p.king && p.bank > 100 && !p.taxRelief) {
    const k = await loadKing(c);
    if (k.id && k.tax > 0 && k.id !== p.id) {
      let pay = true;
      if (k.taxAlign === 1 && p.chiv < p.dark) pay = false;
      if (k.taxAlign === 2 && p.dark < p.chiv) pay = false;
      if (pay) {
        const yy = Math.round(p.bank * k.tax / 100);
        if (yy > 0 && k.treasury < 2e9) {
          p.bank -= yy; k.treasury += yy; p.taxPaid = (p.taxPaid || 0) + yy;
          await saveKing(c, k);
        }
      }
    }
  }
  // the gang that holds the town shares the protection money (USURPER.CFG line 89)
  if (p.team && p.hps > 0) {
    const tm = await c.db.prepare("SELECT turf FROM usurper_teams WHERE name = ?").bind(p.team).first();
    if (tm && tm.turf) {
      const r = await c.db.prepare("SELECT COUNT(*) n, SUM(level) lv FROM usurper_players WHERE team = ?").bind(p.team).first();
      const share = r.n ? Math.round((r.lv || 0) * CFG.townReward / r.n) : 0;
      if (share > 0) {
        p.bank += share;
        c.later.push(() => mail(c.db, c.t, p.id, "Town Control", "Your gang controls the town. The businessmen paid up.", "Your share: " + cs(share) + " gold coins (deposited in the bank)."));
      }
    }
  }
}

// ---------------------------------------------------------------- shared lookups
async function teamMembers(db, team) {
  if (!team) return [];
  return (await db.prepare("SELECT user_id, data FROM usurper_players WHERE team = ? ORDER BY exp DESC").bind(team).all()).results.map(r => parse({ user_id: r.user_id, data: r.data }));
}
function memberView(q, online) {
  return { id: q.id, name: q.name, level: q.level, race: RACES[q.race], cls: CLASSES[q.cls], hps: q.hps, maxhps: q.maxhps, alive: q.hps > 0,
    prison: q.location === LOC.prison, online: online ? online.has(q.id) : false, sex: q.sex, king: !!q.king };
}
async function findPlayer(db, name, exceptId) {
  const s = clean(name, 30).toUpperCase();
  if (!s) return [];
  const rows = (await db.prepare("SELECT user_id, data FROM usurper_players WHERE user_id != ? AND upper(name) LIKE ? ORDER BY exp DESC LIMIT 10")
    .bind(exceptId || 0, "%" + s.replace(/[%_]/g, "") + "%").all()).results;
  return rows.map(r => parse({ user_id: r.user_id, data: r.data }));
}
async function loadOther(c, id) {
  const v = parse(await loadRow(c.db, id));
  if (v && maintain(v)) await dailyRealm(v, c);
  return v;
}
async function isGuard(c, id) { const k = await loadKing(c); return k.guards.some(g => g.id === id); }

// Wanted posters: whoever kills the wanted collects (VARIOUS2.PAS).
async function collectBounty(c, winner, loser, out) {
  const rows = (await c.db.prepare("SELECT * FROM usurper_wanted WHERE target_id = ? AND collected = 0").bind(loser.id).all()).results;
  if (!rows.length) return 0;
  let sum = 0;
  for (const w of rows) {
    sum += w.gold;
    await c.db.prepare("UPDATE usurper_wanted SET collected = 1 WHERE id = ?").bind(w.id).run();
    if (w.by_id !== winner.id) c.later.push(() => mail(c.db, c.t, w.by_id, "Reward Collected", winner.name + " attacked and killed " + loser.name + "!", winner.name + " collected the reward set by You for " + cs(w.gold) + "."));
  }
  winner.gold += sum;
  if (out) out.push("", HI + "*** BOUNTY! ***", T + "There was a reward on " + PLY + loser.name + "s" + T + " head! You collect " + GOLD + cs(sum) + T + " " + money(sum) + "!");
  c.later.push(() => news(c.db, c.t, "Reward", " " + PLY + winner.name + T + " collected the Reward for " + RED + loser.name + T + "."));
  return sum;
}

// computer_computer (COMPWAR.PAS): two characters slug it out, nobody at the controls.
function autoDuel(a, b) {
  let rounds = 0;
  while (a.hps > 0 && b.hps > 0 && rounds < 200) {
    rounds++;
    for (const x of [a, b]) if (x.hps + 5 <= x.maxhps && x.healing > 0) { const need = Math.ceil((x.maxhps - x.hps) / 5); const n = Math.min(need, x.healing); x.healing -= n; x.hps = Math.min(x.maxhps, x.hps + n * 5); }
    let pa = Math.max(0, normalAttack(a) - normalDefence(b)), pb = Math.max(0, normalAttack(b) - normalDefence(a));
    if (pa < 2 && pb < 2) { pa += random(5) + 2; pb += random(5) + 2; }
    b.hps -= pa; a.hps -= pb;
  }
  if (a.hps > 0 && b.hps > 0) { if (a.hps >= b.hps) b.hps = 0; else a.hps = 0; }
  return rounds;
}

// ---------------------------------------------------------------- gang wars (GANGWARS.PAS)
async function gangWar(p, c, oppo, turfgo, out) {
  const db = c.db;
  if (!p.team) { out.push(RED + "You don't belong to a team!"); return; }
  if ((p.tfights ?? CFG.teamFights) < 1) { out.push(RED + "Sorry, but you have no team-fights left."); return; }
  const online = await onlineIds(db);
  const fresh = async list => { for (const q of list) if (q.id !== p.id && maintain(q)) await dailyRealm(q, c); return list; };
  const mates = (await fresh(await teamMembers(db, p.team))).filter(q => q.id !== p.id && q.hps > 0 && q.allowed !== false && q.location !== LOC.prison && !online.has(q.id)).slice(0, CFG.maxTeam - 1);
  if (turfgo) {
    const holder = await db.prepare("SELECT name FROM usurper_teams WHERE turf = 1").first();
    if (holder && holder.name.toUpperCase() === p.team.toUpperCase()) { out.push(RED + "Your team already control the town!"); return; }
    if (!holder) {   // no gang holds the town: take it for free
      await db.prepare("UPDATE usurper_teams SET turf = (name = ?), turf_day = ? ").bind(p.team, today()).run();
      out.push("", GOLD + "The Town is in your hands!", "",
        mates.length ? T + "You and your gang walk out and proclaim to the businessmen that the town now" : T + "You walk out and proclaim to the businessmen that the town now",
        T + "falls under your control. They must pay or have their shops burned.", "", T + "You congratulate yourself to this easy takeover!");
      for (const m of mates) c.later.push(() => mail(db, c.t, m.id, "Town Control", p.name + " led the team to the success", "of dominating the Town. The opposition was none!"));
      c.later.push(() => news(db, c.t, "Gang Takeover!", TC + " " + p.team + T + " took over the town without bloodshed.", " " + PLY + p.name + T + " led " + his(p) + " team to this victory."));
      return;
    }
    oppo = holder.name;
    out.push(TC + oppo.toUpperCase() + WHITE + " holds the town!");
  }
  const tm = await db.prepare("SELECT name FROM usurper_teams WHERE name = ?").bind(clean(oppo, 25)).first();
  if (!tm) { out.push(RED + "There is no such team."); return; }
  oppo = tm.name;
  if (oppo.toUpperCase() === p.team.toUpperCase()) { out.push(RED + "That's your own team!"); return; }
  const all = await fresh(await teamMembers(db, oppo));
  const foes = all.filter(q => q.hps > 0 && q.allowed !== false && q.location !== LOC.prison && !online.has(q.id)).slice(0, CFG.maxTeam);
  if (!foes.length) {
    const allDown = all.every(q => q.hps < 1 || q.location === LOC.prison);
    if (turfgo && allDown) {
      out.push(T + "The members of " + TC + oppo + T + " are all dead or in prison.", T + "You can easily take the town without bloodshed. Piece of cake!", T + "Nice doing!");
      await db.prepare("UPDATE usurper_teams SET turf = (name = ?), turf_day = ?").bind(p.team, today()).run();
      c.later.push(() => news(db, c.t, "Gang Takeover!", " " + TC + p.team + T + " took over the town without bloodshed.", " " + PLY + p.name + T + " led " + his(p) + " team to this victory.",
        " The old rulers, " + RED + oppo + T + " was unable to put up a fight."));
      return;
    }
    out.push(T + "Noone in " + TC + oppo + T + " can fight right now!");
    return;
  }
  p.tfights = (p.tfights ?? CFG.teamFights) - 1;
  for (const q of [...mates, ...foes]) q.hps = q.maxhps;   // offline fighters come rested
  const mine = [p, ...mates];
  out.push("", WHITE + "Time to fight!");
  c.later.push(() => news(db, c.t, "Gang War!", " " + TC + p.team + T + " challenged " + TC + oppo + T));
  let bround = 0, result = null;
  while (!result && bround < 20) {
    bround++;
    out.push("", HEAD + "Battle round " + TALK + "# " + bround, T + "You call out your opponents to battle...", T + "And here they come! Confrontation!");
    const used = new Set(), pairs = [];
    for (const a of mine) {
      if (a.hps < 1) continue;
      const b = foes.find(f => f.hps > 0 && !used.has(f.id));
      if (!b) break;
      used.add(b.id); pairs.push([a, b]);
      out.push((a === p ? PLY + "You " + T + "face " : PLY + a.name + T + " is ready to meet ") + PLY + b.name);
    }
    out.push("", RED + "-*- Spill blood -*-", "", HI + "Battle-Results from encounter :");
    const lines = [];
    for (const [a, b] of pairs) {
      const r = autoDuel(a, b), rr = r + (r > 1 ? " rounds" : " round");
      let s = "   " + PLY + a.name + T + " versus " + PLY + b.name + T;
      if (a.hps < 1 && b.hps < 1) s += " : both dead! (" + rr + ")";
      else if (a.hps < 1) s += " : " + RED + a.name + T + " dead (" + rr + ")";
      else s += " : " + RED + b.name + T + " dead (" + rr + ")";
      out.push(s); lines.push(s);
      const winner = a.hps > 0 ? a : b.hps > 0 ? b : null, loser = winner === a ? b : winner === b ? a : null;
      if (winner && loser) {
        const x = (random(50) + 250) * loser.level;
        winner.exp += x;
        if (winner === p) out.push(WHITE + "   You receive " + cs(x) + " experience points!");
        else c.later.push(() => mail(db, c.t, winner.id, "Gang War", "You fought in a gangwar against " + (winner.team === p.team ? oppo : p.team) + "!", "You killed " + loser.name + " and received " + cs(x) + " experience points!"));
        if (loser !== p) c.later.push(() => mail(db, c.t, loser.id, "Your Death", "You were killed in a gangwar with " + (loser.team === p.team ? oppo : p.team) + "!", winner.name + " killed you!"));
        await collectBounty(c, winner, loser, winner === p ? out : null);
        if (loser.id) loser.pdefeats = (loser.pdefeats || 0) + 1;
        if (winner.id) winner.pkills = (winner.pkills || 0) + 1;
      }
    }
    c.later.push(() => news(db, c.t, "  " + bround + " Bash results :", ...lines));
    const mineAlive = mine.some(q => q.hps > 0), foesAlive = foes.some(q => q.hps > 0);
    if (!mineAlive && !foesAlive) {
      result = "none";
      out.push("", RED + "No survivors!", T + "No gangmember survived this slaughter!", T + "May you all learn something from this...", T + "Like : all wars are meaningless", "", T + "Darkness prevails...");
      c.later.push(() => news(db, c.t, "Gang War", "  Gangwar ended up with both teams wiped out!", "  Can nobody stop this meaningless violence?"));
    } else if (!mineAlive) {
      result = "lost";
      out.push("", RED + "Loser!", T + "You have ruined it all...", T + "Where are all the grandiose plans of which you", T + "spoke? I can only see dead bodies and death staring",
        T + "at your miserable team of adventurers. You promised", T + "them victory but the only gain was pain and misery...", "", T + "Darkness...");
      const a = pick(["eliminated", "exterminated", "massacred", "wiped out"]);
      c.later.push(() => news(db, c.t, "Gang War", " " + TC + p.team + T + " was " + a + "."));
    } else if (p.hps < 1) {
      result = "aborted";
      out.push("", T + (mates.length ? "Gang attack aborted due to death of leader!" : "Gang attack failure!"),
        T + (mates.length ? "As you fall to the ground, the morale within your ranks drops....maybe next time..." : "You fall to the ground...slain by your foes!"));
      c.later.push(() => news(db, c.t, "Gang War", "  Gang attack halted when " + PLY + p.name + T + " was killed!", "  The attack was repelled!"));
    } else if (!foesAlive) {
      result = "won";
      out.push("", GOLD + "Gang triumph!", "", T + "You are tired but also pleased with your victory!", T + "The bloody battle is over...");
      if (turfgo) {
        await db.prepare("UPDATE usurper_teams SET turf = (name = ?), turf_day = ?").bind(p.team, today()).run();
        out.push(T + "The town is yours! The businessmen will pay " + TC + p.team + T + " from now on.");
        c.later.push(() => news(db, c.t, "Gang Takeover!", " " + TC + p.team + T + " took over the town!", " " + TC + oppo + T + " was defeated in a bloody gangwar.", " " + PLY + p.name + T + " led the attack."));
      } else c.later.push(() => news(db, c.t, "Gang War", " " + TC + p.team + T + " defeated " + TC + oppo + T + "!", " " + PLY + p.name + T + " led the attack."));
      await db.prepare("UPDATE usurper_teams SET wins = wins + 1 WHERE name = ?").bind(p.team).run();
      await db.prepare("UPDATE usurper_teams SET losses = losses + 1 WHERE name = ?").bind(oppo).run();
    }
  }
  for (const q of [...mates, ...foes]) await save(db, q, c.t);
  if (p.hps < 1) { p.hps = 0; p.allowed = false; p.gold = 0; out.push("", T + "Darkness..."); }
}

// ---------------------------------------------------------------- the throne (CHALLENG.PAS + CHALLKNG.PAS)
async function crown(p, c, k, how, oldKing) {
  const day = today();
  if (k.id) await c.db.prepare("UPDATE usurper_monarchs SET ended = ?, days = ?, how = ? WHERE ended IS NULL").bind(day, k.days, how).run();
  for (const g of k.guards) c.later.push(() => mail(c.db, c.t, g.id, "Sacked!", "The " + kingString(k.sex) + " is gone, and so is your job in the Royal Guard."));
  const n = newKing();
  Object.assign(n, { name: p.name, id: p.id, sex: p.sex, race: p.race });
  await saveKing(c, n);
  await c.db.prepare("INSERT INTO usurper_monarchs (user_id, name, sex, race, crowned) VALUES (?, ?, ?, ?, ?)").bind(p.id, p.name, p.sex, p.race, day).run();
  if (oldKing) { oldKing.king = false; await save(c.db, oldKing, c.t); }
  p.king = true;
  return n;
}
function duelSnapshot(v) { const s = snapshot(v); s.hps = v.hps > 0 ? v.hps : v.maxhps; return s; }
function startDuel(p, v, kind, out) {
  p.ward = 0;
  p.fight = { mode: "pvp", kind, foe: duelSnapshot(v), toDeath: false, gnollp: 0, loc: v.location };
  out.push("", HEAD + (kind === "throne" ? "Royal Duel!!" : "Fight!!"), "");
}
function moatFight(p, k) {
  const m = MOAT[k.moat] || MOAT[0];
  const mons = [];
  for (let i = 0; i < Math.min(k.moatNr, MAX_MON); i++) mons.push({ name: m[0], str: m[4], hps: m[2], max: m[2], def: 0, ml: 1, mana: 0, spells: 0, ph: "Grrrr..", res: 0, poisoned: false, hold: 0 });
  p.fight = { mode: "dng", purpose: "moat", dl: Math.min(100, p.level), mons, toDeath: false };
}
// The siege: moat, then each royal guard, then the ruler. Called to start and after every stage.
async function siegeStep(p, c, out) {
  const s = p.siege;
  if (!s) return;
  const k = await loadKing(c);
  if (!k.id || k.id !== s.kingId) { p.siege = null; out.push(T + "The throne has changed hands while you were busy. You head back to town."); return; }
  if (s.stage === "moat") {
    out.push(WHITE + "You must swim across the moat to enter the secret passage.");
    if (k.moatNr > 0) {
      const m = MOAT[k.moat] || MOAT[0];
      out.push(T + "You encounter " + WHITE + cs(k.moatNr) + " " + TALK + m[0] + (k.moatNr > 1 ? "s" : "") + T + " in the moat!" + RED + "  FIGHT!");
      moatFight(p, k);
      return;
    }
    out.push(WHITE + "Phew! You weren't attacked in the water. Lax security around here!");
    s.stage = "guards"; s.guards = k.guards.map(g => g.id);
  }
  if (s.stage === "guards") {
    out.push("", T + "Suddenly you hear soldiers approaching...");
    while (s.guards.length) {
      const gid = s.guards.shift();
      const g = await loadOther(c, gid);
      if (!g) continue;
      if (g.location === LOC.prison || g.hps < 1 || g.allowed === false) {
        const why = g.location === LOC.prison ? "IN PRISON" : "DEAD";
        c.later.push(() => mail(c.db, c.t, k.id, "FAILED DUTY", "The royal guard " + g.name + " was " + why + " when the Castle was attacked!"));
        c.later.push(() => mail(c.db, c.t, g.id, "Castle Infiltrated!", p.name + " infiltrated the Castle!", "You were " + why + " at the time and unable to defend the Royals!"));
        continue;
      }
      out.push(PLY + g.name + T + ", member of the Royal Guard, blocks your way!", TALK + "Halt! Nobody gets past me!");
      startDuel(p, g, "guard", out);
      return;
    }
    s.stage = "king";
  }
  if (s.stage === "king") {
    const kp = await loadOther(c, k.id);
    if (!kp) { await crown(p, c, k, "vanished", null); p.siege = null; out.push(GOLD + "The Castle is empty. The Crown is yours!"); return; }
    if (kp.hps < 1) kp.hps = kp.maxhps;    // USURPER.CFG line 149: the dead ruler rises to defend the Castle
    out.push("", T + "You enter the Throne Room...", T + "The " + raceLow(kp.race) + " " + KC + kp.name + T + " rises from the throne!",
      TALK + "So you want my Crown? Come and take it, peasant!");
    startDuel(p, kp, "throne", out);
  }
}
// After a won duel in the Castle (or at the prison gate).
async function siegeDuelWon(p, f, c, out) {
  const foe = f.foe, v = await loadOther(c, foe.id);
  const x = (random(50) + 250) * foe.level;
  p.exp += x; p.pkills++;
  out.push("", T + "Victory!", T + "You have defeated " + PLY + foe.name + T + "!", T + "You receive " + WHITE + cs(x) + T + " experience points!");
  if (v) { v.hps = 0; v.pdefeats++; await save(c.db, v, c.t); }
  await collectBounty(c, p, foe, out);
  p.fight = null;
  if (f.kind === "guard") {
    c.later.push(() => mail(c.db, c.t, foe.id, "Defeated!", p.name + " stormed the Castle and cut you down while you were on Royal Guard duty!"));
    return siegeStep(p, c, out);
  }
  if (f.kind === "pguard") {   // a royal guard at the prison gate, then the prison guards
    c.later.push(() => mail(c.db, c.t, foe.id, "Defeated!", p.name + " beat you at the prison gate while you were on guard!"));
    return prisonGuards(p, c, out);
  }
  // the throne
  const k = await loadKing(c);
  const s1 = kingString(foe.sex);
  await crown(p, c, k, "usurped", v);
  p.siege = null;
  const s = kingString(p.sex).toUpperCase();
  out.push("", GOLD + "Congratulations, The Castle is Yours!", T + "The " + s1 + " is dead, long live the " + kingString(p.sex) + "!");
  c.later.push(() => news(c.db, c.t, "NEW " + s + "! --- NEW " + s + "! --- NEW " + s + "! --- NEW " + s + "!", " " + PLY + p.name + T + " usurped the throne!",
    " " + s1 + " " + KC + foe.name + T + " was defeated after a duel in the Castle!", " The Royal Forces have sworn allegiance to " + KC + p.name + T + ".",
    " May the Kingdom prosper under the new Reign!"));
  c.later.push(() => mail(c.db, c.t, foe.id, "Dethroned!", p.name + " infiltrated the Castle and defeated you in the Throne Room!", "You are no longer " + s1 + "."));
}
async function siegeDuelLost(p, f, c, out) {
  const foe = f.foe, v = await loadOther(c, foe.id);
  out.push("", T + "With your last strength you try a blow against your foe,", T + "but in vain! You have lost the fight!");
  if (v) { v.exp += (random(50) + 250) * p.level; v.pkills++; await save(c.db, v, c.t); }
  const where = f.kind === "pguard" ? "at the prison gate" : f.kind === "guard" ? "in the Castle" : "in the Throne Room";
  c.later.push(() => mail(c.db, c.t, foe.id, "Victory!", p.name + " attacked you " + where + ", but you won the fight!"));
  if (f.kind === "throne") c.later.push(() => news(c.db, c.t, "Royal Duel", " " + PLY + p.name + T + " tried to usurp the throne,", " but " + kingString(foe.sex) + " " + KC + foe.name + T + " killed the pretender!"));
  else if (f.kind === "guard") c.later.push(() => news(c.db, c.t, "Castle Attacked", " " + PLY + p.name + T + " infiltrated the Castle,", " but the Royal Guard " + PLY + foe.name + T + " cut " + him(p) + " down!"));
  else c.later.push(() => news(c.db, c.t, "Prison", " " + PLY + p.name + T + " was killed in an attempt to break into the prison."));
  p.gold = 0; p.hps = 0; p.allowed = false; p.pdefeats++; p.fight = null; p.siege = null;
  out.push("", T + "Darkness...");
}

// ---------------------------------------------------------------- prison break (PRISONF.PAS)
async function prisonGuards(p, c, out) {
  const s = p.siege;
  out.push("", T + "You must get pass the guards, and not only that!", T + "You must also get the cell-keys from the guard-captain.");
  const foes = random(3) + 1, mons = [];
  for (let i = 1; i <= foes; i++) {
    const name = i === 1 ? "Guard-Captain" : pick(["Prison-Guard", "Guard", "Torture-Master"]);
    let hps = p.level * 4; if (i === 1) hps *= 2;
    mons.push({ name, str: p.str * 2, hps, max: hps, def: Math.round(p.def / 2), ml: 1, mana: 0, spells: 0, ph: "Seize the intruder!", res: 0, poisoned: false, hold: 0, wpow: p.level + 1 });
  }
  s.stage = "gate";
  p.fight = { mode: "dng", purpose: "prisonbreak", dl: Math.min(100, p.level), mons, toDeath: false };
  out.push("", MON + mons[0].name + T + ": " + TALK + "Seize the intruder!");
}

// A special monster fight ended (moat, prison gate or royal quest). how = won | died | fled | begged
async function purposeDone(p, f, c, out, how) {
  p.monk = false;
  if (f.purpose === "moat") {
    const k = await loadKing(c);
    const left = how === "won" ? 0 : f.mons.filter(m => m.hps > 0).length;
    const name = (MOAT[k.moat] || MOAT[0])[0];
    k.moatNr = Math.min(k.moatNr, left); await saveKing(c, k);
    if (how === "died") {
      c.later.push(() => mail(c.db, c.t, k.id, "The Moat", p.name + " swam across the Moat!", p.name + " was killed by your " + name + "s."));
      c.later.push(() => news(c.db, c.t, "Fatal Swim", " " + PLY + p.name + T + " swam across the Moat.", " Some " + TALK + name + "s" + T + " had " + PLY + p.name + T + " for lunch."));
      out.push(RED + "Idiot! You couldn't even make it across the Moat!");
      p.siege = null;
      return;
    }
    if (how !== "won") { p.siege = null; out.push(T + "You swim back to the shore, soaking wet and humiliated."); return; }
    c.later.push(() => mail(c.db, c.t, k.id, "The Moat", p.name + " swam across the Moat!", p.name + " killed your " + name + "s!"));
    c.later.push(() => news(c.db, c.t, "Swimmer", " " + PLY + p.name + T + " swam across the Moat.", " Some " + TALK + name + "s" + T + " attacked " + PLY + p.name + T + "!", " " + PLY + p.name + T + " massacred the " + TALK + name + "s" + T + "."));
    out.push("", GOLD + "Good Work! You have safely made it to the Secret Passage!");
    p.siege.stage = "guards"; p.siege.guards = k.guards.map(g => g.id);
    return;
  }
  if (f.purpose === "prisonbreak") {
    const pr = p.siege && await loadOther(c, p.siege.prisoner);
    p.siege = null;
    if (how === "begged") {
      out.push(WHITE + "YOU COWARD!", WHITE + "You are dragged to a Cell where you await your sentence.");
      p.location = LOC.prison; p.prisonDays = 1;
      c.later.push(() => news(c.db, c.t, "Prison", " " + PLY + p.name + T + " was seized after an attempt to free " + PLY + (pr ? pr.name : "a prisoner") + T + " from prison.",
        " " + RED + p.name + T + " surrendered to the Guards and was jailed.", " The Royal Justice will deal with this outlaw."));
      return "jailed";
    }
    if (how === "died") {
      c.later.push(() => news(c.db, c.t, "Prison", " " + PLY + p.name + T + " was killed in an attempt to free " + PLY + (pr ? pr.name : "a prisoner") + T + " from prison."));
      if (pr) c.later.push(() => mail(c.db, c.t, pr.id, "Helping Hand", p.name + " was killed in an attempt to free You from prison."));
      return;
    }
    if (how !== "won") { out.push(T + "You run for it and disappear in the crowd."); return; }
    if (pr && pr.location === LOC.prison) {
      pr.location = LOC.dorm; pr.prisonDays = 0; await save(c.db, pr, c.t);
      out.push("", GOLD + "You grab the keys and unlock the cell!", PLY + pr.name + T + " is FREE!");
      c.later.push(() => mail(c.db, c.t, pr.id, "Freedom!", p.name + " broke into the prison and set you free!"));
      c.later.push(() => news(c.db, c.t, "Prison Break!", " " + PLY + p.name + T + " broke into the Royal Prison", " and set " + PLY + pr.name + T + " free!"));
      const k = await loadKing(c);
      if (k.id) c.later.push(() => mail(c.db, c.t, k.id, "Prison Break!", p.name + " broke into the prison and freed " + pr.name + "!"));
    } else out.push(T + "The cell is empty. Somebody beat you to it.");
    return;
  }
  if (f.purpose === "quest") {
    const r = await c.db.prepare("SELECT data FROM usurper_quests WHERE id = ?").bind(f.questId).first();
    const q = r ? JSON.parse(r.data) : null;
    if (!q) return;
    if (how === "died") {
      const amt = questAmount(q.ptype, q.penalty, p, true);
      out.push(RED + "QUEST FAILED!");
      if (q.ptype === 0) out.push(RED + "At least there was no Penalty for failing this Quest!");
      else { applyQuest(p, q.ptype, -amt); out.push(T + "The PENALTY for failing the Quest is " + WHITE + cs(amt) + T + " " + QREWARD[q.ptype] + "!"); }
      c.later.push(() => news(c.db, c.t, "Failed Quest", " " + PLY + p.name + T + " died on a " + HI + "Quest" + T + " in the mountains."));
      await c.db.prepare("UPDATE usurper_quests SET done = 2 WHERE id = ?").bind(f.questId).run();
      return;
    }
    if (how !== "won") { out.push(T + "You retreat. The Quest is still yours, for now."); return; }
    const amt = questAmount(q.rtype, q.reward, p, false);
    p.royquests = (p.royquests || 0) + 1; p.questsToday = (p.questsToday || 0) + 1;
    out.push("", GOLD + "QUEST COMPLETED!");
    if (q.rtype === 0) out.push(RED + "There was no Reward for this Quest!", T + "You feel extremely disappointed as you head home...");
    else { applyQuest(p, q.rtype, amt); out.push(T + "The REWARD for this Quest is " + WHITE + cs(amt) + T + " " + QREWARD[q.rtype] + "!"); }
    out.push(T + "Congratulations! You have now completed " + WHITE + cs(p.royquests) + T + " Quests in your career.");
    await c.db.prepare("UPDATE usurper_quests SET done = 1 WHERE id = ?").bind(f.questId).run();
    c.later.push(() => news(c.db, c.t, "Successful Quest!", " " + PLY + p.name + T + " completed a " + HI + "Quest" + T + " in the mountains.", " " + PLY + p.name + T + " returned home and received a " + WHITE + "reward" + T + "."));
    if (q.by) c.later.push(() => mail(c.db, c.t, q.by, "Quest Completed", p.name + " completed your Quest.", "Reward: " + (q.rtype ? cs(amt) + " " + QREWARD[q.rtype] : "nothing") + "."));
  }
}
// PLYQUEST.PAS reward and penalty sizes (1 = low, 2 = medium, 3 = high)
function questAmount(type, size, p, penalty) {
  const i = Math.max(1, Math.min(3, size || 1)) - 1;
  if (type === 1) return p.level * (penalty ? [25, 100, 300] : [100, 500, 1000])[i];
  if (type === 2) return p.level * (penalty ? [3000, 5000, 25000] : [1100, 5100, 11000])[i];
  if (type === 3) return [50, 100, 200][i];
  if (type === 4 || type === 5) return [25, 75, 110][i];
  return 0;
}
function applyQuest(p, type, v) {
  if (type === 1) p.exp = Math.max(0, p.exp + v);
  else if (type === 2) p.gold = Math.max(0, p.gold + v);
  else if (type === 3) p.healing = Math.max(0, Math.min(CFG.maxHeals * 4, p.healing + v));
  else if (type === 4) p.dark = Math.max(0, p.dark + Math.abs(v));
  else if (type === 5) p.chiv = Math.max(0, p.chiv + Math.abs(v));
}
// KMAINT.PAS: difficulty decides how many monsters, and from which part of the monster file
function questMonsters(d) {
  const counts = [1, 3, 4, 6, 7, 9, 10, 12, 14, 17];
  d = Math.max(1, Math.min(10, d));
  const lo = (d - 1) * 100 + 1, hi = d === 10 ? 999 : d * 100, list = [];
  for (let i = 0; i < Math.min(counts[d - 1], MAX_MON); i++) {
    const x = random(hi - lo + 1) + lo;
    const have = list.find(e => e[0] === x);
    if (have) have[1]++; else list.push([x, 1]);
  }
  return list;
}

// ---------------------------------------------------------------- the commands
async function realmAction(action, body, p, c, ctx, out, finish) {
  const db = c.db, t = c.t;
  const noFight = () => { if (p.fight) ctx.fail("You are in the middle of a fight!"); };
  switch (action) {
    case "realm/find": {   // name search used by the screens that ask "who?"
      const list = await findPlayer(db, body.name, body.self ? 0 : p.id);
      return finish(p, { found: list.map(q => ({ id: q.id, name: q.name, level: q.level, race: RACES[q.race], cls: CLASSES[q.cls], team: q.team || "", prison: q.location === LOC.prison, king: !!q.king })) });
    }
    // ---- the Team Corner (TCORNER.PAS)
    case "team/info": {
      const online = await onlineIds(db);
      const team = p.team ? await db.prepare("SELECT name, turf, wins, losses FROM usurper_teams WHERE name = ?").bind(p.team).first() : null;
      if (p.team && !team) p.team = "";
      const members = (await teamMembers(db, p.team)).map(q => memberView(q, online));
      const ranks = (await db.prepare(
        "SELECT p.team name, COUNT(*) members, SUM(json_extract(p.data, '$.maxhps') + p.level * 10) score, t.turf turf, t.wins wins, t.losses losses " +
        "FROM usurper_players p JOIN usurper_teams t ON t.name = p.team GROUP BY p.team ORDER BY score DESC LIMIT 20").all()).results;
      return finish(p, { team, members, ranks });
    }
    case "team/create": {
      if (p.king) ctx.fail("The " + kingString(p.sex).toUpperCase() + " may not create a team!");
      if (p.team) ctx.fail("You are already a member of " + p.team + "!");
      const name = clean(body.name, 25), pw = String(body.pw || "");
      if (name.length < 3) ctx.fail("Teamname must contain at least 3 letters.");
      if (pw.length < 3 || pw.length > 10) ctx.fail("Password too short.");
      if (await db.prepare("SELECT name FROM usurper_teams WHERE name = ?").bind(name).first()) ctx.fail("Sorry, but this teamname already exists!");
      if (await isGuard(c, p.id)) ctx.fail("Quit your Royal Guard job first!");
      await db.prepare("INSERT INTO usurper_teams (name, pw, founder, created) VALUES (?, ?, ?, ?)").bind(name, await teamHash(name, pw), p.id, t).run();
      p.team = name;
      out.push("", GOLD + "Congratulations!", TC + name + T + " has been created by you!", T + "Hopefully your new team will be victorious in many battles to come.",
        T + "(Remember that a team can have a maximum of " + CFG.maxTeam + " members)");
      c.later.push(() => news(db, t, "New Team Created!", " " + PLY + p.name + T + " created " + TC + name + T + "."));
      return finish(p);
    }
    case "team/join": {
      if (p.king) ctx.fail("The " + kingString(p.sex).toUpperCase() + " may not join any team!");
      if (p.team) ctx.fail("You are already a member of " + p.team + "!");
      if (await isGuard(c, p.id)) ctx.fail("Quit your Royal Guard job first!");
      const tm = await db.prepare("SELECT * FROM usurper_teams WHERE name = ?").bind(clean(body.name, 25)).first();
      if (!tm) ctx.fail("There is no such team.");
      const members = await teamMembers(db, tm.name);
      if (members.length >= CFG.maxTeam) {
        out.push(RED + "Sorry, this team is full!");
        for (const m of members) c.later.push(() => mail(db, t, m.id, "Turned down", p.name + " the " + CLASSES[p.cls] + " attempted to join your team.", "The attempt failed since your team is full!"));
        return finish(p);
      }
      if ((await teamHash(tm.name, String(body.pw || ""))) !== tm.pw) {
        out.push(RED + "Wrong password!");
        for (const m of members) c.later.push(() => mail(db, t, m.id, "Intruder", p.name + " the " + CLASSES[p.cls] + " entered the wrong password", "required to join your team."));
        return finish(p);
      }
      p.team = tm.name;
      out.push(T + "Correct! you are now a member of " + TC + tm.name + T + "!");
      for (const m of members) c.later.push(() => mail(db, t, m.id, "Team", p.name + " joined the Team!"));
      c.later.push(() => news(db, t, "New Gang Member!", " " + PLY + p.name + T + " joined " + TC + tm.name + T + "."));
      return finish(p);
    }
    case "team/apply": {
      if (p.team) ctx.fail("You are already a member of the " + p.team + " crew!");
      const tm = await db.prepare("SELECT name FROM usurper_teams WHERE name = ?").bind(clean(body.name, 25)).first();
      if (!tm) ctx.fail("There is no such team.");
      for (const m of await teamMembers(db, tm.name)) c.later.push(() => mail(db, t, m.id, "Application", p.name + " the " + RACES[p.race] + " " + CLASSES[p.cls] + " (level " + p.level + ")", "applied for membership in your team.", "Give " + him(p) + " the password if you want " + him(p) + "."));
      out.push(T + "Informing " + TC + tm.name + T + " crew..." + WHITE + "done.", T + "They will get back to you.");
      return finish(p);
    }
    case "team/quit": {
      if (!p.team) ctx.fail("You don't belong to a team.");
      const old = p.team;
      p.team = "";
      out.push(WHITE + "You have left the Team!");
      c.later.push(() => news(db, t, "Gang Deserter!", " " + PLY + p.name + T + " the " + CLASSES[p.cls] + " left " + TC + old + T + "."));
      for (const m of await teamMembers(db, old)) if (m.id !== p.id) c.later.push(() => mail(db, t, m.id, "Team", p.name + " left the Team!"));
      c.later.push(async () => { const r = await db.prepare("SELECT COUNT(*) n FROM usurper_players WHERE team = ?").bind(old).first(); if (!r.n) await db.prepare("DELETE FROM usurper_teams WHERE name = ?").bind(old).run(); });
      return finish(p);
    }
    case "team/pw": {
      if (!p.team) ctx.fail("You don't belong to a team.");
      const tm = await db.prepare("SELECT * FROM usurper_teams WHERE name = ?").bind(p.team).first();
      if ((await teamHash(tm.name, String(body.old || ""))) !== tm.pw) ctx.fail("Wrong password!");
      const pw = String(body.pw || "");
      if (pw.length < 3 || pw.length > 10) ctx.fail("Password too short.");
      await db.prepare("UPDATE usurper_teams SET pw = ? WHERE name = ?").bind(await teamHash(tm.name, pw), tm.name).run();
      out.push(WHITE + "Password successfully changed!");
      for (const m of await teamMembers(db, p.team)) if (m.id !== p.id) c.later.push(() => mail(db, t, m.id, "Team-Info", p.name + " changed the Team password."));
      return finish(p);
    }
    case "team/sack": {
      if (!p.team) ctx.fail("You don't belong to a team.");
      const v = await loadOther(c, Math.trunc(+body.id));
      if (!v || v.team !== p.team || v.id === p.id) ctx.fail("That's not one of your teammates.");
      v.team = ""; await save(db, v, t);
      out.push(PLY + v.name + T + " has been thrown out of the team!");
      c.later.push(() => mail(db, t, v.id, "Sacked!", p.name + " threw you out of " + p.team + "!"));
      c.later.push(() => news(db, t, "Gang Member Sacked!", " " + PLY + v.name + T + " was thrown out of " + TC + p.team + T + " by " + PLY + p.name + T + "."));
      return finish(p);
    }
    case "team/msg": {
      if (!p.team) ctx.fail("You don't belong to a team.");
      const text = clean(body.text, 240);
      if (!text) ctx.fail("Write something.");
      let n = 0;
      for (const m of await teamMembers(db, p.team)) if (m.id !== p.id) { n++; c.later.push(() => mail(db, t, m.id, "Message from " + p.name, text)); }
      out.push(T + "Message sent to " + WHITE + n + T + " teammate" + (n === 1 ? "" : "s") + ".");
      return finish(p);
    }
    case "team/examine": {
      const v = await loadOther(c, Math.trunc(+body.id));
      if (!v || !p.team || v.team !== p.team) ctx.fail("You can only examine your own teammates.");
      return finish(p, { member: view(v) });
    }

    // ---- gang wars and town control (CHALLENG.PAS)
    case "gang/war": {
      noFight();
      await gangWar(p, c, clean(body.team, 25), !!body.turf, out);
      return finish(p, { dead: p.hps < 1 });
    }
    case "gang/flee": {
      if (!p.team) ctx.fail("You don't belong to a team!");
      const tm = await db.prepare("SELECT turf FROM usurper_teams WHERE name = ?").bind(p.team).first();
      if (!tm || !tm.turf) ctx.fail("Your team doesn't control the town.");
      await db.prepare("UPDATE usurper_teams SET turf = 0 WHERE name = ?").bind(p.team).run();
      out.push(T + "You publicly announce your team's withdrawal from town control.", T + "The big question now is : Who's gonna take over!?");
      c.later.push(() => news(db, t, "Team withdrawal from Town Control!", " " + PLY + p.name + T + " decided to remove " + his(p) + " team from Town Control."));
      return finish(p);
    }

    // ---- outside the Castle (CHALLENG.PAS)
    case "castle/info": {
      const k = await loadKing(c);
      const online = await onlineIds(db);
      const guards = [];
      for (const g of k.guards) { const v = parse(await loadRow(db, g.id)); if (v) guards.push({ ...memberView(v, online), pay: g.pay }); }
      const prisoners = (await db.prepare("SELECT COUNT(*) n FROM usurper_players WHERE location = ?").bind(LOC.prison).first()).n;
      const info = { name: k.name, id: k.id, sex: k.sex, race: k.id ? RACES[k.race] : "", days: k.days, tax: k.tax, taxAlign: k.taxAlign, guards, prisoners,
        isKing: !!(k.id && k.id === p.id), isGuard: k.guards.some(g => g.id === p.id), kingOnline: !!(k.id && online.has(k.id)), minLevel: CFG.kingLevel };
      if (info.isKing) Object.assign(info, { treasury: k.treasury, moat: k.moatNr ? (MOAT[k.moat] || MOAT[0])[0] : null, moatNr: k.moatNr, moatType: k.moat, prisonsLeft: k.prisonsLeft,
        executeLeft: k.executeLeft, questsLeft: k.questsLeft, apps: k.apps, moatList: MOAT.map(m => ({ name: m[0], cost: m[1], hps: m[2], armor: m[3], attack: m[4] })) });
      // a ruler who lost the crown while asleep finds out here
      if (p.king && k.id !== p.id) p.king = false;
      return finish(p, { castle: info });
    }
    case "castle/donate": {
      if (p.king) ctx.fail("Donate from inside the Castle instead!");
      const x = Math.trunc(+body.amount);
      if (!(x > 0)) { out.push(RED + "Grr! Get out of here!"); return finish(p); }
      if (x > p.gold) ctx.fail("You don't have that much.");
      const k = await loadKing(c);
      if (!k.id) ctx.fail("There is nobody on the throne to give it to.");
      if (k.treasury + x > 2e9) ctx.fail("The Royal Purse can not accept such an amount!");
      p.gold -= x; k.treasury += x; await saveKing(c, k);
      p.chiv += Math.min(50, Math.floor(x / 1000));
      out.push(T + "Your donation has been recorded.", T + kingString(k.sex) + " " + KC + k.name + T + " has been informed.");
      c.later.push(() => news(db, t, "Glory " + (p.sex === 2 ? "Girl" : "Boy"), " " + PLY + p.name + T + " donated " + GOLD + cs(x) + T + " " + money(x) + " to the Royal Purse!", " The Royal Family is grateful."));
      c.later.push(() => mail(db, t, k.id, "Gold Donor", p.name + " donated " + cs(x) + " " + money(x) + " to the Royal Purse!"));
      return finish(p);
    }
    case "castle/guard": {
      const k = await loadKing(c);
      if (body.op === "quit") {
        const i = k.guards.findIndex(g => g.id === p.id);
        if (i < 0) ctx.fail("You are not in the Royal Guard.");
        k.guards.splice(i, 1); await saveKing(c, k);
        out.push(T + "You hand in your sword and your uniform.", T + "You are no longer a member of the Royal Guard.");
        c.later.push(() => news(db, t, "Royal Guard", " " + PLY + p.name + T + " quit the " + TALK + "Royal Guard" + T + "."));
        c.later.push(() => mail(db, t, k.id, "Guard Quit", p.name + " has left the Royal Guard."));
        return finish(p);
      }
      // apply for guard duty
      if (!k.id) ctx.fail("Sorry, the Kingdom is without a King! We desperately need a leader, perhaps you could...");
      if (k.id === p.id) ctx.fail("You ARE the " + kingString(p.sex) + "!");
      if (p.team) ctx.fail("Royal Guards can't belong to a gang. Quit your team first.");
      if (k.guards.some(g => g.id === p.id)) ctx.fail("You are already in the Royal Guard.");
      if (k.guards.length >= CFG.kingGuards) ctx.fail("The Clerk at the desk informs you that the Royals are in no need of Guards at the present moment.");
      const pay = Math.max(0, Math.min(50000000, Math.trunc(+body.pay) || 0));
      k.apps = k.apps.filter(a => a.id !== p.id);
      k.apps.push({ id: p.id, name: p.name, pay, level: p.level, cls: CLASSES[p.cls], sex: p.sex });
      await saveKing(c, k);
      out.push(WHITE + "Done.", WHITE + "The Royal Office will put this request before the " + kingString(k.sex) + ".");
      c.later.push(() => news(db, t, "Applicant", " " + PLY + p.name + T + ", the " + RACES[p.race] + ", applied for a job at the " + TALK + "Royal Guard" + T + "."));
      c.later.push(() => mail(db, t, k.id, "Guard Application", p.name + " (level " + p.level + " " + CLASSES[p.cls] + ") wants to join the Royal Guard", "for a daily salary of " + cs(pay) + " gold. See Check Security in the Castle."));
      return finish(p);
    }
    case "castle/infiltrate": {
      noFight();
      const k = await loadKing(c);
      if (p.king && k.id === p.id) ctx.fail("It's your Castle!");
      if (p.level < CFG.kingLevel) ctx.fail("NO WAY! You must be at least a level " + CFG.kingLevel + " character!");
      if (p.team) ctx.fail("Quit your team first! If you're going up against the Royals you must be alone, not representing any other interest than yourself.");
      if (k.guards.some(g => g.id === p.id)) ctx.fail("Quit your Royal Guard job first!");
      if (!k.id) {
        if (!body.proclaim) return finish(p, { empty: true });
        await crown(p, c, k, "", null);
        const s = kingString(p.sex).toUpperCase();
        out.push("", GOLD + "Congratulations, The Castle is Yours!", T + "The InterRegnum is over, long live the " + s + "!");
        c.later.push(() => news(db, t, "NEW " + s + "! --- NEW " + s + "! --- NEW " + s + "! --- NEW " + s + "!", " " + KC + p.name + T + " usurped the throne today!", " May the new rulers reign be long and prosperous!"));
        return finish(p, { crowned: true });
      }
      if ((await onlineIds(db)).has(k.id)) { out.push(WHITE + "The " + kingString(k.sex) + " is online minding " + (k.sex === 2 ? "her" : "his") + " business.", RED + "Sorry, try again later!"); return finish(p); }
      if (!body.go) return finish(p, { confirm: true, king: k.name, kingSex: k.sex });
      out.push(GOLD + "You want the Crown...");
      p.siege = { stage: "moat", kingId: k.id, guards: [] };
      await siegeStep(p, c, out);
      return finish(p, { dead: p.hps < 1 });
    }
    case "castle/siege": {
      noFight();
      if (!p.siege || p.siege.stage === "gate") ctx.fail("You aren't storming anything.");
      if (body.abort) { p.siege = null; out.push(T + "You give up and sneak back to town."); return finish(p); }
      await siegeStep(p, c, out);
      return finish(p, { dead: p.hps < 1 });
    }
    case "monarchs": {
      const rows = (await db.prepare("SELECT name, sex, race, crowned, ended, days, how FROM usurper_monarchs ORDER BY id DESC LIMIT 30").all()).results;
      return finish(p, { monarchs: rows.map(r => ({ ...r, race: RACES[r.race] })) });
    }

    // ---- inside the Castle: the ruler (CASTLE.PAS)
    case "king/tax": case "king/treasury": case "king/moat": case "king/guard": case "king/imprison": case "king/free":
    case "king/execute": case "king/proclaim": case "king/abdicate": case "king/sleep": case "king/quest": case "king/prisoners": case "king/relief": {
      const k = await loadKing(c);
      if (!(k.id && k.id === p.id)) { p.king = false; ctx.fail("Only the ruler may do that."); }
      const ks = kingString(p.sex);
      if (action === "king/tax") {
        const x = Math.trunc(+body.tax), al = Math.trunc(+body.align) || 0;
        if (!(x >= 0 && x <= 5)) ctx.fail("Set tax (0-5%).");
        if (x !== k.tax) {
          const line = x === 0 ? [" " + ks + " " + KC + p.name + T + " " + WHITE + "removed" + T + " the Royal Tax!", " The people are happy!"]
            : x > k.tax ? [" " + ks + " " + KC + p.name + T + " " + RED + "raised" + T + " the Royal Tax to " + x + "% !", " The people are not happy!"]
            : [" " + ks + " " + KC + p.name + T + " " + WHITE + "lowered" + T + " the Royal Tax to " + x + "% !", " The people are pleased."];
          c.later.push(() => news(db, t, "Royal Tax", ...line));
        }
        k.tax = x; k.taxAlign = x ? Math.max(0, Math.min(2, al)) : 0;
        await saveKing(c, k);
        out.push(HI + "New Tax set.", RED + "You let the Herald proclaim the new tax to the people.");
        return finish(p);
      }
      if (action === "king/treasury") {
        const x = Math.trunc(+body.amount);
        if (!(x > 0)) ctx.fail("Aborted.");
        if (body.op === "add") {
          if (x > p.gold) ctx.fail("You don't have that much.");
          p.gold -= x; k.treasury += x;
          out.push(T + "You add " + GOLD + cs(x) + T + " to the Treasury.");
        } else {
          if (x > k.treasury) ctx.fail("There isn't that much in the Treasury.");
          k.treasury -= x; p.bank += x; p.dark += Math.min(100, Math.ceil(x / 5000));
          out.push(T + "You move " + GOLD + cs(x) + T + " from the Treasury to your personal account.", RED + "Your soul darkens.");
          if (random(3) === 0) c.later.push(() => news(db, t, "Royal Scandal", " Rumours say " + ks + " " + KC + p.name + T + " has been helping " + him(p) + "self to the Royal Treasury!"));
        }
        await saveKing(c, k);
        return finish(p);
      }
      if (action === "king/moat") {
        if (body.op === "remove") { k.moatNr = 0; k.moat = null; await saveKing(c, k); out.push(T + "The moat is drained and refilled with clean water."); return finish(p); }
        const ty = Math.trunc(+body.type), n = Math.trunc(+body.n);
        if (!MOAT[ty]) ctx.fail("No such creature.");
        if (!(n > 0)) ctx.fail("Aborted.");
        if (k.moatNr > 0 && k.moat !== ty) ctx.fail("There are " + MOAT[k.moat][0] + "s in the moat. Remove them first.");
        if (k.moatNr + n > MAX_MON) ctx.fail("The moat can't hold more than " + MAX_MON + " creatures.");
        const cost = MOAT[ty][1] * n;
        if (body.fund === "T") { if (cost > k.treasury) ctx.fail("The Royal Treasury can't afford it."); k.treasury -= cost; }
        else { if (cost > p.gold) ctx.fail("You can't afford it."); p.gold -= cost; }
        k.moat = ty; k.moatNr += n;
        await saveKing(c, k);
        out.push(T + "You add " + WHITE + n + " " + TALK + MOAT[ty][0] + (n > 1 ? "s" : "") + T + " to the moat. (" + GOLD + cs(cost) + T + " gold)");
        return finish(p);
      }
      if (action === "king/guard") {
        if (body.op === "hire" || body.op === "reject") {
          const a = k.apps.find(x => x.id === Math.trunc(+body.id));
          if (!a) ctx.fail("No such application.");
          k.apps = k.apps.filter(x => x.id !== a.id);
          if (body.op === "hire") {
            if (k.guards.length >= CFG.kingGuards) ctx.fail("The Royal Guard is full. Sack somebody first.");
            const v = await loadOther(c, a.id);
            if (!v || v.team) { await saveKing(c, k); ctx.fail("That applicant can no longer serve."); }
            k.guards.push({ id: a.id, name: a.name, pay: a.pay });
            out.push(PLY + a.name + T + " joins the Royal Guard.");
            c.later.push(() => mail(db, t, a.id, "Royal Employment", ks + " " + p.name + " has ACCEPTED your application!", "To Protect and Serve is our motto! Salary: " + cs(a.pay) + " a day."));
            c.later.push(() => news(db, t, "Royal Employment", " " + PLY + a.name + T + " became a " + TALK + "Royal Guard" + T + "!"));
          } else {
            out.push(T + "Application rejected.");
            c.later.push(() => mail(db, t, a.id, "Application Rejected", ks + " " + p.name + " turned down your application to the Royal Guard."));
          }
        } else if (body.op === "sack") {
          const g = k.guards.find(x => x.id === Math.trunc(+body.id));
          if (!g) ctx.fail("No such guard.");
          k.guards = k.guards.filter(x => x !== g);
          out.push(PLY + g.name + T + " is dismissed from the Royal Guard.");
          c.later.push(() => mail(db, t, g.id, "Sacked!", ks + " " + p.name + " dismissed you from the Royal Guard."));
        }
        await saveKing(c, k);
        return finish(p);
      }
      if (action === "king/prisoners") {
        const online = await onlineIds(db);
        const rows = (await db.prepare("SELECT user_id, data FROM usurper_players WHERE location = ? ORDER BY name").bind(LOC.prison).all()).results;
        return finish(p, { prisoners: rows.map(r => { const q = parse({ user_id: r.user_id, data: r.data }); return { ...memberView(q, online), days: Math.max(1, q.prisonDays || 0) }; }) });
      }
      if (action === "king/imprison") {
        if (k.prisonsLeft < 1) ctx.fail("You have run out of prison sentences.");
        const v = await loadOther(c, Math.trunc(+body.id));
        if (!v || v.id === p.id) ctx.fail("Nobody by that name.");
        if ((await onlineIds(db)).has(v.id)) ctx.fail(v.name + " is awake! try again!");
        if (v.hps < 1) ctx.fail(v.name + " is dead.");
        if (v.location === LOC.prison) ctx.fail(v.name + " is already in prison!");
        const ch = CHARGES[String(body.charge || "N").toUpperCase()] || CHARGES.N;
        const days = Math.max(1, Math.min(CFG.kingImprisonDays, Math.trunc(+body.days) || 1));
        v.location = LOC.prison; v.prisonDays = days; v.fight = null; v.siege = null;
        await save(db, v, t);
        k.prisonsLeft--; await saveKing(c, k);
        out.push(PLY + v.name + T + " is brought before you in chains.", PLY + v.name + T + " looks at you with a surprised look on " + his(v) + " face!",
          TALK + " I'm innocent!", PLY + v.name + T + " is sent down to " + his(v) + " cell.");
        const ds = days + " " + (days > 1 ? "days" : "day");
        c.later.push(() => news(db, t, "Prisoner", " " + ks + " " + KC + p.name + T + " imprisoned " + RED + v.name + T + "!", " " + PLY + v.name + T + " " + ch[0], " " + PLY + v.name + T + " will stay in prison for " + WHITE + ds + T + "."));
        c.later.push(() => mail(db, t, v.id, "Arrested!", ks + " " + p.name + " had you imprisoned!", ch[1], "You were sentenced to " + ds + " in prison."));
        return finish(p);
      }
      if (action === "king/free" || action === "king/execute") {
        const v = await loadOther(c, Math.trunc(+body.id));
        if (!v || v.location !== LOC.prison) ctx.fail("That person isn't in prison.");
        if (action === "king/free") {
          v.location = LOC.dorm; v.prisonDays = 0; await save(db, v, t);
          out.push(PLY + v.name + T + " is released from prison.");
          c.later.push(() => mail(db, t, v.id, "Released!", ks + " " + p.name + " released you from prison!"));
          c.later.push(() => news(db, t, "Prisoner Released", " " + ks + " " + KC + p.name + T + " pardoned " + PLY + v.name + T + "."));
          return finish(p);
        }
        if (k.executeLeft < 1) ctx.fail("You have no death sentences left today.");
        if (v.hps < 1) ctx.fail(v.name + " is already dead.");
        k.executeLeft--; await saveKing(c, k);
        v.hps = 0; v.pdefeats++; await save(db, v, t);
        p.dark += 25;
        out.push(PLY + v.name + T + " is led to the scaffold...", RED + "The axe falls.", RED + "Your soul darkens.");
        c.later.push(() => news(db, t, "Execution!", " " + PLY + v.name + T + " was executed by order of " + ks + " " + KC + p.name + T + "!"));
        c.later.push(() => mail(db, t, v.id, "Executed!", ks + " " + p.name + " had you executed in your cell!"));
        return finish(p);
      }
      if (action === "king/proclaim") {
        const text = clean(body.text, 140);
        if (!text) ctx.fail("Proclaim what?");
        c.later.push(() => news(db, t, "Royal Proclamation", " " + ks + " " + KC + p.name + T + " proclaims:", " " + TALK + text));
        out.push(T + "The Herald reads your proclamation in the town square.");
        return finish(p);
      }
      if (action === "king/abdicate") {
        await db.prepare("UPDATE usurper_monarchs SET ended = ?, days = ?, how = 'abdicated' WHERE ended IS NULL").bind(today(), k.days).run();
        for (const g of k.guards) c.later.push(() => mail(db, t, g.id, "Sacked!", "The " + ks + " abdicated. The Royal Guard is dissolved."));
        await saveKing(c, newKing());
        p.king = false;
        out.push(T + "You take off the Crown and walk out of the Castle.", T + "You are a commoner again.");
        c.later.push(() => news(db, t, "Abdication!", " " + ks + " " + KC + p.name + T + " abdicated!", " The throne is empty! Who will take the Crown?"));
        return finish(p);
      }
      if (action === "king/sleep") {
        p.location = LOC.castle;
        out.push(T + "You go to sleep in the Royal bed...");
        return finish(p, { slept: true });
      }
      if (action === "king/quest") {
        if (k.questsLeft < 1) ctx.fail("You can't issue any more quests today.");
        const open = (await db.prepare("SELECT COUNT(*) n FROM usurper_quests WHERE done = 0").first()).n;
        if (open >= 100) ctx.fail("There are too many quests already.");
        const d = Math.max(1, Math.min(10, Math.trunc(+body.difficulty) || 5));
        const q = { by: p.id, byName: p.name, date: today(), difficulty: d, monsters: questMonsters(d),
          reward: Math.max(1, Math.min(3, Math.trunc(+body.reward) || 1)), rtype: Math.max(0, Math.min(5, Math.trunc(+body.rtype) || 0)),
          penalty: Math.max(1, Math.min(3, Math.trunc(+body.penalty) || 1)), ptype: Math.max(0, Math.min(5, Math.trunc(+body.ptype) || 0)),
          minlevel: Math.max(1, Math.min(100, Math.trunc(+body.minlevel) || 1)), maxlevel: Math.max(1, Math.min(100, Math.trunc(+body.maxlevel) || 100)),
          days: Math.max(1, Math.min(15, Math.trunc(+body.days) || 7)), occdays: 0, comment: clean(body.comment, 70) || "Complete this quest and be rewarded!" };
        if (q.maxlevel < q.minlevel) q.maxlevel = q.minlevel;
        await db.prepare("INSERT INTO usurper_quests (data, created) VALUES (?, ?)").bind(JSON.stringify(q), t).run();
        k.questsLeft--; await saveKing(c, k);
        out.push(T + "The Quest has been posted. Brave souls may claim it at the Challenges.");
        c.later.push(() => news(db, t, "Royal Quest", " " + ks + " " + KC + p.name + T + " issued a new " + HI + "Quest" + T + "!"));
        return finish(p);
      }
      if (action === "king/relief") ctx.fail("Unknown command.", 404);
      break;
    }

    // ---- the prison, for its guests (PRISONC.PAS)
    case "prison/info": {
      if (p.location !== LOC.prison) ctx.fail("You aren't in prison.");
      const online = await onlineIds(db);
      const rows = (await db.prepare("SELECT user_id, data FROM usurper_players WHERE location = ? AND user_id != ?").bind(LOC.prison, p.id).all()).results;
      return finish(p, { others: rows.map(r => { const q = parse({ user_id: r.user_id, data: r.data }); return { ...memberView(q, online), days: Math.max(1, q.prisonDays || 0) }; }) });
    }
    case "prison/demand": {
      if (p.location !== LOC.prison) ctx.fail("You aren't in prison.");
      out.push(HEAD + "You clear your throat : " + TALK + "Let me out of here please....!", "", T + "After a moment you hear a dark voice cry out :",
        TALK + pick(["Haha!", "Sure! Next year maybe! Haha!", "SHUT UP! OR WE WILL HURT YOU BAD!", "GIVE IT A REST IN THERE!", "Ho ho ho!"]), T + "(You will probably be released tomorrow)");
      return finish(p);
    }
    case "prison/escape": {
      if (p.location !== LOC.prison) ctx.fail("You aren't in prison.");
      if ((p.escapes ?? CFG.prisonEscapes) < 1) ctx.fail("You have no escape attempts left! Try again tomorrow.");
      p.escapes = (p.escapes ?? CFG.prisonEscapes) - 1;
      if (random(2) === 0) {
        out.push(RED + "You failed!");
        c.later.push(() => news(db, t, "Escape Attempt", " " + PLY + p.name + T + " failed to escape from Prison!"));
        return finish(p);
      }
      out.push(WHITE + "Success! You are FREE!");
      p.location = LOC.dorm; p.hps = p.maxhps; p.prisonDays = 0;
      c.later.push(() => news(db, t, "Jail-Break", " " + PLY + p.name + T + " escaped from Prison!"));
      const k = await loadKing(c);
      if (k.id) c.later.push(() => mail(db, t, k.id, "Escape!", p.name + " escaped from prison!"));
      return finish(p, { free: true });
    }
    // ---- outside: the prison gate (PRISONF.PAS)
    case "prison/list": {
      const online = await onlineIds(db);
      const rows = (await db.prepare("SELECT user_id, data FROM usurper_players WHERE location = ? ORDER BY name").bind(LOC.prison).all()).results;
      return finish(p, { prisoners: rows.map(r => { const q = parse({ user_id: r.user_id, data: r.data }); return { ...memberView(q, online), days: Math.max(1, q.prisonDays || 0) }; }) });
    }
    case "prison/free": {
      noFight();
      const pr = await loadOther(c, Math.trunc(+body.id));
      if (!pr || pr.location !== LOC.prison || pr.id === p.id) ctx.fail("That person isn't in prison.");
      if (pr.hps < 1) ctx.fail(pr.name + " is dead in " + his(pr) + " cell.");
      const k = await loadKing(c);
      if (k.id === p.id) ctx.fail("Hey! You are the " + kingString(p.sex) + "! Why would you bother with this! It's your Castle!");
      if (k.guards.some(g => g.id === p.id)) ctx.fail("You are a member of the Royal Guard! You cannot betray the Royal Family!");
      out.push(RED + "You prepare to break in!", T + "Don't get caught! You will be jailed instantly if the guards get you!", "", T + "You approach the gate...");
      p.siege = { stage: "pguard", prisoner: pr.id };
      // a royal guard may be on duty at the gate
      const online = await onlineIds(db);
      for (const g of [...k.guards].sort(() => Math.random() - 0.5)) {
        if (random(3) !== 0 || online.has(g.id)) continue;
        const gv = await loadOther(c, g.id);
        if (gv && gv.hps > 0 && gv.location !== LOC.prison && gv.allowed !== false) {
          out.push(PLY + gv.name + T + " of the Royal Guard is on duty at the gate!", TALK + "Who goes there?!");
          startDuel(p, gv, "pguard", out);
          return finish(p);
        }
      }
      await prisonGuards(p, c, out);
      return finish(p);
    }

    // ---- bounty hunting (BOUNTY.PAS)
    case "bounty/list": {
      const rows = (await db.prepare("SELECT id, target_id, target, level, by_id, by_name, anon, gold, at FROM usurper_wanted WHERE collected = 0 ORDER BY gold DESC LIMIT 50").all()).results;
      return finish(p, { wanted: rows.map(r => ({ ...r, by_name: r.anon && r.by_id !== p.id ? "An enemy" : r.by_name, mine: r.by_id === p.id })) });
    }
    case "bounty/add": {
      const n = (await db.prepare("SELECT COUNT(*) n FROM usurper_wanted WHERE collected = 0").first()).n;
      if (n >= CFG.maxPosters) ctx.fail("Sorry, but the Reward-Board is currently full. Try again later.");
      const v = await loadOther(c, Math.trunc(+body.id));
      if (!v || v.id === p.id) ctx.fail("Nobody by that name.");
      if (v.king) ctx.fail("You can't put a price on the head of the " + kingString(v.sex) + "!");
      const x = Math.trunc(+body.gold);
      if (!(x > 0)) ctx.fail("Get Real.");
      if (x > p.gold) ctx.fail("You can't afford it!");
      p.gold -= x;
      const anon = !!body.anon;
      await db.prepare("INSERT INTO usurper_wanted (target_id, target, level, by_id, by_name, anon, gold, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(v.id, v.name, v.level, p.id, p.name, anon ? 1 : 0, x, t).run();
      if (!anon) c.later.push(() => news(db, t, "Bounty", " " + PLY + v.name + T + " is wanted " + RED + "DEAD" + T + " by " + PLY + p.name + T + "!"));
      c.later.push(() => mail(db, t, v.id, "You are WANTED!", (anon ? "An enemy" : p.name) + " has set a " + cs(x) + " " + money(x) + " reward", "for your head."));
      out.push(WHITE + "OK.", T + "Let's hope that some good citizen can get this creep!");
      return finish(p);
    }
    case "bounty/clear": {
      const w = await db.prepare("SELECT * FROM usurper_wanted WHERE id = ? AND collected = 0").bind(Math.trunc(+body.id)).first();
      if (!w) ctx.fail("No such poster.");
      if (w.target_id === p.id) ctx.fail("That reward is set for YOU! FOOL!");
      if (w.by_id !== p.id) ctx.fail("That reward was not set by you!");
      await db.prepare("UPDATE usurper_wanted SET collected = 1 WHERE id = ?").bind(w.id).run();
      p.gold += w.gold;
      out.push(WHITE + "OK.", T + "You remove your poster from the board.", T + "You get your " + GOLD + cs(w.gold) + T + " " + money(w.gold) + " from the deposit.");
      return finish(p);
    }

    // ---- royal quests for the people (PLYQUEST.PAS)
    case "quests/list": {
      const rows = (await db.prepare("SELECT id, data, occupier FROM usurper_quests WHERE done = 0 AND (occupier IS NULL OR occupier = ?) ORDER BY id DESC LIMIT 40").bind(p.id).all()).results;
      return finish(p, { quests: rows.map(r => { const q = JSON.parse(r.data); return { id: r.id, mine: r.occupier === p.id, difficulty: q.difficulty, by: q.byName, date: q.date,
        reward: q.rtype ? ["low", "medium", "high"][q.reward - 1] + " " + QREWARD[q.rtype] : "nothing", penalty: q.ptype ? ["low", "medium", "high"][q.penalty - 1] + " " + QREWARD[q.ptype] : "none",
        minlevel: q.minlevel, maxlevel: q.maxlevel, days: q.days, left: Math.max(0, q.days - (q.occdays || 0)), comment: q.comment,
        monsters: q.monsters.reduce((a, m) => a + m[1], 0) }; }) });
    }
    case "quests/claim": {
      const r = await db.prepare("SELECT id, data, occupier FROM usurper_quests WHERE id = ? AND done = 0").bind(Math.trunc(+body.id)).first();
      if (!r) ctx.fail("No such quest.");
      if (r.occupier) ctx.fail(r.occupier === p.id ? "You have already claimed it." : "Somebody else has claimed that quest.");
      const q = JSON.parse(r.data);
      if (q.by === p.id) ctx.fail("You can't take your own quest.");
      if (p.level < q.minlevel || p.level > q.maxlevel) ctx.fail("You must be level " + q.minlevel + "-" + q.maxlevel + " for this quest.");
      const mine = (await db.prepare("SELECT COUNT(*) n FROM usurper_quests WHERE done = 0 AND occupier = ?").bind(p.id).first()).n;
      if (mine >= CFG.questsAtOnce) ctx.fail("You can only have " + CFG.questsAtOnce + " quests at a time.");
      q.occdays = 0;
      await db.prepare("UPDATE usurper_quests SET occupier = ?, data = ? WHERE id = ? AND occupier IS NULL").bind(p.id, JSON.stringify(q), r.id).run();
      out.push(T + "The Quest is yours. You have " + WHITE + q.days + T + " days to complete it.");
      return finish(p);
    }
    case "quests/go": {
      noFight();
      const r = await db.prepare("SELECT id, data FROM usurper_quests WHERE id = ? AND done = 0 AND occupier = ?").bind(Math.trunc(+body.id), p.id).first();
      if (!r) ctx.fail("That isn't one of your quests.");
      if ((p.questsToday || 0) >= 3) ctx.fail("You have done enough questing for one day.");
      const q = JSON.parse(r.data), mons = [];
      for (const [idx, n] of q.monsters) for (let i = 0; i < n && mons.length < MAX_MON; i++) mons.push(makeMonster(idx - 1));
      p.fight = { mode: "dng", purpose: "quest", questId: r.id, dl: Math.min(100, Math.max(1, q.difficulty * 10)), mons, toDeath: false };
      p.ward = 0;
      out.push(T + "You embark upon your journey...", RED + "You have spotted the flock of evil creatures you have been", RED + "assigned to kill!");
      return finish(p);
    }
    case "quests/drop": {
      const r = await db.prepare("SELECT id FROM usurper_quests WHERE id = ? AND done = 0 AND occupier = ?").bind(Math.trunc(+body.id), p.id).first();
      if (!r) ctx.fail("That isn't one of your quests.");
      await db.prepare("UPDATE usurper_quests SET occupier = NULL WHERE id = ?").bind(r.id).run();
      out.push(T + "You give the Quest back. Somebody braver will take it.");
      return finish(p);
    }
  }
  return null;
}
