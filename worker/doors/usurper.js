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
};
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
    "UPDATE usurper_players SET name = ?2, level = ?3, exp = ?4, location = ?5, hps = ?6, allowed = ?7, data = ?8, updated = ?9 WHERE user_id = ?1"
  ).bind(id, p.name, p.level, p.exp, p.location, p.hps, p.allowed ? 1 : 0, JSON.stringify(data), t).run();
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
  p.hps = 0;
  p.allowed = false;      // no resurrections left today (Usurper's default)
  p.mdefeats++;
  p.fight = null;
  p.ward = 0;
  out.push("", "|04You are DEAD!", T + "You lose all the gold you were carrying.", "", T + "Darkness...");
  p.gold = 0;
  ctx.later.push(() => mail(ctx.db, ctx.t, p.id, "Your Death", "You were slaughtered by a " + killer + "."));
  if (how === "coward") {
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
      return { name: q.name, race: RACES[q.race], cls: CLASSES[q.cls], level: q.level, exp: q.exp, mkills: q.mkills, pkills: q.pkills, alive: q.hps > 0, sex: q.sex };
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
  maintain(p);

  if (action === "enter") {
    const mails = (await db.prepare("SELECT id, head, body, at FROM usurper_mail WHERE to_id = ? AND seen = 0 ORDER BY id LIMIT 30").bind(p.id).all()).results;
    if (mails.length) await db.prepare("UPDATE usurper_mail SET seen = 1 WHERE to_id = ? AND id <= ?").bind(p.id, mails[mails.length - 1].id).run();
    const wasAt = p.location;
    if (!p.allowed) {
      await save(db, p, t);
      return { p: view(p), out, mail: mails, barred: true };
    }
    if (p.hps < 1) p.hps = p.maxhps;      // killed while away, but still allowed in: back on your feet
    p.location = 0;                       // everyone wakes up in town
    // A fight left hanging by a dropped carrier: dungeon fights are lost, loot defaults to taking it.
    if (p.fight && p.fight.mode === "loot") await takePurse(p, p.fight, c, true);
    p.fight = null; p.monk = false;
    return finish(p, { mail: mails, wasAt });
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
      if (cmd === "R") {
        if (random(2) === 0) { out.push(T + "You have escaped battle!", HI + "You managed to escape!"); p.fight = null; return finish(p); }
        out.push(T + "The monster won't let you escape!");
        const xx = random(f.dl * 10) + 3;
        out.push(T + "As you cowardly turn and run, you feel pain when something", T + "hits you in the back for " + cs(xx) + " points");
        p.hps -= xx;
        if (p.hps <= 0) {
          out.push(RED + "You have been slain!");
          playerDiesInDungeon(p, aliveMons(f)[0].name, out, c, "coward");
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
          return finish(p, { dead: true });
        }
        out.push(T + "You throw yourself to the ground and plead for mercy!", T + "Your foe doesn't seem to care", T + "about whether you live or die.", "",
          T + "You soon realize that you will make it out of this situation!", T + "You watch how your foe slowly lurks away...");
        p.fight = null;
        return finish(p);
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
        return finish(p, { dead: p.hps < 1 });
      }
      dungeonRound(p, f, opts, out, c);
      return finish(p, { dead: p.hps < 1 });
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
        "SELECT user_id, data FROM usurper_players WHERE user_id != ? AND hps > 0 AND allowed = 1 AND " + (inn ? "location > 0" : "location = 0") + " ORDER BY exp DESC LIMIT 60"
      ).bind(p.id).all()).results;
      const list = [];
      for (const r of rows) {
        if (online.has(r.user_id)) continue;
        const q = JSON.parse(r.data);
        list.push({ id: r.user_id, name: q.name, race: RACES[q.race], cls: CLASSES[q.cls], level: q.level, floor: q.location, bribe: BRIBES[q.location] || 0, sex: q.sex });
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
      if (maintain(v)) await save(db, v, t);
      if ((await onlineIds(db)).has(vid)) { out.push(PLY + v.name + RED + " is awake and walking the streets!"); return finish(p); }
      if (!(v.hps > 0 && v.allowed)) { out.push(PLY + v.name + T + " isn't here."); return finish(p); }
      const inn = v.location > 0;
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
