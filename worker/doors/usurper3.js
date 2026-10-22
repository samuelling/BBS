// USURPER for MEGAzine BBS — phase 3 of the board-side game engine.
//
// USURPER (c) 1993-2009 Jakob Dangarden. Ported by Rick Parrish, bug fixes by Dan Zingaro.
// This file is a conversion of parts of the Usurper source (https://github.com/rickparrish/Usurper)
// to JavaScript for this board. Like the original it is free software: you can redistribute it
// and/or modify it under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option) any later version.
// It is distributed WITHOUT ANY WARRANTY; see the GNU General Public License for details.
//
// Ported here (see docs/USURPER.md for what was left out and why):
//   LOVERS.PAS    the Love Corner: approaching people, feelings, dates, the gift shop, the
//                 gossip-monger, marriage and divorce;  RELATION.PAS + RELATIO2.PAS  relations,
//                 relation news and mail, jealousy, births;  CHILDREN.PAS  children, their upbringing
//                 and the Royal Orphanage;  HOME.PAS  Home Sweet Home and the nursery;  MAIL.PAS
//                 the answers to dates and gifts.
//   (more units are listed where their code starts below)
//
// This module shares the engine's helpers (worker/doors/usurper.js); the two import each other.

import {
  CFG, LOC, RACES, CLASSES, C, R,
  random, pick, cs, nm, clean, him, he, his, He, money, today, dayDiff,
  loadRow, parse, save, news, mail, onlineIds, findPlayer, loadOther, loadKing, saveKing, kingString,
} from "./usurper.js";

// Settings: the fallbacks in VARIOUS.PAS and INIT.PAS (see docs/USURPER.md for the changes).
export const P3 = {
  intimacyActs: 10, laborDays: 5, maxKids: 25, marryAge: 18, motherAge: [18, 45], sameSex: true,
  bishop: "Jakobinus", gossip: "Lydia", rosesCost: 1500, spyCost: 1500, upbringing: 5500,
  wrestlings: 5, bearTries: 5,
};
export const LOC_HOME = 8;
// Colors (the same palette as the engine; repeated here because module constants can't be
// shared across the import cycle at load time).
const T = "|02", HI = "|10", TALK = "|03", PLY = "|11", MON = "|12", ITEM = "|13", GOLD = "|14", WHITE = "|15", HEAD = "|05", RED = "|12", MAG = "|13", KC = "|14", TC = "|11";
const RELC = "|06", KIDC = "|10";

// ================================================================== relations (RELATION.PAS)
export const REL = { married: 10, love: 20, passion: 30, friendship: 40, trust: 50, respect: 60, normal: 70, suspicious: 80, anger: 90, enemy: 100, hate: 110 };
const REL_NAME = { 10: "married", 20: "love", 30: "passion", 40: "friendship", 50: "trust", 60: "respect", 70: "normal", 80: "suspicious", 90: "anger", 100: "enemy", 110: "hate" };
function decRel(r) { return r === 10 ? 10 : r >= 110 ? 110 : r === 60 ? 70 : r + 10; }                 // Decrease_Relation
function incRel(r, over) {                                                                             // Increase_Relation
  if (r === 10 || r === 20) return r;
  if ((r === 30 || r === 40) && !over) return r;
  return r - 10;
}
// Relation_String: [you feel, they feel about you, third party]
const RTEXT = {
  10: ["You are |14married" + T + " to %2.", "%1 is |14married" + T + " to you!", "%1 is |14married" + T + " to %2."],
  20: ["You are deeply " + RELC + "IN LOVE" + T + " with %2.", "%1 is " + RELC + "IN LOVE" + T + " with you!", "%1 is " + RELC + "IN LOVE" + T + " with %2."],
  30: ["Your " + RELC + "passion" + T + " is %2.", "%1s " + RELC + "passion" + T + " is you!", "%1s " + RELC + "passion" + T + " is %2."],
  40: ["%2 is your " + RELC + "friend" + T + ".", "%1 sees you as a " + RELC + "friend" + T + ".", "%1 sees %2 as a " + RELC + "friend" + T + "."],
  50: ["You " + RELC + "trust" + T + " %2.", "%1 " + RELC + "trusts" + T + " you.", "%1 " + RELC + "trusts" + T + " %2."],
  60: ["You " + RELC + "respect" + T + " %2.", "%1 " + RELC + "respects" + T + " you.", "%1 " + RELC + "respects" + T + " %2."],
  70: ["You feel " + RELC + "nothing special" + T + " for %2.", "%1 " + RELC + "ignores" + T + " you.", "%1 " + RELC + "ignores" + T + " %2."],
  80: ["You are not sure if %2 is " + RELC + "reliable" + T + ".", "%1 is " + RELC + "suspicious" + T + " of you.", "%1 is " + RELC + "suspicious" + T + " of %2."],
  90: ["You are " + RELC + "angry" + T + " with %2.", "%1 is " + RELC + "angry" + T + " with you.", "%1 doesn't like %2."],
  100: ["%2 is your " + RELC + "enemy" + T + ".", "%1 is your " + RELC + "enemy" + T + ".", "%1 is %2s " + RELC + "enemy" + T + "."],
  110: ["You " + RED + "hate" + T + " %2!", "%1 " + RED + "hates" + T + " you!", "%1 " + RED + "hates %2" + T + "!"],
};
export function relText(rel, n1, n2, form) {
  return T + (RTEXT[rel] || RTEXT[70])[form].replace("%1", PLY + n1 + T).replace("%2", PLY + n2 + T);
}
// Relation_Self_Mail / Relation_Change_Mail
const SELF_MAIL = { 10: "You are married to %!", 20: "You are in love with %!", 30: "You have a crush for %!", 50: "You trust %.", 40: "You consider % among your friends.",
  60: "You hold % in great respect.", 70: "You feel nothing special for %.", 80: "You think % is a shady character.", 90: "You are angry with %!", 100: "% is your enemy!", 110: "You hate %!" };
const CHANGE_MAIL = { 10: "% married you!", 20: "% loves you!", 30: "%s passion for you makes #1 blind to everything else!", 50: "% trusts you.", 40: "% considers you among #2 friends.",
  60: "% holds you in the greatest respect.", 70: "% is indifferent to your person.", 80: "% suspects you for not being honest.", 90: "% is angry with you!", 100: "% counts you among #2 enemies.", 110: "% hates you!" };

export async function getRel(db, me, other) {
  const a = Math.min(me, other), b = Math.max(me, other);
  const row = await db.prepare("SELECT * FROM usurper_relations WHERE a = ? AND b = ?").bind(a, b).first();
  const r = row ? { ...row } : { a, b, ab: REL.normal, ba: REL.normal, married_times: 0, married_on: null, kids: 0, banned: 0 };
  r.me = me;
  r.mine = me === a ? r.ab : r.ba;       // how "me" feels about the other
  r.theirs = me === a ? r.ba : r.ab;     // how the other feels about "me"
  return r;
}
export async function putRel(db, r) {
  if (r.me === r.a) { r.ab = r.mine; r.ba = r.theirs; } else { r.ba = r.mine; r.ab = r.theirs; }
  await db.prepare("INSERT INTO usurper_relations (a, b, ab, ba, married_times, married_on, kids, banned) VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(a, b) DO UPDATE SET ab = excluded.ab, ba = excluded.ba, married_times = excluded.married_times, married_on = excluded.married_on, kids = excluded.kids, banned = excluded.banned")
    .bind(r.a, r.b, r.ab, r.ba, r.married_times || 0, r.married_on || null, r.kids || 0, r.banned || 0).run();
}
// Update_Relation: from's feelings for to move `steps` steps up (dir > 0) or down.
export async function updateRel(c, dir, steps, from, to, opts = {}) {
  const r = await getRel(c.db, from.id, to.id);
  const mem = r.mine;
  for (let i = 0; i < steps; i++) r.mine = dir > 0 ? incRel(r.mine, opts.override) : decRel(r.mine);
  if (r.mine === mem) return r;
  await putRel(c.db, r);
  if (!opts.noSelfMail) c.later.push(() => mail(c.db, c.t, from.id, "Feelings", SELF_MAIL[r.mine].replace("%", to.name)));
  c.later.push(() => mail(c.db, c.t, to.id, "Feelings", CHANGE_MAIL[r.mine].replace("%", from.name).replace("#1", from.sex === 2 ? "her" : "him").replace("#2", from.sex === 2 ? "her" : "his")));
  c.later.push(() => news(c.db, c.t, pick(["Relations", "Feelings", "Emotions"]), " " + relText(r.mine, from.name, to.name, 2)));  // Relation_Change_News
  return r;
}
// Jealousy(2): the spouses of two people who have been out together hear about it.
async function jealousy(c, a, b) {
  for (const [x, y] of [[a, b], [b, a]]) {
    if (!x.spouse || x.spouse === y.id) continue;
    c.later.push(() => mail(c.db, c.t, x.spouse, "Cheating!", "Your " + (x.sex === 2 ? "wife" : "husband") + " " + x.name + " is fooling around with " + aRace(y.race) + "!",
      (x.sex === 2 ? "She" : "He") + " is cheating on you!"));
  }
}
const aRace = r => (/^[AEIOU]/.test(RACES[r]) ? "an " : "a ") + RACES[r];
async function history(c, kind, body) {
  await c.db.prepare("INSERT INTO usurper_history (kind, day, body) VALUES (?, ?, ?)").bind(kind, today(), body).run();
}
// exp/gold for a character who isn't the one playing (IncPlayerExp on a stored character)
export async function bump(db, id, field, x) {
  if (field === "exp") await db.prepare("UPDATE usurper_players SET exp = exp + ?1, data = json_set(data, '$.exp', json_extract(data, '$.exp') + ?1) WHERE user_id = ?2").bind(x, id).run();
  else await db.prepare("UPDATE usurper_players SET data = json_set(data, '$." + field + "', coalesce(json_extract(data, '$." + field + "'), 0) + ?1) WHERE user_id = ?2").bind(x, id).run();
}
async function request(c, toId, fromId, kind, data = {}) {
  await c.db.prepare("INSERT INTO usurper_requests (to_id, from_id, kind, data, at) VALUES (?, ?, ?, ?, ?)").bind(toId, fromId, kind, JSON.stringify(data), c.t).run();
}
function looks(v, spouseName) {   // Good_Looks
  const lv = v.level, race = RACES[v.race].toLowerCase();
  const pow = lv <= 10 ? "a puny" : lv <= 20 ? "a wimpish" : lv <= 30 ? "a mediocre" : lv <= 40 ? "an average" : lv <= 50 ? "a strong" : lv <= 60 ? "an experienced"
    : lv <= 70 ? "a potent" : lv <= 80 ? "a veteran" : lv <= 90 ? "an overwhelming" : "a super mighty";
  const a = v.age, yrs = cs(a) + (a > 1 ? " years old" : " year old");
  const age = a <= 10 ? "is still a child (" + yrs + ")." : a <= 25 ? "is young and daring (" + yrs + ")." : a <= 40 ? "is in " + his(v) + " prime (" + yrs + ")."
    : a <= 60 ? "bears the marks of time (" + yrs + ")." : a <= 90 ? "is an old-timer (" + yrs + ")." : "is a super-senior (" + yrs + ").";
  const n = PLY + v.name + T;
  return [n + (v.king ? ", |14THE " + kingString(v.sex).toUpperCase() + "!" + T + "," : "") + " is " + pow + " " + race + ".", n + " " + age,
    n + (v.chiv >= v.dark ? " is good-hearted." : " has an evil mind."), spouseName ? n + " is married to " + PLY + spouseName + T + "." : ""].filter(Boolean);
}
async function spouseName(db, v) {
  if (!v.spouse) return "";
  const r = await db.prepare("SELECT name FROM usurper_players WHERE user_id = ?").bind(v.spouse).first();
  return r ? r.name : "";
}

// ================================================================== children (CHILDREN.PAS)
function childRow(r) { const d = JSON.parse(r.data); return { ...d, id: r.id, name: r.name, mother_id: r.mother_id, father_id: r.father_id, location: r.location, deleted: r.deleted }; }
async function saveChild(db, ch) {
  const { id, name, mother_id, father_id, location, deleted, ...data } = ch;
  await db.prepare("UPDATE usurper_children SET name = ?, mother_id = ?, father_id = ?, location = ?, deleted = ?, data = ? WHERE id = ?")
    .bind(name || "", mother_id ?? null, father_id ?? null, location || 0, deleted ? 1 : 0, JSON.stringify(data), id).run();
}
const childStmt = (db, ch) => {
  const { id, name, mother_id, father_id, location, deleted, ...data } = ch;
  return db.prepare("UPDATE usurper_children SET name = ?, mother_id = ?, father_id = ?, location = ?, deleted = ?, data = ? WHERE id = ?")
    .bind(name || "", mother_id ?? null, father_id ?? null, location || 0, deleted ? 1 : 0, JSON.stringify(data), id);
};
async function myChildren(db, id) {
  return (await db.prepare("SELECT * FROM usurper_children WHERE deleted = 0 AND (mother_id = ?1 OR father_id = ?1) ORDER BY id LIMIT 40").bind(id).all()).results.map(childRow);
}
const isParent = (ch, id) => ch.mother_id === id || ch.father_id === id;
const hasAccess = (ch, id) => (ch.mother_id === id && ch.motherAccess) || (ch.father_id === id && ch.fatherAccess);
const sonDau = ch => (ch.sex === 2 ? "daughter" : "son");
const boyGirl = ch => (ch.sex === 2 ? "girl" : "boy");
const childHe = ch => (ch.sex === 2 ? "she" : "he"), childHis = ch => (ch.sex === 2 ? "her" : "his");
function childSoul(ch) {   // Child_Soul
  const s = ch.soul;
  return s <= -300 ? "evil brat" : s <= -100 ? "vicious kid" : s <= 0 ? "naughty kid" : s <= 100 ? "kid" : s <= 200 ? "nice kid" : s <= 400 ? "well-mannered child" : "angel-heart";
}
function childSoulString(ch) {   // Child_Soul_String
  const s = ch.soul;
  return s <= -250 ? "evil" : s <= -100 ? "naughty" : s <= 0 ? "bad kid" : s <= 100 ? "normal" : s <= 250 ? "well-behaved" : "angel-heart";
}
const HEALTH = ["normal", "poisoned", "cursed", "depressed"];
function childView(ch, forId) {
  return { id: ch.id, name: ch.name, sex: ch.sex, age: ch.age, born: ch.born, location: ch.location, health: HEALTH[ch.health || 0], soul: childSoulString(ch), kind: childSoul(ch),
    mother: ch.mother, father: ch.father, orgMother: ch.orgMother, orgFather: ch.orgFather, motherAccess: ch.motherAccess, fatherAccess: ch.fatherAccess,
    royal: ch.royal || 0, bastard: !!ch.bastard, mine: forId ? isParent(ch, forId) : false, access: forId ? hasAccess(ch, forId) : false };
}
function newChild(mother, father, bastard) {   // New_ChildRecord + Create_Child
  return {
    sex: random(2) + 1, age: 1, ageplus: 0, born: today(), day: today(), bastard: !!bastard, named: false, soul: 50, health: 0,
    mother: mother.name, father: father ? father.name : "", orgMother: mother.name, orgFather: father ? father.name : "",
    motherAccess: true, fatherAccess: !bastard && !!father, royal: (mother.king ? 1 : 0) + (father && father.king ? 1 : 0), sick: [],
  };
}
// Give_Birth: called from the mother's daily maintenance once the labor days have passed.
async function giveBirth(p, c) {
  const f = p.fatherId ? await loadOther(c, p.fatherId) : null;
  const married = !!(f && p.spouse === f.id);
  const ch = newChild(p, f, !married);
  const r = await c.db.prepare("INSERT INTO usurper_children (name, mother_id, father_id, location, deleted, data) VALUES ('', ?, ?, 0, 0, ?)")
    .bind(p.id, f ? f.id : null, JSON.stringify(ch)).run();
  p.pregnancy = 0; p.fatherId = null;
  let x = p.level * 1500;
  p.exp += x; p.kids = (p.kids || 0) + 1;
  const lines = ["You gave birth to a child today!", "You are responsible for " + cs(p.kids) + " " + (p.kids === 1 ? "kid" : "kids") + " now.", "You received " + cs(x) + " experience points for the delivery."];
  if (f) {
    f.kids = (f.kids || 0) + 1;
    let fx = "";
    if (random(3) === 0) { const y = f.level * 650; f.exp += y; fx = "You were present at the delivery and received " + cs(y) + " experience points."; lines.push(f.name + " was present at the delivery to support you."); }
    else { fx = "You didn't have the guts to be present at the delivery!"; lines.push(f.name + " was too scared and didn't show."); }
    await save(c.db, f, c.t);
    const rel = await getRel(c.db, p.id, f.id); rel.kids++; await putRel(c.db, rel);
    c.later.push(() => mail(c.db, c.t, f.id, "Childbirth!", p.name + " gave birth to your child today!", "You are responsible for " + cs(f.kids) + " " + (f.kids === 1 ? "kid" : "kids") + " now.", fx, "Congratulations!"));
  }
  c.later.push(() => mail(c.db, c.t, p.id, "Childbirth!", ...lines));
  c.later.push(() => news(c.db, c.t, "Childbirth!", " " + PLY + p.name + T + " the " + RACES[p.race] + ", delivered a baby " + boyGirl(ch) + "!",
    f ? " " + PLY + f.name + T + " the " + RACES[f.race] + " is a proud father!" : " The poor " + boyGirl(ch) + " is fatherless!",
    ch.bastard && f ? " The newborn was born out of wedlock." : "", ch.royal ? " The newborn has |14Royal" + T + " blood floating in " + childHis(ch) + " veins!" : ""));
  return r;
}
// Children_Maintenance, run lazily: each parent settles their own share of each child's day,
// and the child grows a year now and then (whoever touches the child first on a new day).
async function childrenDaily(p, c, days) {
  const kids = await myChildren(c.db, p.id);
  if (!kids.length) return;
  const d = today(), stmts = [], lines = [];
  for (const ch of kids) {
    if (!ch.named) continue;
    let dirty = false;
    if (ch.day !== d) {   // birthdays (34 days, then a 1 in 4 chance each day) and growing up
      const n = Math.max(1, Math.min(30, dayDiff(ch.day || d, d)));
      ch.day = d; dirty = true;
      for (let i = 0; i < n && !ch.deleted; i++) {
        if (ch.ageplus < 32000) ch.ageplus++;
        if (ch.ageplus > 34 && ch.age < 18 && random(4) === 0) {
          ch.age++; ch.ageplus = 0;
          lines.push("You celebrated your " + sonDau(ch) + " " + ch.name + "'s " + ch.age + "th birthday.");
          if (ch.age > 18) {
            ch.deleted = 1;
            lines.push("You said goodbye to your " + sonDau(ch) + " " + ch.name + ". " + ch.name + " is a big " + boyGirl(ch) + " and must seek " + childHis(ch) + " own luck now!");
            c.later.push(() => news(c.db, c.t, "Grownup", " " + KIDC + ch.name + T + " the child to " + PLY + ch.mother + T + " and " + PLY + ch.father + T + " has", " left home to seek " + childHis(ch) + " luck in the world."));
            c.later.push(() => history(c, "child", KIDC + ch.name + T + " left childhood."));
          }
        }
      }
    }
    if (ch.deleted || ch.location !== 0 || !hasAccess(ch, p.id)) { if (dirty) stmts.push(childStmt(c.db, ch)); continue; }
    // upbringing costs money; one parent alone pays double
    const cost = ch.age * P3.upbringing * days;
    const single = !ch.mother_id || !ch.father_id || !ch.motherAccess || !ch.fatherAccess;
    const due = cost * (single ? 2 : 1);
    if (p.gold >= due) p.gold -= due;
    else if (p.bank >= due) p.bank -= due;
    else {
      ch.location = 1; dirty = true;
      lines.push("Your " + sonDau(ch) + " " + ch.name + " has been sent to the Royal Orphanage!", "You don't have the funds to support your own children! SHAME ON YOU!");
      c.later.push(() => news(c.db, c.t, "Family Tragedy!", " " + KIDC + ch.name + T + " was sent to the Royal Orphanage!"));
      stmts.push(childStmt(c.db, ch));
      continue;
    }
    const sick = ch.sick || [];
    if (sick.includes(p.id)) {   // ChildDepressedExp: the parents grieve
      const x = Math.min(p.exp, ch.age * 850 * days);
      p.exp -= x; ch.sick = sick.filter(i => i !== p.id); if (!ch.sick.length) ch.health = 0; dirty = true;
      lines.push(ch.name + ", your " + sonDau(ch) + ", is " + HEALTH[ch.health || 3] + ". You lose " + cs(x) + " experience points grieving.");
    } else if (!ch.health) {
      const x = ch.age * 750 * days;   // ChildRaisingExp
      p.exp += x;
      lines.push("You earn " + cs(x) + " experience points raising " + ch.name + ".");
    }
    if (dirty) stmts.push(childStmt(c.db, ch));
  }
  if (stmts.length) await c.db.batch(stmts);
  if (lines.length) c.later.push(() => mail(c.db, c.t, p.id, "Your Children", ...lines.slice(0, 12)));
}
// The Royal Orphanage is paid from the treasury (CHILDREN.PAS); called from the Castle's day.
export async function orphanageDaily(c, k, days) {
  const rows = (await c.db.prepare("SELECT * FROM usurper_children WHERE deleted = 0 AND location = 1 ORDER BY id LIMIT 30").all()).results.map(childRow);
  if (!rows.length) return;
  const stmts = [];
  for (const ch of rows) {
    const cost = ch.age * P3.upbringing * days;
    if (k.treasury >= cost) k.treasury -= cost;
    else {   // out of funds: the child is placed with a farming family far away (see docs/USURPER.md)
      ch.deleted = 1;
      c.later.push(() => news(c.db, c.t, "Family Tragedy!", " " + KIDC + ch.name + T + " was sent away to a farm in the far north!", " The Royal Orphanage is out of funds!"));
      for (const id of [ch.mother_id, ch.father_id]) if (id) c.later.push(() => mail(c.db, c.t, id, "Child Lost!", "Your " + sonDau(ch) + " " + ch.name + " was sent away to a farm in the far north!", "The Royal Orphanage was unable to sustain poor " + ch.name + "."));
    }
    ch.day = today();
    stmts.push(childStmt(c.db, ch));
  }
  await c.db.batch(stmts);
}

// ================================================================== the daily hooks
// MAINT.PAS, the synchronous part (called from maintain()).
export function maintain3(p, days) {
  p.intimacy = P3.intimacyActs;
  p.wellwish = false; p.wrestlings = P3.wrestlings; p.bearTries = 0; p.brawls = 3; p.gymSessions = 4; p.massage = 0;
  if (p.pregnancy > 0) p.pregnancy += days;
}
// ... and the part that needs the database (called from dailyRealm()).
export async function daily3(p, c, days) {
  if (p.sex === 2 && p.pregnancy >= P3.laborDays) await giveBirth(p, c);
  await childrenDaily(p, c, days);
}

// The phase-3 part of the character sheet the terminal sees.
export function view3(p) {
  return { intimacy: p.intimacy ?? P3.intimacyActs, married: !!p.spouse, pregnant: (p.pregnancy || 0) > 0, kids: p.kids || 0, completed: !!p.completed, god: p.god || null, chivnr: p.chivnr ?? 0, dquest: !!p.dquest, quests: p.quests || 0,
    wrestlings: p.wrestlings ?? P3.wrestlings, bearTries: p.bearTries || 0 };
}

// What waits for a character when they come in: answers to give, babies to name.
export async function arrivals(p, c) {
  const reqs = (await c.db.prepare("SELECT r.id, r.kind, r.data, r.from_id, p.name FROM usurper_requests r LEFT JOIN usurper_players p ON p.user_id = r.from_id WHERE r.to_id = ? ORDER BY r.id LIMIT 10").bind(p.id).all()).results;
  const requests = [];
  for (const q of reqs) {
    if (q.kind === "immortal") { const d = JSON.parse(q.data || "{}"); requests.push({ id: q.id, kind: q.kind, from: d.godName, data: d, rel: [] }); continue; }
    if (!q.name) { await c.db.prepare("DELETE FROM usurper_requests WHERE id = ?").bind(q.id).run(); continue; }
    const rel = await getRel(c.db, p.id, q.from_id);
    requests.push({ id: q.id, kind: q.kind, from: q.name, data: JSON.parse(q.data || "{}"), rel: [relText(rel.mine, p.name, q.name, 0), relText(rel.theirs, q.name, p.name, 1)] });
  }
  const babies = (await c.db.prepare("SELECT * FROM usurper_children WHERE deleted = 0 AND name = '' AND (mother_id = ?1 OR father_id = ?1) LIMIT 5").bind(p.id).all()).results
    .map(childRow).map(ch => ({ id: ch.id, sex: ch.sex, other: ch.mother_id === p.id ? ch.father : ch.mother }));
  return { requests, babies, pregnant: p.pregnancy > 0 };
}

// ================================================================== the commands
export async function phase3Action(action, body, p, c, ctx, out, finish) {
  const db = c.db;
  if (action.startsWith("supreme/")) return supremeAction(action, body, p, c, ctx, out, finish);
  if (action.startsWith("temple/")) return templeAction(action, body, p, c, ctx, out, finish);
  if (action.startsWith("uman/")) return umanAction(action, body, p, c, ctx, out, finish);
  if (action.startsWith("market/") || action === "team/send") return marketAction(action, body, p, c, ctx, out, finish);
  if (action.startsWith("brawl/")) return brawlAction(action, body, p, c, ctx, out, finish);
  if (action.startsWith("gym/")) return gymAction(action, body, p, c, ctx, out, finish);
  if (action === "magic/papers") {   // MAGIC.PAS: the papers from the wounded man in the dungeons
    if (!p.dquest) { out.push(T + "You stand there like a sheep. You have nothing to show!", T + "(idiot!)"); return finish(p); }
    p.dquest = false; p.quests = (p.quests || 0) + 1;
    out.push(T + "You show the papers you were given by " + PLY + "Fionn" + T + " to " + PLY + "Ravanella" + T + ".", PLY + "Ravanella" + T + " studies the papers and then puts them in a drawer.",
      PLY + "Ravanella" + T + " then turns to you and speaks :", TALK + " Good work " + RED + p.name + TALK + " ! You have helped us in the " + GOLD + "Brother Ring" + TALK + " more",
      TALK + " than you think. This may very well prove to be the edge we so very much need", TALK + " to bring that infamous Warlord " + WHITE + "Grimsk" + TALK + " to his knees.",
      p.quests === 1 ? GOLD + "You have completed your FIRST Mission! Congratulations!" : T + "You completed your " + WHITE + cs(p.quests) + T + " Mission! " + GOLD + " GOOD WORK!", T + "This will be put in our records!");
    return finish(p);
  }
  if (action === "dng/event") {
    if (!p.event) ctx.fail("Nothing is happening.");
    eventStep(p, c, out, body.key, body.n);
    const uman = !!p.uman; p.uman = false;
    return finish(p, { dead: p.hps < 1, uman });
  }
  const noFight = () => { if (p.fight) ctx.fail("You are in the middle of a fight!"); };
  const other = async (id, msg) => {   // another character, after their own daily maintenance
    const v = await loadOther(c, Math.trunc(+id));
    if (!v || v.id === p.id) ctx.fail(msg || "Couldn't locate that character.");
    return v;
  };
  switch (action) {
    // ---------------------------------------------------------------- Love Corner (LOVERS.PAS)
    case "love/approach": {   // establish relation: looks, feelings both ways
      noFight();
      const v = await other(body.id);
      if ((await onlineIds(db)).has(v.id)) { out.push(RED + "Sorry, but " + PLY + v.name + RED + " is not available right now."); return finish(p); }
      if (v.location === LOC.prison) { out.push(RED + "Sorry, but " + PLY + v.name + RED + " is in Prison right now."); return finish(p); }
      const r = await getRel(db, p.id, v.id);
      if (r.mine === REL.married) {
        out.push(RED + "You are married to " + PLY + v.name + RED + "!", RED + "Have you already forgotten that?", RED + "Go to your house and make your " + (v.sex === 2 ? "wife" : "husband") + " happy.");
        return finish(p);
      }
      return finish(p, { target: { id: v.id, name: v.name, sex: v.sex, looks: looks(v, await spouseName(db, v)), rel: [relText(r.mine, p.name, v.name, 0), relText(r.theirs, v.name, p.name, 1)], mine: r.mine } });
    }
    case "love/feel": {   // change_feelings_menu
      const v = await other(body.id);
      const nv = Math.trunc(+body.rel);
      if (![20, 30, 40, 50, 60, 70, 80, 90, 100, 110].includes(nv)) ctx.fail("Pick a feeling.");
      const r = await getRel(db, p.id, v.id);
      if (r.mine === REL.married) ctx.fail("You are married to " + v.name + "! Get a divorce first.");
      if (r.mine === nv) return finish(p);
      r.mine = nv; await putRel(db, r);
      out.push(WHITE + "You declare your feelings to " + PLY + v.name + WHITE + "!", PLY + v.name + T + pick([" looks at you somewhat puzzled.", " looks distraught.", " smiles.", " looks indifferent.", " is silent.", " smiles."]));
      if (nv === REL.love) out.push(RED + "LOVE! LOVE! LOVE! LOVE!");
      if (nv === REL.hate) out.push(RED + "HATE! HATE! HATE! HATE!");
      c.later.push(() => mail(db, c.t, v.id, "Feelings", CHANGE_MAIL[nv].replace("%", p.name).replace("#1", him(p)).replace("#2", his(p))));
      c.later.push(() => news(db, c.t, pick(["Relations", "Feelings", "Emotions"]), " " + relText(nv, p.name, v.name, 2)));
      return finish(p);
    }
    case "love/date": {   // Intimate: (H)old hands, (D)inner, (K)iss — the other player answers later
      noFight();
      const v = await other(body.id);
      const kind = { H: "hold", D: "dinner", K: "kiss" }[String(body.kind || "").toUpperCase()];
      if (!kind) ctx.fail("Pick a romantic move.");
      if (v.sex === p.sex && !P3.sameSex) ctx.fail("Same-sex relations are not allowed in this realm.");
      if ((p.intimacy ?? P3.intimacyActs) < 1) { out.push(RED + "You have no intimate sessions left today."); return finish(p); }
      const r = await getRel(db, p.id, v.id);
      if (r.mine === REL.married) {
        out.push(RED + (kind === "hold" ? "You are married! (not a couple of love-birds)." : kind === "dinner" ? "You are married! Go home and eat instead!" : "Married couples entertain themselves at home! (go home)"));
        return finish(p);
      }
      await request(c, v.id, p.id, kind);
      p.intimacy = (p.intimacy ?? P3.intimacyActs) - 1;
      out.push(WHITE + (kind === "kiss" ? "Do you really think that " + PLY + v.name + WHITE + " wanna be kissed by you?" : "We will see if " + PLY + v.name + WHITE + " agrees to go out with you..."),
        WHITE + "Posting invitation...", GOLD + "Done!");
      return finish(p);
    }
    case "love/marry": {   // marry_routine
      noFight();
      const v = await other(body.id);
      const r = await getRel(db, p.id, v.id);
      const vs = await spouseName(db, v);
      if (v.sex === p.sex && !P3.sameSex) ctx.fail("Same-sex relations are not allowed in this realm.");
      if ((p.intimacy ?? P3.intimacyActs) < 1) { out.push(RED + "You have no intimate sessions left today."); return finish(p); }
      if (p.spouse === v.id) { out.push(RED + "You two are already married! (dummy!)"); return finish(p); }
      if (vs) { out.push(PLY + v.name + T + " is already married to " + PLY + vs + T + "!"); return finish(p); }
      if (p.spouse) { out.push(RED + "Hey " + (p.sex === 1 ? "Buster" : "Darling") + "! You are already married!", RED + "Go look after your family instead of chasing " + (p.sex === 1 ? "girls." : "guys.")); return finish(p); }
      if (r.banned) {
        const k = await loadKing(c);
        out.push(T + "The Royal House has decided that your relation with " + PLY + v.name, T + "is " + RED + "undesirable" + T + ". You cannot marry in this Realm.", T + "/" + kingString(k.sex) + " " + KC + k.name + T + ", your enlightened leader.");
        return finish(p);
      }
      if (p.age < P3.marryAge) { out.push(RED + "You are too young to marry! (required age is " + P3.marryAge + ")"); return finish(p); }
      if (v.age < P3.marryAge) { out.push(PLY + v.name + T + " is too young to marry! (required age is " + P3.marryAge + ")"); return finish(p); }
      const cost = p.level * 150000;
      if (!body.confirm) return finish(p, { offer: { name: v.name, cost, times: r.married_times } });
      if (p.gold < cost) { out.push(RED + "Your wedding will cost " + GOLD + cs(cost) + RED + ".", RED + "You don't have the gold!"); return finish(p); }
      if (!(r.mine === REL.love && r.theirs === REL.love)) { out.push(RED + "You both need to be in love with each other to marry!"); return finish(p); }
      p.gold -= cost;
      out.push(WHITE + "MARRIAGE!", HEAD + "The Church", T + "You stand before Bishop " + MAG + P3.bishop + T + ".", T + "You and " + PLY + v.name + T + " take each others hands...", TALK + "\"What God has joined, man must not divide...!\"");
      c.later.push(() => news(db, c.t, "Wedding!", " " + PLY + p.name + T + " the " + RACES[p.race] + " and " + PLY + v.name + T + " the " + RACES[v.race] + " were married!",
        pick([" The church was crowded with relatives and friends.", " Not many came to honor the newly wed...", " The mayor held a party for the newly wed!"])));
      c.later.push(() => history(c, "love", PLY + p.name + T + " and " + PLY + v.name + T + " were |14Married" + T + "."));
      c.later.push(() => mail(db, c.t, v.id, "Marriage!", p.name + " and you were married!"));
      r.mine = REL.married; r.theirs = REL.married; r.married_on = today(); r.married_times = (r.married_times || 0) + 1;
      await putRel(db, r);
      p.intimacy--;
      // children from an earlier marriage of the two are reunited with both parents
      const kids = (await myChildren(db, p.id)).filter(ch => isParent(ch, v.id) && ch.named);
      for (const ch of kids) {
        const x = ch.age * 850;
        out.push(WHITE + "You share custody of your " + sonDau(ch) + " " + KIDC + ch.name + WHITE + "!", GOLD + ch.name + " is happy when " + childHe(ch) + " sees " + childHis(ch) + " parents join again!",
          T + "You and " + PLY + v.name + T + " receive " + cs(x) + " experience points for making your children happy!");
        p.exp += x; v.exp += x;
        ch.motherAccess = true; ch.fatherAccess = true; ch.health = 0; ch.sick = [];
        await saveChild(db, ch);
        c.later.push(() => mail(db, c.t, v.id, "Happy Child!", "You receive " + cs(x) + " experience points for making your", sonDau(ch) + " " + ch.name + " extremely happy by marrying " + p.name + " the " + CLASSES[p.cls] + "."));
      }
      p.spouse = v.id; v.spouse = p.id;
      p.marriedTimes = (p.marriedTimes || 0) + 1; v.marriedTimes = (v.marriedTimes || 0) + 1;
      await save(db, v, c.t);
      out.push(T + "Marriage complete.", GOLD + (p.sex !== v.sex ? "Congratulations! (go home and start a family)" : "Congratulations!"));
      return finish(p);
    }
    case "love/divorce": {   // divorce
      noFight();
      if (!p.spouse) { out.push(RED + "You are not married bird-brain!", RED + "Go and find yourself a spouse before it's too late!"); return finish(p); }
      const v = await other(p.spouse);
      const r = await getRel(db, p.id, v.id);
      const days = r.married_on ? dayDiff(r.married_on, today()) : 0;
      if (!body.confirm) return finish(p, { offer: { name: v.name, days } });
      out.push(WHITE + "Ok.", PLY + v.name + T + " is gone at last, and good riddance!");
      const s = days < 1 ? " Their marriage lasted only a couple of hours!!" : " Their marriage lasted " + (days < 30 ? "only " : "") + WHITE + cs(days) + T + " days.";
      r.mine = REL.normal; r.theirs = REL.hate; r.married_on = null;
      await putRel(db, r);
      p.spouse = null; v.spouse = null;
      await save(db, v, c.t);
      c.later.push(() => news(db, c.t, "Divorce!", " " + PLY + p.name + T + " divorced " + PLY + v.name + T + "!", s));
      c.later.push(() => history(c, "love", PLY + p.name + T + " and " + PLY + v.name + T + " were " + RED + "Divorced" + T + "!"));
      // the children stay with the spouse, and they take it hard
      for (const ch of (await myChildren(db, p.id)).filter(k => isParent(k, v.id) && k.named)) {
        if (ch.mother_id === p.id) ch.motherAccess = false; else ch.fatherAccess = false;
        ch.health = 3; ch.sick = [v.id];
        await saveChild(db, ch);
        out.push(RED + "You have lost custody of your " + sonDau(ch) + " " + KIDC + ch.name + RED + "!");
        c.later.push(() => mail(db, c.t, v.id, "Depression", ch.name + ", your " + sonDau(ch) + ", is suffering from a depression!", "The divorce you are going through is not good for the children!!"));
        c.later.push(() => mail(db, c.t, v.id, "Divorce Consequences", "You are now fully responsible for " + ch.name + ", your " + sonDau(ch) + "!", p.name + " has left you and the children!"));
        c.later.push(() => news(db, c.t, "Child depressed!", " " + KIDC + ch.name + T + ", the " + sonDau(ch) + " of " + PLY + ch.mother + T + " and " + PLY + ch.father + T + " is",
          " suffering from a " + RED + "depression" + T + " as a direct result of the", " parents divorce."));
      }
      c.later.push(() => mail(db, c.t, v.id, "Divorce!", p.name + " divorced you!"));
      return finish(p);
    }
    case "love/gift": {   // the Gift Shop: roses, a surprise box (chocolate or scorpions)
      noFight();
      const v = await other(body.id);
      const kind = String(body.kind || "");
      if (kind === "roses") {
        if (p.gold < P3.rosesCost) { out.push(RED + "Come back when you have " + GOLD + cs(P3.rosesCost) + RED + " gold coins!"); return finish(p); }
        if (p.spouse === v.id) { out.push(RED + "You are already married! No need to court " + him(v) + "!"); return finish(p); }
        if ((p.intimacy ?? P3.intimacyActs) < 1) { out.push(RED + "You have no intimate sessions left today."); return finish(p); }
        p.gold -= P3.rosesCost; p.intimacy = (p.intimacy ?? P3.intimacyActs) - 1;
        await request(c, v.id, p.id, "roses");
        out.push(T + "The flowers are on their way to " + PLY + v.name + T + ".", GOLD + "Done!");
        return finish(p);
      }
      if (kind !== "chocolate" && kind !== "scorpions") ctx.fail("Pick a gift.");
      const price = v.level * (kind === "chocolate" ? 55000 : 75000);
      if (!body.confirm) return finish(p, { offer: { name: v.name, price } });
      if (p.gold < price) { out.push(RED + "You can't afford it!"); return finish(p); }
      if (kind === "chocolate" && (p.chivnr ?? 0) < 1) { out.push(RED + "You have no good deeds left today."); return finish(p); }
      if (kind === "scorpions" && (p.darknr ?? 0) < 1) { out.push(RED + "You have no dark deeds left today."); return finish(p); }
      p.gold -= price;
      if (kind === "chocolate") p.chivnr--; else p.darknr--;
      await request(c, v.id, p.id, kind);
      out.push(WHITE + "You pay " + GOLD + cs(price) + WHITE + " " + money(price) + ".", WHITE + "We will see if " + PLY + v.name + WHITE + " opens this package...", GOLD + "Done!");
      return finish(p);
    }
    case "love/spy": {   // the gossip-monger: spy on relations (1,500 gold)
      const v = await other(body.id);
      if (p.gold < P3.spyCost) { out.push(RED + "You haven't got enough gold!"); return finish(p); }
      p.gold -= P3.spyCost;
      if (random(2) === 0) c.later.push(() => mail(db, c.t, v.id, "Spies!", p.name + " spied on your relations."));
      return finish(p, await relationList(db, v));
    }
    case "love/poison": {   // the gossip-monger: poison the relation between two people
      const a = await other(body.a), b = await other(body.b);
      if (a.id === b.id) { out.push(RED + "Idiot!"); return finish(p); }
      if ((p.darknr ?? 0) < 1) { out.push(RED + "You have no dark deeds left today."); return finish(p); }
      const price = a.level * 15000 + b.level * 15000;
      if (!body.confirm) return finish(p, { offer: { a: a.name, b: b.name, price } });
      if (p.gold < price) { out.push(RED + "It will cost you " + cs(price) + " " + money(price), RED + "You can't afford it!"); return finish(p); }
      p.gold -= price; p.darknr--;
      out.push(PLY + P3.gossip + T + " promises to spread the most vicious slander..");
      if (random(3) === 0) {
        const s = PLY + a.name + T + " and " + PLY + b.name + T;
        out.push(WHITE + "SUCCESS!", WHITE + pick(["A note of discord crept into the " + s + WHITE + " relationship!", s + WHITE + " distrust each other!", s + WHITE + " relationship is deteriorating!"]));
        await updateRel(c, -1, 2, a, b); await updateRel(c, -1, 2, b, a);
        c.later.push(() => mail(db, c.t, a.id, "Bad Feeling", b.name + " is trying to set you up!"));
        c.later.push(() => mail(db, c.t, b.id, "Bad Feeling", a.name + " is trying to hurt you and your family!"));
        c.later.push(() => news(db, c.t, "Disagreement", " " + PLY + a.name + T + " and " + PLY + b.name + T + " had an argument."));
      } else {
        out.push(RED + "Dang! It failed! They saw through your petty little scheme!", PLY + a.name + T + " is very upset!", PLY + b.name + T + " is fuming!");
        await updateRel(c, -1, 1, a, p); await updateRel(c, -1, 1, b, p);
        c.later.push(() => mail(db, c.t, a.id, "Intriguer!", p.name + " tried to poison your relation with " + b.name + "!"));
        c.later.push(() => mail(db, c.t, b.id, "Intriguer!", p.name + " tried to poison your relation with " + a.name + "!"));
        c.later.push(() => news(db, c.t, "Intriguer!", " " + PLY + p.name + T + " was exposed trying to poison the relation", " between " + PLY + a.name + T + " and " + PLY + b.name + T + "."));
      }
      return finish(p);
    }
    case "love/relations": {   // Personal: your own relations and the summary
      return finish(p, await relationList(db, p));
    }
    case "love/couples": {   // List_Married_Couples
      const rows = (await db.prepare("SELECT r.a, r.b, r.married_on, r.kids, pa.name na, pb.name nb FROM usurper_relations r JOIN usurper_players pa ON pa.user_id = r.a JOIN usurper_players pb ON pb.user_id = r.b WHERE r.ab = 10 AND r.ba = 10 ORDER BY r.married_on LIMIT 40").all()).results;
      return finish(p, { couples: rows.map(r => ({ a: r.na, b: r.nb, days: r.married_on ? dayDiff(r.married_on, today()) : 0, kids: r.kids })) });
    }
    case "love/history": {   // History of Love: marriages, divorces, births and children leaving home
      const kind = body.kind === "child" ? "child" : "love";
      const rows = (await db.prepare("SELECT day, body FROM usurper_history WHERE kind = ? ORDER BY id DESC LIMIT 18").bind(kind).all()).results;
      return finish(p, { history: rows });
    }
    case "children/realm": {   // Children_in_Realm (and Children_in_Orphanage)
      const where = body.orphanage ? "location = 1" : "1 = 1";
      const rows = (await db.prepare("SELECT * FROM usurper_children WHERE deleted = 0 AND name != '' AND " + where + " ORDER BY id LIMIT 60").all()).results.map(childRow);
      return finish(p, { children: rows.map(ch => childView(ch, p.id)) });
    }
    case "child/view": {
      const r = await db.prepare("SELECT * FROM usurper_children WHERE id = ? AND deleted = 0").bind(Math.trunc(+body.id)).first();
      if (!r) ctx.fail("No such child.");
      return finish(p, { child: childView(childRow(r), p.id) });
    }
    case "child/name": {   // Name_Babies
      const r = await db.prepare("SELECT * FROM usurper_children WHERE id = ? AND deleted = 0 AND name = ''").bind(Math.trunc(+body.id)).first();
      if (!r) ctx.fail("That baby already has a name.");
      const ch = childRow(r);
      if (!isParent(ch, p.id)) ctx.fail("That isn't your baby.");
      const name = clean(body.name, 20).replace(/[^A-Za-z0-9 '\-]/g, "").trim();
      if (name.length < 2) ctx.fail("Pick a name.");
      const taken = await db.prepare("SELECT id FROM usurper_children WHERE upper(name) = upper(?) AND deleted = 0").bind(name).first();
      if (taken) ctx.fail("There is already a child named " + name + " in the realm.");
      ch.name = name; ch.named = true; ch.day = today();
      await saveChild(db, ch);
      out.push(WHITE + "Your " + boyGirl(ch) + " is named " + KIDC + name + WHITE + "!");
      c.later.push(() => history(c, "child", KIDC + name + T + " was born to " + PLY + ch.mother + T + (ch.father ? " and " + PLY + ch.father + T : "") + "."));
      const otherId = ch.mother_id === p.id ? ch.father_id : ch.mother_id;
      if (otherId) c.later.push(() => mail(db, c.t, otherId, "Baby Named", p.name + " named your " + boyGirl(ch) + " " + name + "."));
      return finish(p);
    }
    // ---------------------------------------------------------------- answers (MAIL.PAS mail requests)
    case "req/answer": {
      const q = await db.prepare("SELECT * FROM usurper_requests WHERE id = ? AND to_id = ?").bind(Math.trunc(+body.id), p.id).first();
      if (!q) ctx.fail("That has been taken care of.");
      await db.prepare("DELETE FROM usurper_requests WHERE id = ?").bind(q.id).run();
      if (q.kind === "immortal") return answerImmortal(q, !!body.yes, p, c, out, finish);
      if (q.kind === "gymcard") {   // an application for a club card to the owners' Gym
        const d = JSON.parse(q.data || "{}"), v = await loadOther(c, q.from_id);
        await db.prepare("DELETE FROM usurper_requests WHERE kind = 'gymcard' AND from_id = ?").bind(q.from_id).run();
        if (!v) return finish(p);
        if (body.yes && p.team && p.team === d.team) {
          v.gymCard = d.team; await save(db, v, c.t);
          out.push(WHITE + PLY + v.name + WHITE + " has been given a club card.");
          c.later.push(() => mail(db, c.t, v.id, "Gym Membership", "Your application was accepted by " + p.name + "! Welcome to the Gym!"));
        } else { out.push(T + "Application rejected."); c.later.push(() => mail(db, c.t, v.id, "Gym Membership", "Your application to the Gym was rejected.")); }
        return finish(p);
      }
      const s = await loadOther(c, q.from_id);
      if (!s) return finish(p);
      return answer(q.kind, !!body.yes, p, s, c, out, finish);
    }
    case "love/better": {   // "Do you like ... better now?" after a date or a gift
      const v = await other(body.id);
      await updateRel(c, 1, Math.min(2, Math.max(1, Math.trunc(+body.steps) || 1)), p, v, { noSelfMail: true });
      out.push(WHITE + "Nice feeling!");
      return finish(p);
    }
    // ---------------------------------------------------------------- Home Sweet Home (HOME.PAS)
    case "home/info": {
      const kids = await myChildren(db, p.id);
      return finish(p, { spouse: await spouseName(db, p), children: kids.filter(ch => ch.named).map(ch => childView(ch, p.id)) });
    }
    case "home/family": {   // ask your spouse for a quiet evening at home (and perhaps a baby)
      noFight();
      if (!p.spouse) { out.push(RED + "You are not married!"); return finish(p); }
      const v = await other(p.spouse);
      if ((p.intimacy ?? P3.intimacyActs) < 1) { out.push(RED + "You have no intimate sessions left today."); return finish(p); }
      if ((await onlineIds(db)).has(v.id)) { out.push(RED + "Not right now. " + PLY + v.name + RED + " is busy."); return finish(p); }
      await request(c, v.id, p.id, "family");
      p.intimacy--;
      out.push(WHITE + "You will have to wait and see if " + PLY + v.name + WHITE + " is in", WHITE + "the mood for a quiet evening at home with you.",
        WHITE + "Leaving a |09note" + WHITE + " to " + PLY + v.name + WHITE + "...", GOLD + "Done!");
      return finish(p);
    }
    case "home/party": {   // the nursery: a party for your children and a random bunch of kids
      noFight();
      return kidParty(p, c, out, finish);
    }
    case "home/child": {   // the nursery and custody: send to the Royal Orphanage, share custody, abandon
      noFight();
      const r = await db.prepare("SELECT * FROM usurper_children WHERE id = ? AND deleted = 0").bind(Math.trunc(+body.id)).first();
      if (!r) ctx.fail("No such child.");
      const ch = childRow(r);
      if (!isParent(ch, p.id) || !ch.named) ctx.fail("That isn't your child.");
      const op = String(body.op || "");
      if (op === "orphanage") {
        if (ch.location !== 0) { out.push(RED + ch.name + " is locked up in the Royal Orphanage!"); return finish(p); }
        if (ch.health) { out.push(RED + ch.name + " can't get up from " + childHis(ch) + " bed!"); return finish(p); }
        if (!hasAccess(ch, p.id)) { out.push(RED + "You don't have custody of " + ch.name + "."); return finish(p); }
        ch.location = 1; await saveChild(db, ch);
        out.push(WHITE + "Done.", KIDC + ch.name + T + " cries when " + childHe(ch) + " is dragged out by the royal servants.", KIDC + ch.name + T + " is promptly sent to the Royal Castle.",
          T + "(you are a cruel " + (p.sex === 2 ? "mother" : "father") + "!)");
        const k = await loadKing(c);
        if (k.id) c.later.push(() => mail(db, c.t, k.id, "Child Arrival", p.name + " sent " + his(p) + " " + sonDau(ch) + " " + ch.name + " to the Royal Orphanage.", "You are now responsible for this brat."));
        const o = ch.mother_id === p.id ? ch.father_id : ch.mother_id;
        if (o) c.later.push(() => mail(db, c.t, o, "Your child is gone!", p.name + " sent your " + sonDau(ch) + " " + ch.name + " to the Royal Orphanage.", ch.name + " wants to return home!"));
        c.later.push(() => news(db, c.t, "Evil Parents", " " + PLY + p.name + T + " sent " + his(p) + " " + sonDau(ch) + " " + KIDC + ch.name + T + " to the Royal Orphanage."));
        return finish(p);
      }
      if (op === "share") {   // give the other parent access again (nice)
        const o = ch.mother_id === p.id ? "fatherAccess" : "motherAccess";
        if (!hasAccess(ch, p.id)) { out.push(RED + "You don't have custody of " + ch.name + " yourself."); return finish(p); }
        if (ch[o] || !(ch.mother_id === p.id ? ch.father_id : ch.mother_id)) { out.push(T + "Nobody else is waiting for custody of " + ch.name + "."); return finish(p); }
        ch[o] = true; await saveChild(db, ch);
        const oid = ch.mother_id === p.id ? ch.father_id : ch.mother_id;
        p.chiv += 10;
        out.push(WHITE + "You share the custody of " + KIDC + ch.name + WHITE + " with " + PLY + (ch.mother_id === p.id ? ch.father : ch.mother) + WHITE + ".", T + "Your soul lightens!");
        c.later.push(() => mail(db, c.t, oid, "Custody", p.name + " is sharing the custody of " + ch.name + " with you."));
        return finish(p);
      }
      if (op === "abandon") {   // reject the child (bad)
        if (!hasAccess(ch, p.id)) { out.push(RED + "You don't have custody of " + ch.name + "."); return finish(p); }
        if (ch.mother_id === p.id) ch.motherAccess = false; else ch.fatherAccess = false;
        if (!ch.motherAccess && !ch.fatherAccess) ch.location = 1;
        await saveChild(db, ch);
        p.dark += 25;
        out.push(RED + "You turn your back on " + KIDC + ch.name + RED + ".", T + "Your soul darkens!");
        c.later.push(() => news(db, c.t, "Abandoned!", " " + PLY + p.name + T + " abandoned " + his(p) + " " + sonDau(ch) + " " + KIDC + ch.name + T + "!"));
        return finish(p);
      }
      ctx.fail("Unknown command.");
    }
    case "home/sleep": {   // go to sleep at home: nobody gets to you there
      noFight();
      p.location = LOC_HOME;
      out.push(T + "You lock the door and go to sleep in your own bed.");
      c.later.push(() => news(db, c.t, "Home sweet home", " " + PLY + p.name + T + " fell asleep at home."));
      return finish(p, { slept: true });
    }
  }
  return null;
}

// Personal_Relations + Summary_of_Player_Relations
async function relationList(db, v) {
  const rows = (await db.prepare("SELECT r.*, pa.name na, pb.name nb FROM usurper_relations r JOIN usurper_players pa ON pa.user_id = r.a JOIN usurper_players pb ON pb.user_id = r.b WHERE (r.a = ?1 OR r.b = ?1) AND (r.ab != 70 OR r.ba != 70) LIMIT 40").bind(v.id).all()).results;
  const list = [], counts = {};
  for (const r of rows) {
    const me = r.a === v.id, oname = me ? r.nb : r.na, mine = me ? r.ab : r.ba, theirs = me ? r.ba : r.ab;
    list.push({ name: oname, mine: REL_NAME[mine], theirs: REL_NAME[theirs], l1: relText(mine, v.name, oname, 2), l2: relText(theirs, oname, v.name, 2) });
    counts[theirs] = (counts[theirs] || 0) + 1;
  }
  const n = k => counts[k] || 0, sum = [];
  if (n(20)) sum.push(WHITE + cs(n(20)) + T + (n(20) === 1 ? " person loves " : " people love ") + "#!");
  if (n(30)) sum.push(WHITE + cs(n(30)) + T + (n(30) === 1 ? " person likes # very much." : " people like # very much."));
  if (n(40)) sum.push(T + "# ha$ " + WHITE + cs(n(40)) + T + (n(40) === 1 ? " friend." : " friends."));
  if (n(50)) sum.push(WHITE + cs(n(50)) + T + (n(50) === 1 ? " person trusts #." : " people trust #."));
  if (n(60)) sum.push(WHITE + cs(n(60)) + T + (n(60) === 1 ? " person respects #." : " people respect #."));
  if (n(80)) sum.push(WHITE + cs(n(80)) + T + (n(80) === 1 ? " person is suspicious of #." : " people are suspicious of #."));
  if (n(90)) sum.push(WHITE + cs(n(90)) + T + (n(90) === 1 ? " person is angry with #." : " people are angry with #."));
  if (n(100)) sum.push(T + "# ha$ " + WHITE + cs(n(100)) + T + (n(100) === 1 ? " enemy." : " enemies."));
  if (n(110)) sum.push(RED + cs(n(110)) + T + (n(110) === 1 ? " person hates #!" : " people hate #!"));
  return { relations: { who: v.name, list, summary: sum } };
}

// The answers to dates, flowers, boxes and family time (MAIL.PAS).
async function answer(kind, yes, p, s, c, out, finish) {
  const db = c.db;
  const xp = (a, b) => Math.max(100, Math.floor((p.level * a + s.level * b) / 2));
  if (kind === "hold" || kind === "dinner" || kind === "kiss") {
    if (!yes) {
      c.later.push(() => mail(db, c.t, s.id, "Crushed Dreams", p.name + (kind === "hold" ? " declined to go out with you!" : kind === "dinner" ? " declined to have dinner with you!" : " refused to be kissed by you!")));
      out.push(T + "You turn " + PLY + s.name + T + " down.");
      return finish(p);
    }
    const x = kind === "hold" ? xp(185, 95) : kind === "dinner" ? xp(95, 185) : xp(55, 138);
    if (kind === "hold") out.push(T + "You go out with " + PLY + s.name + T + " and have a great time!");
    else if (kind === "dinner") out.push(T + "You go out and have dinner with " + PLY + s.name + T + "!");
    else out.push(PLY + s.name + T + " kissed you on the lips!", T + "Great feeling!");
    out.push(T + "You earn " + WHITE + cs(x) + T + " experience points!");
    p.exp += x; await bump(db, s.id, "exp", x);
    await jealousy(c, p, s);
    if (kind === "hold") c.later.push(() => news(db, c.t, "Dating", " " + PLY + p.name + T + " and " + PLY + s.name + T + " were seen together today.", " The two of them were holding hands on a park bench."));
    else if (kind === "dinner") c.later.push(() => news(db, c.t, "Date", " " + PLY + p.name + T + " and " + PLY + s.name + T + " had dinner."));
    else c.later.push(() => news(db, c.t, "Romance", " " + PLY + s.name + T + " kissed " + PLY + p.name + T + "."));
    const m = { hold: ["Holding Hands", " accepted your invitation to go out.", "You had a wonderful time together."], dinner: ["Dinner", " accepted your invitation to have dinner.", "You spent the evening together."],
      kiss: ["Kissing", " kissed you!", "You spent the evening together."] }[kind];
    c.later.push(() => mail(db, c.t, s.id, m[0], p.name + m[1], m[2], "You earned " + cs(x) + " experience points."));
    return finish(p, { liked: { id: s.id, steps: 1 } });
  }
  if (kind === "roses") {
    if (!yes) { out.push(T + "You throw the flowers away."); c.later.push(() => mail(db, c.t, s.id, "Crushed Dreams", p.name + " threw your flowers away!")); return finish(p); }
    await jealousy(c, p, s);
    const x = xp(85, 85);
    out.push(T + "You accept the flowers from " + PLY + s.name + T + "!", WHITE + "They smell beautiful!", T + "You both earn " + WHITE + cs(x) + T + " experience points!");
    p.exp += x; await bump(db, s.id, "exp", x);
    c.later.push(() => news(db, c.t, "Flowers", " " + PLY + p.name + T + " received flowers from a secret admirer."));
    c.later.push(() => mail(db, c.t, s.id, "Flowers", p.name + " accepted your flowers!", "You earned " + cs(x) + " experience points."));
    return finish(p, { liked: { id: s.id, steps: 2 } });
  }
  if (kind === "chocolate" || kind === "scorpions") {
    if (!yes) { out.push(T + "You leave the box unopened."); return finish(p); }
    out.push(T + "You put your hand in the box...and out comes....");
    if (kind === "chocolate") {
      const x = xp(185, 95);
      out.push(WHITE + "a box of Chocolates" + T + "!");
      p.exp += x;
      out.push(T + "You earn " + WHITE + cs(x) + T + " experience points!");
      await jealousy(c, p, s);
      c.later.push(() => news(db, c.t, "Sweet Gift", " " + PLY + p.name + T + " gobbled a " + WHITE + "Box of Chocolates" + T + " coming", " from " + PLY + s.name + T + "."));
      return finish(p, { liked: { id: s.id, steps: 1 } });
    }
    out.push(RED + "SCORPIONS!" + WHITE + "!!!", RED + "You have been bitten several times...it's too late...!", "|07Darkness...");
    p.hps = 0; p.allowed = false;
    c.later.push(() => news(db, c.t, "Deadly Gift", " " + PLY + p.name + T + " put " + his(p) + " hand in a box with " + MON + "Scorpions" + T + "!", " " + PLY + p.name + T + " was badly bitten...it proved " + RED + "fatal" + T + "."));
    c.later.push(() => mail(db, c.t, s.id, "Scorpions at Work", p.name + " put " + his(p) + " hand in the box filled with scorpions!", p.name + " died immediately from the poison.", "Your gift was a success!"));
    c.later.push(() => mail(db, c.t, p.id, "Your Death", "Fool! You put your hand in a box filled with Scorpions!", "Remember that it's pay-back time to " + s.name + ", who sent you the package!"));
    return finish(p, { dead: true });
  }
  if (kind === "family") {   // a quiet evening at home with your spouse (HOME.PAS, see docs/USURPER.md)
    if (!yes || p.spouse !== s.id) {
      out.push(T + "Not tonight.");
      c.later.push(() => mail(db, c.t, s.id, "Not Tonight", p.name + " wasn't in the mood."));
      return finish(p);
    }
    const x = p.level * 110 + s.level * 90;
    p.exp += x; await bump(db, s.id, "exp", x);
    out.push(T + "You and " + PLY + s.name + T + " spend a quiet evening together at home.", T + "You earned " + WHITE + cs(x) + T + " experience points!");
    c.later.push(() => news(db, c.t, "Home Sweet Home", " " + PLY + p.name + T + " and " + PLY + s.name + T + " spent a quiet evening at home."));
    // Sex_Act_Routine's baby rules: a man and a woman, nobody pregnant already, a mother of the right age
    const mom = p.sex === 2 ? p : s.sex === 2 ? s : null, dad = mom === p ? s : p;
    let line = "You spent a quiet evening at home with " + p.name + ". You earned " + cs(x) + " experience points.";
    if (mom && dad.sex === 1 && !(mom.pregnancy > 0) && mom.age >= P3.motherAge[0] && mom.age <= P3.motherAge[1] && (mom.kids || 0) < P3.maxKids && random(3) === 0) {
      if (mom === p) { p.pregnancy = 1; p.fatherId = s.id; out.push(WHITE + "You are pregnant!"); line += " " + p.name + " is pregnant!"; }
      else {
        await db.prepare("UPDATE usurper_players SET data = json_set(data, '$.pregnancy', 1, '$.fatherId', ?) WHERE user_id = ?").bind(p.id, s.id).run();
        out.push(WHITE + s.name + " is pregnant!"); line += " You are pregnant!";
      }
      c.later.push(() => news(db, c.t, "Pregnancy", " " + PLY + mom.name + T + " is going to have a baby!", " " + PLY + dad.name + T + " is going to be a father!"));
    }
    c.later.push(() => mail(db, c.t, s.id, "Family", line));
    return finish(p);
  }
  return finish(p);
}

// The nursery's party (HOME.PAS 'P', random invitations): the kids play until only one
// family's children are left standing; your family shares the bonus.
async function kidParty(p, c, out, finish) {
  const db = c.db;
  if ((p.chivnr ?? 0) < 1) { out.push(RED + "You are too tired."); return finish(p); }
  const mine = (await myChildren(db, p.id)).filter(ch => ch.named && !ch.health && ch.location === 0).slice(0, 5);
  if (!mine.length) { out.push(RED + "You have no kids available."); return finish(p); }
  const others = (await db.prepare("SELECT * FROM usurper_children WHERE deleted = 0 AND name != '' AND location = 0 AND coalesce(mother_id, 0) != ?1 AND coalesce(father_id, 0) != ?1 ORDER BY random() LIMIT ?2")
    .bind(p.id, 10 - mine.length).all()).results.map(childRow).filter(ch => !ch.health);
  if (!others.length) { out.push(RED + "Not enough kids active to have a party!"); return finish(p); }
  p.chivnr--;
  const kids = [...mine, ...others], str = kids.map(k => k.age * 2), nemesis = [], wins = [];
  out.push(HEAD + "The children play games", "|02=-=-=-=-=-=-=-=-=-=-=-=");
  const log = [];
  for (let round = 0; round < 50; round++) {
    let any = false;
    for (let i = 0; i < kids.length; i++) {
      if (str[i] < 1) continue;
      const j = kids.findIndex((k, jj) => jj !== i && str[jj] > 0 && k.mother_id !== kids[i].mother_id && k.father_id !== kids[i].father_id);
      if (j < 0) continue;
      any = true;
      const a = kids[i], b = kids[j];
      const mean = (a.soul > 0 ? random(3) : random(2)) === 0;
      if (mean) {
        log.push(KIDC + a.name + T + pick([" makes faces at ", RED + " kicks ", " pokes ", RED + " pours milk over "]) + KIDC + b.name + T + "!");
        a.soul = Math.max(-500, a.soul - 5);
        if (--str[j] < 1) { log.push(RED + b.name + " bursts into tears (crawls back to mama)."); nemesis[j] = a.name; wins[i] = b.name; }
      } else {
        log.push(KIDC + a.name + T + pick([" plays with ", " hugs ", " gives a toy to ", " plays with ", " shares a cookie with "]) + KIDC + b.name + T + ".");
        a.soul = Math.min(500, a.soul + 5);
      }
    }
    if (!any) break;
  }
  out.push(...log.slice(0, 10));
  if (log.length > 10) out.push(T + "... and so it goes on for a while ...", ...log.slice(-3));
  out.push("", GOLD + "Party is over for the kids...");
  let left = 0, whiners = 0;
  const fates = [];
  kids.forEach((k, i) => {
    if (i >= mine.length) return;
    if (str[i] > 0) { left++; fates.push(KIDC + k.name + T + " did well."); } else { whiners++; fates.push("Your " + sonDau(k) + " " + KIDC + k.name + T + " was bullied by " + KIDC + nemesis[i] + T + "."); }
  });
  out.push(...fates);
  if (!left) out.push(RED + "Your kids are whiners! They didn't make it all the way!", RED + "You get no bonus for this miserable result!");
  else {
    let x = left * 500;
    out.push(GOLD + (whiners ? "Nice! Some of your kids whimpered, but on the whole you can be proud." : "Great work! Your kids did well all they way!"),
      WHITE + "You deserve a BONUS. Your family gets " + cs(x) + " experience points for this feat.");
    x = Math.floor(x / 2);
    out.push(T + "Your share is " + WHITE + cs(x) + T + " points.");
    p.exp += x;
    if (p.spouse) { await bump(db, p.spouse, "exp", x); c.later.push(() => mail(db, c.t, p.spouse, "Your Children", "From your childrens participation in a party held by your " + (p.sex === 2 ? "wife" : "husband") + " " + p.name, "You earn " + cs(x) + " experience points!")); }
  }
  await db.batch(kids.map(k => childStmt(db, k)));
  const lines = kids.slice(0, 8).map((k, i) => str[i] > 0 ? " " + KIDC + k.name + T + " enjoyed the activities" + (wins[i] ? " (especially teasing " + KIDC + wins[i] + T + ")." : ".") : " " + KIDC + k.name + T + " was bullied by " + KIDC + nemesis[i] + T + "!");
  c.later.push(() => news(db, c.t, "Childrens Party", " " + PLY + p.name + T + " arranged a party for some of the Children.", ...lines));
  for (const k of others) for (const id of [k.mother_id, k.father_id]) if (id) c.later.push(() => mail(db, c.t, id, "Childrens Party", p.name + " arranged a party for some of the children.", k.name + (str[kids.indexOf(k)] > 0 ? " had a great time." : " came home crying.")));
  return finish(p);
}

// ================================================================== the Supreme Being (SUPREMEC.PAS)
// The three doors, the cup on the altar and the final fight, for characters of level 100.
export async function supremeAction(action, body, p, c, ctx, out, finish) {
  if (action === "supreme/doors") {
    if (p.level < 100 || p.fight) ctx.fail("You are not ready for the final quest.");
    const door = String(body.door || "").toUpperCase(), it = {};
    out.push(T + "Krreeek........the rusty door opens");
    if (door === "G") {
      out.push("|11The Old Woman");
      if (p.dark > 0) out.push(T + "\"I see that your soul is dark!\", the old woman cackles.", T + "\"I will not help a sinner like you!\", she says and disappears.");
      else if (body.give) {
        if (p.healing >= 25) { p.healing -= 25; it.lantern = true; out.push(T + "You give the potions to the old woman.", T + "In return she gives you a dusty old lantern.", WHITE + "\"This will help you survive your quest!\"", T + "The woman says before she suddenly disappears in a puff of smoke."); }
        else out.push(T + "You don't have that many potions!", T + "The old woman shakes her head and leaves.", T + "Somehow you feel uncomfortable...as if you just", T + "missed a great opportunity.");
      } else out.push(WHITE + "\"You will be sorry for this adventurer!\"" + T + ", the old woman screams.");
    } else if (door === "S") {
      out.push("|11The Red Turtle");
      if (p.chiv > 0) out.push(WHITE + "\"You have done some good in your life!\"" + T + ", the turtle says.", WHITE + "\"I can't help you just now...\"" + T + ", he says and crawls away.");
      else if (body.listen) {
        const a1 = Math.trunc(+body.a1), a2 = Math.trunc(+body.a2);
        out.push(WHITE + "1. How many level masters are there in your town: " + T + a1, WHITE + (a1 === 10 ? "\"Right!\"" : "\"Wrong!\""));
        if (a1 === 10) { out.push(WHITE + "2. How old are you?: " + T + a2, WHITE + (a2 === p.age ? "\"Right!\"" : "\"Wrong!\"")); }
        if (a1 === 10 && a2 === p.age) { it.sword = true; out.push("", WHITE + "\"You have answered the questions correctly.\"", WHITE + "\"Take this Black Sword, it will help you in your quest.\""); }
      } else out.push(WHITE + "\"Suit yourself mortal...\"" + T + ", the turtle mutters as it crawls away.");
    } else if (door === "B") {
      out.push("|11The Oracle", WHITE + "\"Greetings adventurer...You may have one of my staffs\"");
      if (String(body.staff).toUpperCase() === "W") { it.wstaff = true; out.push(WHITE + "\"The White Staff!\""); } else { it.bstaff = true; out.push(WHITE + "\"The Black Staff!\""); }
    } else ctx.fail("Pick a door.");
    p.supreme = it;
    return finish(p);
  }
  if (action === "supreme/cup") {
    if (p.level < 100 || p.fight) ctx.fail("You are not ready for the final quest.");
    if (body.drink) {
      out.push(T + "Klunk..klunk..klunk..klunk..klunk....ahh..");
      if (random(4) === 0) { out.push(T + "Poison!! You lose many hitpoints!"); p.hps = 1; }
      else { const gain = Math.max(0, Math.min(500, 32000 - p.maxhps)); p.maxhps += gain; p.hps = p.maxhps; out.push(T + "Power Booster! Your hitpoints increase by 500!"); }
    }
    out.push("", "|04The Being watches you..");
    p.fight = { mode: "dng", purpose: "supreme", dl: 100, toDeath: false, items: p.supreme || {},
      mons: [{ name: "Supreme Being", str: p.str * 3, hps: p.str * 9, max: p.str * 9, def: 0, ml: 0, mana: 0, spells: 0, ph: "", res: 100, poisoned: false, hold: 0 }] };
    delete p.supreme;
    p.ward = 0;
    return finish(p);
  }
  if (action === "supreme/after") {   // Become a God, or Rest In Peace
    if (!p.completed) ctx.fail("Your quest is not over.");
    if (String(body.choice).toUpperCase() === "B") {
      const alias = clean(body.name, 22).replace(/[^A-Za-z0-9 '\-]/g, "").trim();
      if (alias.length < 3) ctx.fail("Your divine name must have at least 3 letters.");
      if (/^(sysop|manwe)$/i.test(alias) || await c.db.prepare("SELECT id FROM usurper_gods WHERE name = ? AND deleted = 0").bind(alias).first()) ctx.fail("I'm sorry, but this name is already being used.");
      await c.db.prepare("INSERT INTO usurper_gods (user_id, name, sex, level, exp, deeds, day, darkness, goodness, created) VALUES (?, ?, ?, 1, 1, 5, ?, ?, ?, ?)")
        .bind(ctx.user.id, alias, p.sex, today(), p.dark || 0, p.chiv || 0, today()).run();
      out.push(T + "You ascend to Heaven...", T + "You grovel on your hands and knees before the great |10Manwe" + T + ".", "", "|10" + alias + T + " has entered the Divine Realm!");
      c.later.push(() => news(c.db, c.t, "Divinity!", " |10" + alias + T + " became immortal and entered the Divine Realm!"));
      c.later.push(() => history(c, "holy", "|10" + alias + T + " became Immortal! " + "|10" + alias + T + " defeated the Supreme Being!"));
    } else out.push(T + "Having completed your ultimate mission you feel that", T + "your career has come to an end. With a deep sigh you lay", T + "down on the slippery stones and close your eyes...", "", T + "Darkness forever...");
    await retire(p, c);
    for (const fn of c.later.splice(0)) await fn();
    return { out, p: null, retired: true, god: String(body.choice).toUpperCase() === "B" };
  }
  return null;
}
// The monster's blow in the final fight, and what the door gifts do (PLVSMON.PAS mode 3)
export function supremeCharge(p, f, m, out) {
  m.punch = random(p.maxhps) + 3;
  const it = f.items || {};
  if (it.sword) { out.push(WHITE + "The Black Sword attacks the Supreme Being!"); m.hps -= 75; }
  else if (it.lantern) { out.push(WHITE + "The Lantern starts to glow before you!"); m.punch = Math.floor(m.punch / 2); }
  else if (it.wstaff) { out.push(WHITE + "The White Staff starts to glow before you!"); m.punch = Math.max(0, m.punch - 50); }
  else if (it.bstaff) out.push(WHITE + "The Black Staff increases your strength!");
}
export async function purposeDone3(p, f, c, out, how) {
  if (f.purpose === "event") return eventDone(p, f, c, out, how);
  if (how === "died") {
    out.push(T + "You have been slain!");
    c.later.push(() => news(c.db, c.t, "Tragic!", " " + PLY + p.name + T + " encountered the " + RED + "Supreme Being" + T + " and was", " destroyed. May the brutal monster be defeated soon."));
    c.later.push(() => mail(c.db, c.t, p.id, "*The Final Quest*", "You were slain by the Supreme Being!"));
    return;
  }
  if (how !== "won") return;
  out.push("", GOLD + "You have defeated the Supreme Being!");
  c.later.push(() => news(c.db, c.t, "|14Heroic Deed!", " " + PLY + p.name + T + " encountered the " + RED + "Supreme Being" + T + " and won!", " " + PLY + p.name + T + " ended " + his(p) + " career with", " a brilliant victory!"));
  c.later.push(() => history(c, "heroes", PLY + p.name + T + " completed the game. (" + CLASSES[p.cls] + ", " + RACES[p.race] + ")" + (p.kids ? " (" + cs(p.kids) + " children)" : "")));
  if (p.god) {
    const g = await c.db.prepare("SELECT id FROM usurper_gods WHERE id = ?").bind(p.god).first();
    if (g) c.later.push(() => mail(c.db, c.t, -g.id, "Disciple Gone!", p.name + " completed the Final Quest!", "Your disciple has joined you in Heaven!"));
  }
  p.completed = true;
  p.allowed = false;
}
// deactivate_player: the character leaves the game for good.
async function retire(p, c) {
  const db = c.db;
  if (p.king) {
    const k = await loadKing(c);
    for (const g of k.guards) c.later.push(() => mail(db, c.t, g.id, "Sacked!", "The " + kingString(p.sex) + " has left the realm. You are no longer a Royal Guard."));
    await db.prepare("UPDATE usurper_monarchs SET ended = ?, how = 'completed the last quest' WHERE user_id = ? AND ended IS NULL").bind(today(), p.id).run();
    const fresh = { name: "", id: null, sex: 1, race: 0, days: 0, tax: 0, taxAlign: 0, treasury: k.treasury, prisonsLeft: 4, executeLeft: 3, questsLeft: CFG.questsPerDay, moat: null, moatNr: 0, guards: [], apps: [], day: today() };
    await saveKing(c, fresh);
    c.later.push(() => news(db, c.t, "Royal News", " " + kingString(p.sex) + " " + KC + p.name + T + " completed " + his(p) + " last quest and abdicated."));
  }
  if (p.spouse) await db.prepare("UPDATE usurper_players SET data = json_remove(data, '$.spouse') WHERE user_id = ?").bind(p.spouse).run();
  await db.prepare("DELETE FROM usurper_requests WHERE to_id = ? OR from_id = ?").bind(p.id, p.id).run();
  await db.prepare("DELETE FROM usurper_players WHERE user_id = ?").bind(p.id).run();
}

// ================================================================== the Gods (VARGODS.PAS, TEMPLE.PAS, GODWORLD.PAS)
const GODC = "|10";
const GOD_TITLES = ["Lesser Spirit", "Minor Spirit", "Spirit", "Major Spirit", "Minor Deity", "Deity", "Major Deity", "DemiGod", "God"];
function godLevelFor(exp) {   // God_Level_Raise
  return exp > 1000500 ? 9 : exp > 550000 ? 8 : exp > 110000 ? 7 : exp > 90000 ? 6 : exp > 70000 ? 5 : exp > 50000 ? 4 : exp > 15000 ? 3 : exp > 5000 ? 2 : 1;
}
function sacrificeReturn(g) {   // Sacrifice_Gold_Return
  return g <= 20 ? 1 : g <= 2000 ? 2 : g <= 45000 ? 3 : g <= 150000 ? 4 : g <= 900000 ? 5 : g <= 15000000 ? 6 : g <= 110000000 ? 7 : 8;
}
export async function godName(db, userId) {
  const g = await db.prepare("SELECT name FROM usurper_gods WHERE user_id = ? AND deleted = 0").bind(userId).first();
  return g ? g.name : null;
}
async function believers(db, godId) {
  return (await db.prepare("SELECT COUNT(*) n FROM usurper_players WHERE json_extract(data, '$.god') = ?").bind(godId).first()).n;
}
async function loadGod(c, id) {   // with God_Maintenance applied lazily: new deeds, and power from the believers
  const g = await c.db.prepare("SELECT * FROM usurper_gods WHERE id = ? AND deleted = 0").bind(id).first();
  if (!g) return null;
  if (g.day !== today()) {
    const n = Math.max(1, Math.min(30, dayDiff(g.day || today(), today())));
    g.exp += (await believers(c.db, g.id)) * n;
    g.deeds = 5; g.day = today();
    await c.db.prepare("UPDATE usurper_gods SET exp = ?, deeds = ?, day = ? WHERE id = ?").bind(g.exp, g.deeds, g.day, g.id).run();
  }
  return g;
}
async function godExp(c, id, x) { await c.db.prepare("UPDATE usurper_gods SET exp = max(0, exp + ?) WHERE id = ?").bind(x, id).run(); }
async function godList(db) {
  const rows = (await db.prepare("SELECT g.id, g.name, g.level, g.exp, g.sex, (SELECT COUNT(*) FROM usurper_players p WHERE json_extract(p.data, '$.god') = g.id) believers FROM usurper_gods g WHERE g.deleted = 0 ORDER BY g.exp DESC LIMIT 30").all()).results;
  return rows.map(g => ({ id: g.id, name: g.name, level: g.level, title: GOD_TITLES[g.level - 1], exp: g.exp, believers: g.believers, sex: g.sex }));
}
async function informDisciples(c, g, head, ...lines) {
  const rows = (await c.db.prepare("SELECT user_id FROM usurper_players WHERE json_extract(data, '$.god') = ? LIMIT 20").bind(g.id).all()).results;
  for (const r of rows) c.later.push(() => mail(c.db, c.t, r.user_id, head, ...lines));
}

// The Temple of the Gods, for mortals (TEMPLE.PAS); reached from Challenges as the Altar of the Gods.
export async function templeAction(action, body, p, c, ctx, out, finish) {
  const db = c.db;
  if (p.god && !(await db.prepare("SELECT id FROM usurper_gods WHERE id = ? AND deleted = 0").bind(p.god).first())) p.god = null;
  const myGod = p.god ? (await db.prepare("SELECT name FROM usurper_gods WHERE id = ?").bind(p.god).first()).name : "";
  const pickGod = async () => { const g = await loadGod(c, Math.trunc(+body.god)); if (!g) ctx.fail("No such God."); return g; };
  switch (action) {
    case "temple/info": return finish(p, { god: myGod, gods: await godList(db) });
    case "temple/worship": {
      if (p.god && !body.abandon) ctx.fail("You already worship " + myGod + ".");
      if (p.god) {   // lost faith
        const note = clean(body.note, 70) || pick(["You are not my God!", "farewell..", "never again will I follow you!"]);
        out.push(T + "You don't believe in " + GODC + myGod + T + " anymore.", GODC + myGod + "s" + T + " powers diminish...");
        const gid = p.god;
        c.later.push(() => mail(db, c.t, -gid, "Lost Believer", p.name + " lost faith in you!", p.name + " became a pagan.", "Goodbye note from " + p.name + ":", note));
        c.later.push(() => news(db, c.t, "Pagan", " " + PLY + p.name + T + " lost faith in " + GODC + myGod + T + ".", " " + PLY + p.name + T + ", the " + RACES[p.race] + ", became a pagan."));
        p.god = null;
        if (!body.god) return finish(p);
      }
      const g = await pickGod();
      p.god = g.id;
      out.push(WHITE + "Ok.", T + "You raise your hands and pray to the almighty " + GODC + g.name + T, T + "for forgiveness...", T + "You are now a believer in " + GODC + g.name + T + "!");
      c.later.push(() => mail(db, c.t, -g.id, "New Believer", p.name + " worships you!"));
      c.later.push(() => news(db, c.t, "New Believer", " " + PLY + p.name + T + " found faith in " + GODC + g.name + T + "."));
      return finish(p);
    }
    case "temple/sacrifice": {   // contribute_to_god: gold
      if ((p.chivnr ?? 0) < 1) { out.push(RED + "You have no good deeds left today."); return finish(p); }
      const g = await pickGod();
      const x = Math.max(0, Math.min(Math.trunc(+body.gold) || 0, p.gold));
      if (x < 1) { out.push(RED + "You have no gold!"); return finish(p); }
      p.gold -= x; p.chivnr--;
      const y = sacrificeReturn(x);
      await godExp(c, g.id, y);
      out.push(T + GODC + g.name + "s" + T + " power is growing!", T + "You can feel it...Your reward will come.", T + "You have " + WHITE + cs(p.chivnr) + T + " Good Deeds left today.");
      const wrong = p.god && p.god !== g.id;
      c.later.push(() => mail(db, c.t, -g.id, wrong ? "Unexpected Sacrifice!" : "Sacrifice!", p.name + " sacrificed " + cs(x) + " gold on your altar!", "Your power increased by " + cs(y) + " point(s)!",
        p.god === g.id ? "" : wrong ? p.name + " is a believer in " + myGod + "." : p.name + " is NOT one of your disciples."));
      if (wrong) c.later.push(() => mail(db, c.t, -p.god, "Treacherous Mortal", p.name + " sacrificed gold at the altar of " + g.name + "!", "You should punish the disloyal " + p.name + " immediately!"));
      c.later.push(() => news(db, c.t, "Altar Sacrifice", " " + PLY + p.name + T + " sacrificed " + GOLD + cs(x) + T + " gold at the altar of " + GODC + g.name + T + "."));
      return finish(p);
    }
    case "temple/desecrate": {
      if ((p.darknr ?? 0) < 1) { out.push(RED + "You have no dark deeds left today."); return finish(p); }
      const g = await pickGod();
      if (p.god === g.id) { out.push(RED + "You are not allowed to abuse your own God!"); return finish(p); }
      out.push(T + "When nobody is around You start to", ...(random(2) ? [T + "pound away at the altar with a pickaxe.", RED + "Hack....hack....hack....hack....!"] : [T + "stomp the flowers, trash the ornament", T + "and pulverize the candles.", RED + "Stomp....trash....stomp....trash....!"]),
        "", WHITE + "Good Work Evil One!", WHITE + "The power of " + GODC + g.name + WHITE + " is diminishing!", WHITE + "But beware! You may have to pay a dear price for your folly.");
      const x = p.level * 600;
      p.exp += x; p.dark += p.level * 15; p.darknr--;
      out.push(GOLD + "You receive " + WHITE + cs(x) + GOLD + " experience points for this act.");
      const y = random(3) + 3;
      await godExp(c, g.id, -y);
      c.later.push(() => news(db, c.t, "Altar desecrated!", " Infamous actions were taken at the altar of " + GODC + g.name + T + ".", " The place was desecrated by evil-doers."));
      c.later.push(() => mail(db, c.t, -g.id, "UNFORGIVABLE ACT!", p.name + " desecrated your altar!", "Your powers went down by " + cs(y) + " points."));
      await informDisciples(c, g, "ALTAR DESECRATED!", p.name + " desecrated the altar of " + g.name + ", your god!", "You must protect your master!");
      return finish(p);
    }
    case "temple/holynews": {
      const rows = (await db.prepare("SELECT day, body FROM usurper_history WHERE kind IN ('holy', 'heroes') ORDER BY id DESC LIMIT 16").all()).results;
      return finish(p, { history: rows });
    }
  }
  return null;
}

// The Divine Realm, played by the Immortals (GODWORLD.PAS). They have no mortal character row.
export async function godAction(action, body, ctx) {
  const db = ctx.db, c = { db, t: ctx.now(), later: [] }, out = [];
  const row = await db.prepare("SELECT id FROM usurper_gods WHERE user_id = ? AND deleted = 0").bind(ctx.user.id).first();
  if (!row) ctx.fail("You have no Divine Character! Enter the Mortal world and EARN your place in heaven!");
  const g = await loadGod(c, row.id);
  const done = async (extra = {}) => {
    await db.prepare("UPDATE usurper_gods SET exp = ?, deeds = ?, level = ? WHERE id = ?").bind(g.exp, g.deeds, g.level, g.id).run();
    for (const fn of c.later) await fn();
    return { out, god: { id: g.id, name: g.name, level: g.level, title: GOD_TITLES[g.level - 1], exp: g.exp, deeds: g.deeds, believers: await believers(db, g.id), sex: g.sex }, ...extra };
  };
  const tired = () => { if (g.deeds < 1) { out.push(RED + "You are too tired! Come back tomorrow."); return true; } return false; };
  const mortal = async id => { const v = await loadOther(c, Math.trunc(+id)); if (!v) ctx.fail("Couldn't locate that character."); return v; };
  switch (action) {
    case "god/enter": {
      const mails = (await db.prepare("SELECT id, head, body FROM usurper_mail WHERE to_id = ? AND seen = 0 ORDER BY id LIMIT 30").bind(-g.id).all()).results;
      if (mails.length) await db.prepare("UPDATE usurper_mail SET seen = 1 WHERE to_id = ? AND id <= ?").bind(-g.id, mails[mails.length - 1].id).run();
      return done({ mail: mails });
    }
    case "god/status": return done();
    case "god/list": return done({ gods: await godList(db) });
    case "god/believers": {
      const id = body.god ? Math.trunc(+body.god) : g.id;
      const rows = (await db.prepare("SELECT user_id, data FROM usurper_players WHERE json_extract(data, '$.god') = ? ORDER BY exp DESC LIMIT 30").bind(id).all()).results;
      return done({ flock: rows.map(r => { const q = JSON.parse(r.data); return { name: q.name, level: q.level, race: RACES[q.race], cls: CLASSES[q.cls], alive: q.hps > 0 }; }) });
    }
    case "god/examine": {
      const v = await mortal(body.id);
      const gn = v.god ? (await db.prepare("SELECT name FROM usurper_gods WHERE id = ?").bind(v.god).first() || {}).name : "";
      return done({ mortal: { name: v.name, level: v.level, race: RACES[v.race], cls: CLASSES[v.cls], hps: v.hps, maxhps: v.maxhps, gold: v.gold, bank: v.bank, chiv: v.chiv, dark: v.dark,
        god: gn || "", team: v.team || "", king: !!v.king, prison: v.location === LOC.prison, age: v.age, looks: looks(v, await spouseName(db, v)) } });
    }
    case "god/comment": {   // a statement to the Mortal World
      const s = clean(body.text, 70);
      if (!s) ctx.fail("Say something.");
      c.later.push(() => news(db, c.t, "Divine Remark", " " + GODC + g.name + T + " made a statement to the Mortal World:", " " + TALK + s));
      out.push("|11Done! Hopefully the puny earthlings will understand your message.");
      return done();
    }
    case "god/recruit": {   // Get a believer: the mortal answers next time they play
      if (tired()) return done();
      const v = await mortal(body.id);
      if (v.god === g.id) { out.push(WHITE + PLY + v.name + WHITE + " already believes in you!"); return done(); }
      g.deeds--;
      await request(c, v.id, -g.id, "immortal", { god: g.id, godName: g.name, threat: !!body.threat });
      out.push(WHITE + "Done!", T + "You will be informed of " + PLY + v.name + T + "s decision later.");
      return done();
    }
    case "god/poison": {   // poison the relation between two mortals
      if (tired()) return done();
      const a = await mortal(body.a), b = await mortal(body.b);
      if (a.id === b.id) { out.push(RED + "And I thought Immortals were smart..."); return done(); }
      g.deeds--;
      out.push(T + "You focus your powers on poisoning the souls of the victims.");
      if (random(3) === 0) {
        const s = PLY + a.name + T + " and " + PLY + b.name + T;
        out.push(WHITE + "SUCCESS!", WHITE + pick(["A note of discord crept into the relationship between " + s + WHITE + "!", s + WHITE + " distrust each other!", s + WHITE + " relationship is deteriorating!"]),
          WHITE + "Your powers increase!");
        g.exp += 20;
        await updateRel(c, -1, 2, a, b); await updateRel(c, -1, 2, b, a);
        c.later.push(() => news(db, c.t, "Disagreement", " " + PLY + a.name + T + " and " + PLY + b.name + T + " had an argument."));
      } else {
        out.push(RED + "Dang! It failed! They saw through your plot!");
        for (const v of [a, b]) if (v.god === g.id) { out.push(PLY + v.name + RED + " lost " + his(v) + " faith in you!"); v.god = null; await save(db, v, c.t); }
        c.later.push(() => news(db, c.t, "Intriguer!", " The immortal " + GODC + g.name + T + " was exposed trying to poison the relation", " between " + PLY + a.name + T + " and " + PLY + b.name + T + "."));
      }
      return done();
    }
    case "god/prisoners": {
      const rows = (await db.prepare("SELECT user_id, data FROM usurper_players WHERE location = ? LIMIT 30").bind(LOC.prison).all()).results;
      return done({ prisoners: rows.map(r => { const q = JSON.parse(r.data); return { id: r.user_id, name: q.name, level: q.level, days: q.prisonDays || 0 }; }) });
    }
    case "god/free": {   // help a prisoner escape
      if (tired()) return done();
      const v = await mortal(body.id);
      if (v.location !== LOC.prison) { out.push(PLY + v.name + RED + " is not a prisoner!"); return done(); }
      if ((await onlineIds(db)).has(v.id)) { out.push(RED + v.name + " is busy."); return done(); }
      v.location = LOC.dorm; v.prisonDays = 0; await save(db, v, c.t);
      g.deeds--; g.exp += 10;
      out.push(T + "By pure will-force you make the prison door open!", PLY + v.name + T + " escapes with your assistance!", T + "The Royals will not be pleased when they discover this.", WHITE + "Your powers increase!");
      c.later.push(() => news(db, c.t, "Prison Escape!", " " + PLY + v.name + T + " escaped from Prison!", " The mighty God " + GODC + g.name + T + " is suspected to be behind this."));
      c.later.push(() => mail(db, c.t, v.id, "Prison Escape!", "The Immortal " + g.name + " helped you escape from Prison!", "You should be grateful that your fate is of interest to the higher powers."));
      const k = await loadKing(c);
      if (k.id) c.later.push(() => mail(db, c.t, k.id, "Prisoner Escape", v.name + " escaped from Prison.", g.name + ", the Immortal, made this happen."));
      return done();
    }
    case "god/manwe": {   // ask Manwe for power
      const x = godLevelFor(g.exp);
      if (x <= g.level) { out.push(...pick([[RED + "Puny worm! You are not worthy of the higher powers!", RED + "Prove yourself before you come here!"], [RED + "Get out of my sight lesser being!", RED + "Hmmppff!"]])); return done(); }
      g.level++;
      out.push(GODC + "Manwe" + T + " looks at you and nods.", TALK + "\"Reap the rewards of your work " + GODC + g.name + TALK + "!\"", "", WHITE + "*Congratulations*", T + "You are now ranked " + WHITE + GOD_TITLES[g.level - 1]);
      c.later.push(() => news(db, c.t, "Divine Ranks!", " " + GODC + g.name + T + " has been granted a new rank; " + HI + GOD_TITLES[g.level - 1] + T + "!"));
      await informDisciples(c, g, "Your God Increased " + (g.sex === 2 ? "Her" : "His") + " Powers!", g.name + " gained a level in heaven!");
      return done();
    }
    case "god/holynews": {
      const rows = (await db.prepare("SELECT day, body FROM usurper_history WHERE kind IN ('holy', 'heroes') ORDER BY id DESC LIMIT 16").all()).results;
      return done({ history: rows });
    }
    case "god/mortals": {
      const rows = (await db.prepare("SELECT user_id, data FROM usurper_players ORDER BY exp DESC LIMIT 40").all()).results;
      return done({ mortals: rows.map(r => { const q = JSON.parse(r.data); return { id: r.user_id, name: q.name, level: q.level, race: RACES[q.race], cls: CLASSES[q.cls], alive: q.hps > 0, god: q.god || null }; }) });
    }
    case "god/find": {
      const list = await findPlayer(db, body.name, 0);
      return done({ found: list.map(q => ({ id: q.id, name: q.name, level: q.level, race: RACES[q.race], cls: CLASSES[q.cls], team: q.team || "", sex: q.sex })) });
    }
  }
  ctx.fail("Unknown command.");
}
// A mortal answers a God's recruitment (MAIL.PAS mailrequest_ImmortalOffer)
async function answerImmortal(q, yes, p, c, out, finish) {
  const d = JSON.parse(q.data || "{}"), g = await loadGod(c, d.god);
  if (!g) { out.push(T + "That God is no more."); return finish(p); }
  const db = c.db;
  if (!yes) {
    out.push(T + "You refuse.");
    c.later.push(() => mail(db, c.t, -g.id, d.threat ? "Threat Ignored" : "Offer Declined", p.name + " is not afraid of YOUR powers!"));
    c.later.push(() => news(db, c.t, "Pathetic Recruitment Attempt", " The immortal " + GODC + g.name + T + " attempted to recruit", " " + PLY + p.name + T + ".", " The attempt failed miserably."));
    return finish(p);
  }
  const old = p.god;
  p.god = g.id;
  await godExp(c, g.id, 150);
  out.push(WHITE + "You are now a believer in " + GODC + g.name + WHITE + "!");
  c.later.push(() => mail(db, c.t, -g.id, "New Believer", p.name + " has joined your flock.", "Your powers grow!"));
  if (old && old !== g.id) c.later.push(() => mail(db, c.t, -old, "Believer Lost", p.name + " was " + (d.threat ? "threatened" : "approached") + " by " + g.name + "!", p.name + " left your flock!"));
  c.later.push(() => news(db, c.t, "Salvation", " " + PLY + p.name + T + " found faith in " + GODC + g.name + T + "!",
    d.threat ? " Evil tongues claim that " + PLY + p.name + T + " was forced into " + GODC + g.name + "s" + T + " flock." : " Evil tongues claim that " + GODC + g.name + T + " played an active part in this!"));
  return finish(p);
}


// ================================================================== dungeon events (DUNGEVC.PAS, DUNGEV2.PAS)
// An event is a little conversation: the board says something and offers keys (ui.options); the
// terminal sends back the key ("dng/event"). Some events end in a fight (purpose "event").
const EV_MAX = 17;
function evMon(name, hps, str, ph, w = 0) {
  return { name, str: Math.max(10, str), hps, max: hps, def: w, wpow: w, ml: 0, mana: 0, spells: 0, ph: ph || "", res: random(50), poisoned: false, hold: 0 };
}
function ask(p, kind, state, options, prompt, extra = {}) {
  p.event = { kind, ...state, ui: { options, prompt: prompt || "", ...extra } };
}
const YN = [["Y", "Yes"], ["N", "No"]];
function evFight(p, out, kind, stage, mons, intro) {
  p.event = null;
  p.fight = { mode: "dng", purpose: "event", noEscape: true, ev: { kind, stage }, dl: Math.min(100, Math.max(1, p.dl || p.level)), mons: mons.slice(0, EV_MAX), toDeath: false };
  p.ward = 0; p.wardRound = 0;
  if (intro) out.push(...intro);
}
// DUNGEONC 'L': before the monsters come, maybe something else happens. Returns true if it did.
export function dungeonEvent(p, out) {
  if (random(8) === 0 && !p.wellwish) {
    out.push(GOLD + "You have come across a Wishing WELL!");
    ask(p, "well", { step: "take" }, YN, "Take this Golden Opportunity");
    return true;
  }
  if (random(8) !== 1) return false;
  const r = random(11);
  const lvl = p.level, dl = Math.min(100, Math.max(1, p.dl || p.level));
  if (r === 0) {   // OLD MAN WITH MAP
    const v = random(3);
    if (v === 0) out.push("|11*An old man approaches you*", T + "He gives you a treasure map and then leaves.");
    if (v === 1) out.push("|11*MAP FOUND*", T + "You have found an old map!");
    if (v === 2) {
      out.push("|11*An old woman stops you*", T + "She gives you a map. She says it will make you rich.", T + "You can see that the old Hag has a purse, with gold perhaps?");
      ask(p, "oldmap", { step: "hag" }, [["L", "Let the woman go"], ["C", "Cut her throat"]], "");
      return true;
    }
    ask(p, "oldmap", { step: "follow" }, YN, "Follow Map");
    return true;
  }
  if (r === 1) {   // WOUNDED WARRIOR
    out.push(RED + "Wounded Warrior!", T + "A man is laying on the ground. You can see that he is mortally wounded.", T + "The ground has all the signs of battle where the warrior made",
      T + "his last stand. You listen to him :", TALK + " A group of orcish riff-raff ambushed me outside Khartan!", TALK + " I tried to escape but they had me cornered here...",
      TALK + " I was on my way with important letters from the King.", TALK + " It's vital that they are delivered, this to prevent", TALK + " the kingdom from being teared apart in a civilwar!");
    ask(p, "warrior", {}, [["L", "Leave this mess"], ["R", "Rob the dying man"], ["T", "Take a royal oath and pursue the villains"]], "");
    return true;
  }
  if (r === 2) {   // TREASURE CHEST
    const y = random(3), col = pick(["black", "red", "green", "brown", "dusty"]);
    const [runes, said] = [["Sghara Xavhanji Zheet", "Open this and die!"], ["Moonh Ihmloth!", "I will heal you."], ["Xavath Erhna Riuh", "Ancient wisdom lays in here"]][y];
    out.push(WHITE + "    **Discovery!**", T + "You have found a " + col + " chest.", T + "There are some inscriptions on the front :", T + "(elf runes)",
      TALK + " " + (p.race === R.Elf ? said : runes));
    ask(p, "chest", { y }, YN, "Open Chest");
    return true;
  }
  if (r === 3) return strangersStart(p, out);
  if (r === 6 && !p.dquest) {   // a man needing healing (a quest)
    out.push("|03-=Encounter=-", T + "Laying on a flat rock a man tries to call for your", T + "attention. When you come closer you can see that he", T + "is suffering from several wounds, seemingly inflicted",
      T + "by wild animals.", T + "You also notice that the man has purse brimming over with", T + "silver tied to his belt");
    ask(p, "wounded", { step: 1 }, [["T", "Talk to the stranger"], ["M", "Murder him"], ["W", "Walk away"]], "");
    return true;
  }
  if (r === 7) {   // MERCHANT
    out.push("|03-=Encounter=-", T + "You have spotted a merchant pulling a handcart.", T + "You can't see what's on the cart, but the merchant", T + "is a fat middle-aged man. He seems to be unarmed,",
      T + "although he of course can carry a concealed weapon.");
    ask(p, "merchant", { step: 1 }, [["T", "Talk"], ["A", "Assault"], ["W", "Walk away"]], "");
    return true;
  }
  if (r === 8) {   // BEGGAR
    out.push("|03-=Encounter=-", T + "A |07beggar" + T + " blocks your path. He's holding a wine-bottle in his", T + "right hand, and a cup in his left. The toothless old man",
      T + "is one of the many beggars flooding the country right now.", T + "You almost feel sorry for the poor bastard...");
    ask(p, "beggar", { step: 1 }, [["G", "Give money"], ["P", "Push him aside"], ["S", "Stomp him"], ["K", "Kill old man"]], "");
    return true;
  }
  if (r === 9) {   // the WITCH-DOCTOR
    const cost = lvl * 12500;
    if (p.gold < cost) return false;
    out.push(WHITE + "-*Dungeon Event*-", T + "You meet with the evil Witch-Doctor " + PLY + "Mbluta" + T + ".", T + PLY + "Mbluta" + T + " wants " + GOLD + cs(cost) + T + " of your hard earned gold coins.",
      T + "If you don't pay he will use his voodoo dolls and make you suffer!");
    ask(p, "witch", { cost }, [["P", "Pay"], ["R", "Run away"]], "");
    return true;
  }
  return false;   // 4 (items, NEW mode only), 5 and 10 are left out; see docs/USURPER.md
}
function strangersStart(p, out) {
  let foes = random(10) + 2;
  if (foes <= 1) foes += 3;
  foes = Math.min(EV_MAX, foes);
  const y = random(4);
  const kinds = [["Orcs", ["Orc", "Half-Orc"], "They are a poorly armed gang with sticks and clubs.|They don't seem to have eaten for a very long time...|The leader is a tall beast with long fangs and many|scars in his face."],
    ["Trolls", ["Troll", "Hill-Troll"], "The trolls are armed with clubs and spears. The leader|has a mace, which he is brandishing in front of you.|From the looks of these guys you know that bad news|has arrived."],
    ["Thieves", ["Thief", "Rogue", "Southerner"], "They are brandishing their knives and rapiers.|Even if the band mostly consists of riff-raff, you|can see some southerners among them. These guys are|carrying axes."],
    ["Dwarves", ["Dwarf", "Dwarf Warrior"], "It's hard to tell if they are looking for trouble.|They are carrying swords in their belts, and some have axes.|The dwarves are dressed in long fur coats."]][y];
  out.push("|07Encounter!", T + "A group of approximately |07" + foes + " " + kinds[0] + T + " is approaching!", ...kinds[2].split("|").map(l => T + l));
  ask(p, "strangers", { step: 1, foes, y }, [["E", "Escape!"], ["C", "Confront them"]], "");
  return true;
}
function strangerMons(p, st) {
  const names = [["Orc", "Half-Orc"], ["Troll", "Hill-Troll"], ["Thief", "Rogue", "Southerner"], ["Dwarf", "Dwarf Warrior"]][st.y];
  const dl = Math.min(100, Math.max(1, p.dl || p.level)), mons = [];
  for (let i = 0; i < st.foes; i++) mons.push(evMon(pick(names), dl * 3 + (i === 0 ? dl * 3 : 0), dl * 2, i === 0 ? "Get them!" : "", dl * 2));
  return mons;
}
// The terminal's answer to an event's question.
export function eventStep(p, c, out, key, n) {
  const e = p.event;
  if (!e) return false;
  const k = String(key || "").toUpperCase();
  const valid = (e.ui.options || []).some(o => o[0] === k) || (e.ui.number && k === "#");
  if (!valid) return true;
  p.event = null;
  const lvl = p.level, dl = Math.min(100, Math.max(1, p.dl || p.level));
  switch (e.kind) {
    case "well": {
      if (e.step === "take") {
        if (k !== "Y") return true;
        out.push("|05$------------------$", "|05$-> Wishing Well <-$", "|05$------------------$");
        ask(p, "well", { step: "wish" }, [["1", "Strength"], ["7", "Stamina"], ["2", "Defence"], ["8", "Agility"], ["3", "Money"], ["9", "Charisma"], ["4", "Healings"], ["0", "Dexterity"],
          ["5", "Hitpoints"], ["W", "Wisdom"], ["6", "Experience"], ["M", "Mana"], ["A", "Abort wish"]], "");
        return true;
      }
      let x;
      if (k === "A") { out.push(T + "Abort."); return true; }
      if (k === "1") { p.str += random(3) + 1; out.push(T + "Your Strength has increased!"); }
      if (k === "2") { x = random(5) + 2; p.def += x; out.push(T + "Your defence capabilities increased by " + WHITE + x + T + " points!"); }
      if (k === "3") { x = lvl * random(1200) + 1; p.gold += x; out.push(T + "Your pockets are filled with " + GOLD + cs(x) + T + " " + money(x) + "!"); }
      if (k === "4") { x = random(25) + 20; p.healing += x; out.push(T + "Your supply of Healing Potions increased by " + WHITE + x + T + " !"); }
      if (k === "5") { x = random(5) + 2; p.maxhps += x; p.hps = p.maxhps; out.push(T + "Your Hitpoints have increased!"); }
      if (k === "6") { x = random(1000) + 300; if (lvl > 20) x *= random(10) + 1; p.exp += x; out.push(T + "Your Experience has increased!"); }
      if (k === "7") { p.sta += random(2) + 1; out.push(T + "Your Stamina has increased!"); }
      if (k === "8") { p.agi += random(2) + 1; out.push(T + "Your Agility has increased!"); }
      if (k === "9") { p.cha += random(3) + 1; out.push(T + "Your Charisma has increased!"); }
      if (k === "0") { p.dex += random(3) + 1; out.push(T + "Your Dexterity has increased!"); }
      if (k === "W") { p.wis += random(3) + 1; out.push(T + "Your Wisdom has increased!"); }
      if (k === "M") {
        if (p.maxmana >= 32000) out.push(RED + "YOU HAVE REACHED YOUR MAXIMUM MANA CAPACITY!");
        else { p.maxmana += random(4) + 1; p.mana = p.maxmana; out.push(T + "Your MANA has increased!"); }
      }
      p.wellwish = true;
      return true;
    }
    case "oldmap": {
      if (e.step === "hag") {
        if (k === "L") out.push(T + "You let the woman disappear in the shadows.");
        else {
          out.push(T + "The poor womans deathcry echoes through the mountain.", T + "Your hands are covered in warm blood...", T + "You can hear your heart pounding. You enjoyed it.");
          p.dark += 50;
          if (random(2) === 0) out.push(T + "The womans purse was empty!");
          else { const x = lvl * random(5000); p.gold += x; out.push(T + "You found " + GOLD + cs(x) + T + " " + money(x) + "!"); }
        }
        ask(p, "oldmap", { step: "follow" }, YN, "Follow Map");
        return true;
      }
      if (e.step === "follow") {
        if (k !== "Y") { out.push(TALK + "I have better things to do!"); return true; }
        const v = random(3);
        if (v === 0) {
          let x = dl * 1500 + random(5000);
          out.push(GOLD + "**Treasure**", T + "You have found a Treasure!", T + "You find " + GOLD + cs(x) + T + " " + money(x) + "!");
          p.gold += x; x = dl * 200 + random(5000); p.exp += x;
          out.push(T + "You gained " + WHITE + cs(x) + T + " experience points!");
        } else if (v === 1) {
          out.push(T + "You travel many hours before reaching your destination...", T + "Finally! Before you lies a huge cave with only one small entrance.", T + "The treasure should be in here.",
            T + pick(["The Cave appears to be empty. But you can never be sure...", "Skulls and bones are laying outside the Cave. Danger ahead!", "You can hear some noise from the Cave. Something is in there."]));
          ask(p, "oldmap", { step: "cave" }, YN, "Dare you enter the Cave");
        } else out.push("|03You found nothing..");
        return true;
      }
      if (e.step === "cave") {
        if (k !== "Y") { out.push(T + "You decide to walk away from this potentially dangerous place."); return true; }
        const foes = Math.max(3, EV_MAX - random(7)), mons = [];
        for (let i = 0; i < foes; i++) mons.push(evMon(pick(["Giant-Worm", "Sleeze-Worm"]), Math.max(35, lvl * 5), lvl * 2, "sssss!"));
        evFight(p, out, "worms", 0, mons, [T + "Entering a room filled with " + WHITE + "GIANT WORMS!"]);
        return true;
      }
      return true;
    }
    case "warrior": {
      if (k === "L") { out.push(T + "You leave the warrior to die in the damp cave.", T + "(the gods won't approve of this!)"); return true; }
      if (k === "R") {
        const x = random(5000) + random(5000) + random(600);
        out.push(T + "You frisk the warrior of all of his belongings.", T + "All together you get " + GOLD + cs(x) + T + " " + money(x) + ".", T + "The man dies just before you leave", T + "(you dirty thief!)");
        p.gold += x;
        return true;
      }
      const foes = EV_MAX - random(7), mons = [];
      for (let i = 0; i < foes; i++) mons.push(evMon(pick(["Orc", "Half-Orc"]), Math.max(35, lvl * 5), lvl * 2, pick(["Ambush!", "Attack!", "Enemies!"])));
      evFight(p, out, "orcs", 0, mons, [T + "You swear to avenge this cowardly deed!", T + "You promise to deliver the letters, if it so should take", T + "you to the deepest dungeons of hell.",
        T + "Soon afterwards the warrior fades away and dies from his wounds.", T + "You bury him with his weapons and then set after the orchish band...",
        T + "After many hours of tracking you spot the orcish gang, camped", T + "in a narrow ravine. You can see at least " + WHITE + foes + T + " orcs in the area.", T + "It is time for battle."]);
      return true;
    }
    case "chest": {
      if (e.step === "scroll") {
        if (k !== "Y") { out.push(T + "You close the chest and leave."); return true; }
        if (e.s === 0) { const x = random(500) + 50; p.chiv += x; out.push(T + "You feel a cool breeze, and your heart feels a bit stronger!"); return true; }
        if (e.s === 1) {
          const foes = Math.max(3, EV_MAX - random(7)), mons = [];
          for (let i = 0; i < foes; i++) mons.push(evMon(pick(["Undead", "Zombie"]), Math.max(35, lvl * 5), lvl * 2, "..."));
          evFight(p, out, "undead", 0, mons, [T + "The earth trembles and through a crack in the ground you see", T + "shadows stream up against the lights from your torch.", T + "You have unleashed the undead!"]);
          return true;
        }
        out.push(T + "A secret door appears from behind a large boulder.", T + "A sign on the door reads : " + GOLD + " A place for Rest and Test");
        ask(p, "chest", { step: "cave" }, YN, "Enter");
        return true;
      }
      if (e.step === "cave") {
        if (k !== "Y") { out.push(T + "You walk away."); return true; }
        out.push(WHITE + "Kreeeek.....", T + "It seems as if you have entered a backdoor into a great Cavern.");
        p.uman = true;
        return true;
      }
      if (k !== "Y") { out.push(T + "You leave the chest."); return true; }
      out.push(WHITE + "Kreeeek.....");
      if (e.y === 0) {
        out.push(RED + "Ssssssss...!! It's poisonous gas!", T + "You try to escape this deadly threat....");
        const x = Math.max(5, random(lvl));
        if (random(2) === 0) { out.push(RED + "But it's too late! " + T + "You lose " + WHITE + x + T + " hitpoints."); p.hps -= x; }
        else out.push(T + "You managed to get away from the gas!");
        if (p.hps <= 0) { out.push(RED + "YOU ARE DEAD!"); p.hps = 0; p.allowed = false; p.mdefeats++; p.gold = 0; c.later.push(() => news(c.db, c.t, "Poisoned!", " " + PLY + p.name + T + " opened a chest filled with poisonous gas!")); }
      } else if (e.y === 1) {
        const x = (random(lvl) + 1) * 2;
        out.push(T + "The chest is filled with healing potions!", T + "You grab as many as you can carry...", T + "You took " + WHITE + x + T + " potions.");
        p.healing += x;
      } else {
        const sc = random(3);
        const [w, t2] = [["XAVARANTHE JHUSULMAX VASWIUN", " And you will receive a blessing."], ["ZASHNIVANTHE ULIPMAN NO SEE", " And you will see ancient power rise again."], ["RANTVANTHI SHGELUUIM VARTHMIOPLXH", " And you will be given opportunities."]][sc];
        out.push(T + "You have found a scroll! It reads :", WHITE + " Utter : " + TALK + w, WHITE + t2);
        ask(p, "chest", { step: "scroll", s: sc }, YN, "Recite the Scroll");
      }
      return true;
    }
    case "wounded": {
      const murder = () => {
        const x = random(2000) + 250, xp = random(100) + 100;
        out.push(TALK + "Kill the weak!", T + "Since the man is incapacitated this kill is one of", T + "your easier tasks. You draw a dagger from the mans", T + "belt and finish him off.",
          T + "You find " + GOLD + cs(x) + T + " " + money(x) + " in his purse. Pretty disappointing.", T + "You receive " + WHITE + cs(xp) + T + " experience points for this murder.");
        p.gold += x; p.exp += xp; p.dark += random(50) + 25;
        c.later.push(() => news(c.db, c.t, "Murder in the Dungeons", " A wounded traveller was found murdered in the dungeons.", " " + PLY + p.name + T + " is the suspect."));
      };
      if (k === "W") { out.push(T + "You decide to walk away from this situation.", T + "You have better things to do than caring for the wounded."); return true; }
      if (k === "M") { murder(); return true; }
      if (e.step === 1) {
        out.push(T + "The man is tall and square-shouldered. He has long blond", T + "hair and is probably in his thirties.", T + "Dressed in rags you could easily take him for a vagrant, but",
          T + "you can tell from his distinct features that he's from a", T + "fine family.", T + "The man speaks: ", TALK + " Please give me some healing potions!");
        ask(p, "wounded", { step: 2 }, [["G", "Give some potions"], ["M", "Murder him"], ["W", "Walk away"]], "");
        return true;
      }
      if (e.step === 2) {
        if (p.healing < 5) { out.push(T + "You don't have enough potions!", T + "Unable to give the man any help, he dies.", T + "You leave him where you found him.", T + "There is no time for funerals."); return true; }
        p.healing -= 5;
        out.push(T + "The man takes " + WHITE + "5" + T + " potions, and is somewhat recovered.", T + "He thanks you and starts to tell you an amazing story", T + "on how he ended up here :",
          TALK + " My name is " + GOLD + "Fionn" + TALK + ". I was working as a military advisor for " + WHITE + "Lord Belgor" + TALK + " when his",
          TALK + " Keep was attacked by " + WHITE + "Grimsk" + TALK + "s band. I managed to flee and brought with me some", TALK + " vital document concerning Grimsks criminal activity in the area.",
          TALK + " It's imperative that these document get through to the royal court!", GOLD + "Fionn" + T + " catches his breath and then asks you if he can", T + "confide these paper with you.");
        ask(p, "wounded", { step: 3 }, [["A", "Accept"], ["M", "Murder Fionn"], ["W", "Walk away"]], "");
        return true;
      }
      if (e.step === 3) {
        out.push(T + "Your instructions are :", T + "Bring the papers to the Magic Shoppe.", T + "Show them to the shopkeeper and you will receive further", T + "instructions there.");
        p.dquest = true;
        if (random(2) === 0) {
          out.push(PLY + "Fionn" + T + " suddenly hides behind a large boulder.", T + "You soon realize why...! A war party has appeared,", T + "almost without making a sound.",
            T + "Their leader " + WHITE + "Uthgar" + T + ", a tall and mighty beast, orders halt. He walks up to you and stares at you", T + "with his burning red eyes :",
            TALK + " We are looking for a wounded man who should be in the vicinity.", TALK + " Have you seen him?");
          ask(p, "wounded", { step: 4 }, [["Y", "Yes he is here!"], ["N", "No, I haven't seen him!"]], "");
          return true;
        }
        out.push(T + "You shake hands with " + PLY + "Fionn" + T + " and wish him good luck on his journey.", WHITE + "(Don't forget your mission!)");
        return true;
      }
      if (e.step === 4) {
        if (k === "Y") {
          const x = random(5000) + 500;
          out.push(TALK + "He's hiding over there!", T + "You show the trolls where " + WHITE + "Fionn" + T + " is hiding.", WHITE + "Fionn" + T + " is captured and put in chains.",
            T + "You receive " + GOLD + cs(x) + T + " " + money(x) + " for your cooperation with " + WHITE + "Uthgar" + T + ".", WHITE + "You failed your mission when you betrayed " + PLY + "Fionn" + WHITE + "!");
          p.gold += x; p.dquest = false; p.dark += random(50) + 25;
          return true;
        }
        out.push(WHITE + "No, I haven't seen anybody looking like that.");
        if (random(3) === 0) {
          const mons = [];
          for (let i = 0; i < 6 + random(6); i++) mons.push(evMon(i ? "War-Troll" : "Uthgar", dl * (i ? 4 : 8), dl * 3, i ? "" : "Liar!", dl * 2));
          evFight(p, out, "trolls", 0, mons, [WHITE + "Oh no! The trolls are going to attack!"]);
          return true;
        }
        out.push(T + "Still suspicious " + WHITE + "Uthgar" + T + " finally decides to move on.", T + "The war-party disappears just as quietly as they arrived.",
          WHITE + "Fionn" + T + " comes forward from his hiding place; he thanks you for your courage to stand up to the trolls.", WHITE + "(Don't forget your mission!)");
        const x = random(100) + 50; p.chiv += x;
        out.push(T + "You receive " + WHITE + x + T + " chivalry points!");
        return true;
      }
      return true;
    }
    case "merchant": {
      if (k === "W") { out.push(T + "You decide to leave the merchant in peace.", T + "More important things are pending."); return true; }
      if (k === "A" && e.step !== "robbers") {
        evFight(p, out, "merchant", 0, [evMon(pick(["Merchant", "Fat Merchant", "Scared Merchant"]), 50, dl * 2, "Help! Help!", dl * 2)], [RED + "You attack the defenceless merchant!"]);
        return true;
      }
      if (e.step === 1 && k === "T") {
        out.push(T + "You stop the man and ask where he's headed.", T + "The merchant looks afraid but finally clears his throat and speaks :", TALK + " I'm headed for " + WHITE + "Lyngon" + TALK + ", a four days' march from here.",
          TALK + " I could really use an escort through the " + WHITE + "Mildha" + TALK + " forest.", TALK + " You will get paid of course. The forest is filled with", TALK + " all kinds of trouble. Worst of them all; " + WHITE + "Uldrew" + TALK + ".");
        ask(p, "merchant", { step: 2 }, [["E", "Escort Merchant"], ["A", "Attack now!"], ["W", "Walk away"]], "");
        return true;
      }
      if (k === "E") { out.push(WHITE + "You accept to escort the merchant through the forest.", T + "You begin your journey toward the unknown."); return escortDay(p, out, 0); }
      if (e.step === "robbers") {
        if (k === "R") {
          out.push(T + "You run away to save your own skin!", T + "In the distance you can hear the scream from the poor merchant.", T + "You can only hope that the robbers spare his life.", T + "(not very likely)",
            WHITE + "You failed your Escort Mission when you left the Merchant!");
          p.dark += random(25) + 25;
          c.later.push(() => news(c.db, c.t, "Coward!", " " + PLY + p.name + T + " abandoned a merchant to the robbers in the dungeons."));
          return true;
        }
        const t = e.day, foes = [random(5) + 2, random(6) + 3, random(9) + 4][t], mons = [];
        for (let i = 0; i < foes; i++) {
          const leader = i === 0, name = leader ? ["Bandit Leader", "*Robber Prince*", "*Uldrews son*"][t] : pick([["Hooded Robber", "Robber", "Thief", "Rogue"], ["Robber Knight", "Robber Squire"], ["Tree Hunter", "Green Threat"]][t]);
          const hps = leader ? [dl * 12, dl * 16, dl * 30][t] : dl * 3;
          mons.push(evMon(name, hps, dl * 2, leader ? ["Give yourself up!", "No prisoners!", "Wrong way lads!"][t] : "", dl * 2));
        }
        evFight(p, out, "escort", t, mons, [WHITE + "FIGHT!"]);
        return true;
      }
      return true;
    }
    case "beggar": {
      if (e.step === 1 && k === "G") {
        out.push(T + "You decide to have mercy with the beggar.", T + "You have " + GOLD + cs(p.gold) + T + " " + money(p.gold) + ".");
        ask(p, "beggar", { step: 2 }, [], "Give how much", { number: { max: p.gold } });
        return true;
      }
      if (e.step === 2 || e.step === 4) {
        const x = Math.max(0, Math.min(Math.trunc(+n) || 0, p.gold));
        if (!x) { out.push(TALK + "I changed my mind! Go and find a job you bloody parasite!", T + "The beggar shakes his fist at you."); return true; }
        p.gold -= x;
        out.push(TALK + "Here you are " + (p.sex === 1 ? "grandpa" : "grandpa") + "! Don't spend it all on booze now.");
        if (e.step === 2 && x < random(100) + 50) {
          out.push(T + "The beggar looks at the few coins you gave him.", TALK + " This won't help me far sir! Can you spare some more?");
          ask(p, "beggar", { step: 3 }, [["G", "Give more"], ["C", "Club the ungrateful old fart"]], "");
          return true;
        }
        const c2 = random(40) + 30; p.chiv += c2;
        out.push(T + "The beggar is grateful. He gives you a hug and heads off.", T + "Your soul lightens! (" + WHITE + c2 + T + " chivalry points)");
        return true;
      }
      if (e.step === 3) {
        if (k === "G") { out.push(T + "You decide to give the persistent man some more gold.", T + "You have " + GOLD + cs(p.gold) + T + " " + money(p.gold) + "."); ask(p, "beggar", { step: 4 }, [], "Give how much", { number: { max: p.gold } }); return true; }
        out.push(TALK + "Sure Sure! Old man! I will give you some more alright.", T + "You manage to draw the beggars attention to another direction.", T + "You then pick up a wooden branch from the ground and strike",
          T + "it with full power over the beggars head!", WHITE + "KRACK!", T + "After you have cleaned yourself up you continue your journey...");
        p.dark += random(75) + 55;
        return true;
      }
      if (k === "P") { out.push(T + "You gently push the man aside and continue your journey.", T + "From behind you hear the beggar angrily muttering curses."); return true; }
      if (k === "S") {
        out.push(TALK + "I'm gonna teach you a lesson old man!", T + "You push the beggar to the ground...", T + "The weak man can't put up much of a fight against", T + "your superior strength.",
          T + "You kick him around a while and leave him laying on the ground.", T + "You feel refreshed after this little exercise!", T + "(you need to wash your boots too)");
        p.dark += random(40) + 30;
        return true;
      }
      out.push(TALK + "Suck on this Grandpa!", T + "You draw your weapon and kill the old man.", T + "Nobody will miss him, you think to yourself.");
      p.dark += random(70) + 90;
      c.later.push(() => news(c.db, c.t, "Murder in the Dungeons", " A beggar was found slain in the dungeons.", " " + PLY + p.name + T + " is the suspect."));
      return true;
    }
    case "witch": {
      if (k === "P") {
        out.push(T + "Reluctantly you give " + PLY + "Mbluta" + T + " the gold.", PLY + "Mbluta" + T + " wanders off in the dark labyrinths...");
        p.gold = Math.max(0, p.gold - e.cost);
        c.later.push(() => news(c.db, c.t, "Blackmail in the Dungeons", " " + PLY + p.name + T + " the " + RACES[p.race] + " was forced to pay a heap of gold to", " " + PLY + "Mbluta" + T + " the witch-doctor!"));
        return true;
      }
      if (random(2) === 0) { out.push(WHITE + "*YOU MANAGE TO FLEE THE EVIL WITCH DOCTOR*"); return true; }
      out.push(RED + "*YOU FAIL TO FLEE THE EVIL WITCH DOCTOR*");
      const w = random(3);
      if (w === 0) { const x = Math.min(p.exp, lvl * 1500); p.exp -= x; out.push(RED + "YOU LOSE " + cs(x) + " EXPERIENCE POINTS!"); }
      if (w === 1) { const x = Math.min(p.fights, random(5) + 1); p.fights -= x; out.push(RED + "YOU LOSE " + x + " DUNGEON FIGHTS!"); }
      if (w === 2) { const x = Math.min(p.pfights, random(3) + 1); p.pfights -= x; out.push(RED + "YOU LOSE " + x + " PLAYER FIGHTS!"); }
      c.later.push(() => news(c.db, c.t, "Cursed by Witch-Doctor", " " + PLY + p.name + T + " was cursed when trying to escape from", " " + PLY + "Mbluta" + T + ", the evil witch-doctor!"));
      return true;
    }
    case "strangers": return strangersStep(p, c, out, e, k);
  }
  return true;
}
function escortDay(p, out, from) {
  const names = ["Day one...over the mountains", "Day two...through the desert", "Day three...through |15Mildha"];
  for (let d = from; d < 3; d++) {
    out.push(T + names[d]);
    if (random(3) === 0) {
      const foes = [random(5) + 2, random(6) + 3, random(9) + 4][d];
      if (d === 0) out.push("|03You have spotted " + WHITE + foes + "|03 mountain robbers blocking your path.", "|03The robbers all wear hoods to hide their faces.", "|03They will let you go if you hand over the Merchant to them.");
      if (d === 1) out.push("|03You have spotted " + WHITE + foes + "|03 robber knights blocking your path.", "|03The robbers wear hoods to hide their faces.", "|03They will let you go if you hand over the Merchant to them.");
      if (d === 2) out.push("|03You have spotted " + WHITE + "Uldrews" + "|03 gang! They are the most notorious", "|03murdering scum on this side of the valley.", "|03Run away NOW or fight your last battle today!");
      ask(p, "merchant", { step: "robbers", day: d }, [["A", d === 1 ? "Attack knights" : d === 0 ? "Attack robbers" : "Attack!"], ["R", "Run away (and leave the poor merchant)"]], "");
      return true;
    }
  }
  const x = random(5000) + 1500;
  p.gold += x;
  out.push(T + "Day four...arriving to " + WHITE + "Lyngon", WHITE + "You made it through safe!", T + "Your salary was " + GOLD + cs(x) + T + " " + money(x) + ".", T + "You make your way back to the place where you started from.");
  return true;
}
function strangersStep(p, c, out, e, k) {
  const lvl = p.level, dl = Math.min(100, Math.max(1, p.dl || p.level));
  if (e.step === 1) {
    if (k === "E") { out.push(T + "You managed to get away."); return true; }
    out.push(T + "You decide to confront the strangers.");
    if (random(2) === 0) {
      out.push(T + "Their leader demands that you give him all of your money :", TALK + "Hand over the gold now!");
      ask(p, "strangers", { ...e, step: 2 }, [["G", "Give them the gold"], ["R", "Refuse"]], "");
    } else {
      const x = random(5000) + 5000;
      out.push(T + "Their leader offers you a Map to a secret burial-ground.", T + "The stranger speaks of treasures beyond belief.", T + "They would go themselves if it had not been for the guardian",
        T + "of this place.", T + "The leader wants " + GOLD + cs(x) + T + " " + money(x) + " for the map.");
      ask(p, "strangers", { ...e, step: 5, price: x }, [["B", "Buy the map"], ["L", "Leave"]], "");
    }
    return true;
  }
  if (e.step === 2) {
    if (k === "G") { out.push(T + "You resign yourself and hand over the gold."); p.gold = 0; return true; }
    out.push(T + "Refuse in a gentle manner or be rude?");
    ask(p, "strangers", { ...e, step: 3 }, [["G", "Gentle response"], ["R", "Rude!"]], "");
    return true;
  }
  if (e.step === 3) {
    if (k === "G") {
      out.push(T + "You make a speech about your poverty, and families", T + "back home. You beg the strangers to let you pass.");
      if (random(2) === 0) { out.push(T + "Apparently the bandits bought your story.", T + "They wave goodbye and soon disappear on a path", T + "leading " + pick(["north.", "south.", "east.", "west.", "down into the dark."])); return true; }
      evFight(p, out, "bandits", 0, strangerMons(p, e), [T + "The bandits laugh at your pathetic lies.", T + "They draw their weapons and attack!", WHITE + "FIGHT!"]);
      return true;
    }
    evFight(p, out, "bandits", 0, strangerMons(p, e), [T + "You tell the strangers what a pack of trash they are.", T + "The bandits draw their weapons and attack!", WHITE + "FIGHT!"]);
    return true;
  }
  if (e.step === 5) {
    if (k !== "B" || p.gold < e.price) { if (k === "B") out.push(RED + "You can't afford it!", RED + "The stranger left."); else out.push(T + "You bid the strangers farewell..."); return true; }
    p.gold -= e.price;
    out.push(T + "You give the stranger the gold.", T + "You now have the map!", T + "You travel downwards...", T + "After many hours you arrive to the first mark on the map.",
      T + "The Burial-Ground can be sighted behind a wooden palisade.", T + "By the looks of the palisade this is " + WHITE + "NOT" + T + " an abandoned cemetery!", T + "This is your last chance to change your mind.");
    ask(p, "strangers", { step: 6, graves: random(15) + 5, cleared: 0, danger: 0, loot: 0 }, [["P", "Plunder the graves"], ["L", "Leave this place!"]], "");
    return true;
  }
  if (e.step === 6 || e.step === 7) {
    if (k === "L") {
      if (e.loot) { p.gold += e.loot; out.push(T + "You leave with " + GOLD + cs(e.loot) + T + " gold in your bags."); }
      else out.push(T + "You leave this place.");
      return true;
    }
    if (e.step === 6 && k === "P") out.push(T + "There is a deathlike silence here... You can almost touch it.");
    if (e.step === 7 && k === "R") { out.push(T + "You restore the graves to their original state."); return true; }
    if (e.step === 7 && k === "I") {
      out.push(T + "You ignore that Windbag and continue with your work!", "|05After awhile you can hear the Spirit again :", TALK + " It was a long time since somebody dared me...",
        TALK + " But since You like to play with the dead...", TALK + " You should meet them in the flesh!", WHITE + "Oh no! The corpses and mummies are rising from their graves!");
      const foes = Math.min(EV_MAX, random(15) + 5), mons = [];
      for (let i = 0; i < foes; i++) { const t = random(3); mons.push(evMon(["Corpse", "Mummy", "Skeleton Lord"][t], dl * [3, 4, 8][t] + dl, dl * 3, "", dl)); }
      p.event = null;
      evFight(p, out, "graves", e.loot, mons);
      return true;
    }
    // dig the next grave
    e.danger++; e.cleared++; e.graves--;
    const x = lvl * 800 + random(1500);
    e.loot += x;
    out.push(T + "You start digging and find " + GOLD + cs(x) + T + " worth of gold in this grave!", T + "You have cleared " + WHITE + e.cleared + T + " graves. There are " + WHITE + e.graves + T + " graves left to plunder.");
    if (e.danger > 5 && random(2) === 0) {
      out.push("|11You can feel the presence of a spirit!", "|05The spirit speaks :", TALK + " Leave the graves as they were!", TALK + " I am the Guardian of this ground and will not tolerate this behaviour!");
      ask(p, "strangers", { ...e, step: 7 }, [["I", "Ignore the wimpy spirit"], ["R", "Restore everything you have stolen"]], "");
      return true;
    }
    if (e.graves < 1) { p.gold += e.loot; out.push(T + "All graves are plundered. You leave with " + GOLD + cs(e.loot) + T + " gold."); return true; }
    ask(p, "strangers", { ...e, step: 6 }, [["N", "Next grave"], ["L", "Leave"]], "");
    return true;
  }
  return true;
}
async function eventDone(p, f, c, out, how) {
  const ev = f.ev || {};
  if (how !== "won") {
    if (how === "died") c.later.push(() => news(c.db, c.t, "Killed in the Dungeons", " " + PLY + p.name + T + " was killed on an adventure in the dungeons."));
    return;
  }
  const lvl = p.level;
  if (ev.kind === "worms") { const x = lvl * 1500; p.gold += x; out.push(GOLD + "** SUCCESSFUL BATTLE **", T + "After having slaughtered all of the beasts,", T + "You seek the cave for treasure. You find some weapon and", T + "gold. It's all worth " + GOLD + cs(x) + T + " " + money(x) + "."); }
  if (ev.kind === "orcs") {
    const x = lvl * 500; p.gold += x;
    out.push(GOLD + "** SUCCESSFUL MISSION **", T + "After having slaughtered all of the orcish riff-raff,", T + "You seek the camp for the royal letters. You find them", T + "on one of the orc leaders.",
      RED + "The Royal Council" + T + " has rewarded you with " + WHITE + cs(x) + T + " " + money(x) + " for your heroic effort.");
  }
  if (ev.kind === "undead") out.push(GOLD + "** SUCCESSFUL BATTLE **", T + "After having slaughtered all of the Undead,", T + "You seek the remains for treasure. You find nothing.", T + "You should be lucky you're still alive.");
  if (ev.kind === "trolls") { const x = random(100) + 50; p.chiv += x; out.push(GOLD + "The war-party is beaten!", T + "You receive " + WHITE + x + T + " chivalry points for this fight!", WHITE + "(Don't forget your mission!)"); }
  if (ev.kind === "merchant") {
    const x = random(5000) + 1000;
    p.gold += x; p.dark += x;
    out.push(GOLD + "******* Poor Mans Death *********", T + "After this shameful assault you search the Merchant's belongings...", T + "You find some furs in the cart.", T + "They are worth " + GOLD + cs(x) + T + " gold coins (" + RED + "BLOOD MONEY!" + T + ")",
      WHITE + "You will surely pay for this crime later on!", T + "You receive " + WHITE + cs(x) + T + " darkness points for this fight!");
    c.later.push(() => news(c.db, c.t, "Merchant Slain", " A merchant was robbed and slain in the dungeons.", " " + PLY + p.name + T + " is the suspect."));
  }
  if (ev.kind === "escort") { out.push(GOLD + "******* Successful Fight *********", T + "After this perfect battle you rest a while..."); escortDay(p, out, ev.stage + 1); }
  if (ev.kind === "bandits") out.push(GOLD + "The bandits are beaten!", T + "You continue your journey.");
  if (ev.kind === "graves") { p.gold += ev.stage || 0; out.push(GOLD + "The dead are at rest again!", T + "You leave with " + GOLD + cs(ev.stage || 0) + T + " gold from the graves."); }
}

// ================================================================== the Cave of Uman (UMAN.PAS)
// High and Low, Tame the Bear and Indian Wrestling, reached from the Dungeons.
export async function umanAction(action, body, p, c, ctx, out, finish) {
  const db = c.db;
  if (p.fight) ctx.fail("You are in the middle of a fight!");
  if (action === "uman/hilo") {   // High and Low: bet up to 15,000, the croupier picks 1-10
    const bet = Math.trunc(+body.bet) || 0, hl = String(body.hl || "").toUpperCase();
    if (bet < 1 || bet > 15000 || bet > p.gold) { out.push(WHITE + "Get lost!"); return finish(p); }
    const x = random(10) + 1, win = (hl === "H" && x > 5) || (hl === "L" && x < 6);
    out.push(T + "The croupier picked :" + GOLD + x, win ? WHITE + "YOU WIN!" : RED + "YOU LOSE!");
    p.gold += win ? bet : -bet;
    return finish(p);
  }
  if (action === "uman/bear") {   // Tame the Bear: make it sit within 7 rounds
    const b = p.bear;
    if (body.start) {
      if ((p.bearTries || 0) >= P3.bearTries) { out.push(WHITE + "You have had your chances with the Bear today!", WHITE + "Return tomorrow for more fun."); return finish(p); }
      if (p.gold < 2500) { out.push("|11You can't afford to participate!"); return finish(p); }
      let price = p.level * (random(7) + 2) * 25;
      if (price <= 2500) price = 5000;
      if (!body.confirm) return finish(p, { bearOffer: { price, fee: 2500, rounds: 7 } });
      p.bearTries = (p.bearTries || 0) + 1; p.gold -= 2500;
      p.bear = { mood: 5, rounds: 7, price, xp: p.level * 150 };
      out.push(WHITE + "The Bear looks indifferent.");
      return finish(p, { bear: p.bear });
    }
    if (!b) ctx.fail("There is no bear here.");
    const move = String(body.move || "").toUpperCase();
    b.rounds--;
    if (move === "F") {
      out.push(T + "You throw a fruit to the Bear...");
      const risk = [0, 10, 9, 8, 7, 6, 5, 4, 3, 2, 2][b.mood];
      if (random(risk) === 0) { b.mood++; out.push(RED + "BAD MOVE!"); } else { b.mood--; out.push(WHITE + "GOOD MOVE!"); }
    } else {
      out.push(WHITE + "KLATSCH!");
      const risk = [0, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10][b.mood];
      if (random(risk) === 0) { b.mood++; out.push(RED + "BAD MOVE!"); } else { b.mood--; out.push(WHITE + "GOOD MOVE!"); }
    }
    b.mood = Math.min(10, b.mood);
    if (b.mood < 1) {
      out.push(WHITE + "The Bear is sitting down! YOU'VE DONE IT!", "", "|05YOU WON!", GOLD + cs(b.price) + T + " gold coins in your pocket.", T + "You gain " + GOLD + cs(b.xp) + T + " experience points.");
      p.exp += b.xp; p.gold += b.price; p.bear = null;
      c.later.push(() => news(db, c.t, "Impressive", " " + PLY + p.name + T + " tamed a wild Bear."));
      return finish(p, { bear: null });
    }
    out.push(WHITE + ["", "The Bear loves you!", "The Bear licks your feet.", "The Bear is very Happy.", "The Bear is happy.", "The Bear looks indifferent.", "The Bear looks nervous.",
      "The Bear growls.", "The Bear looks upset.", "The Bear is angry!", "The Bear hates your guts!"][b.mood]);
    if (b.mood > 8 && random(2) === 0) {
      const x = 8 + random(4);
      out.push(T + "The Bear claws you for " + WHITE + x + T + " points.");
      p.hps -= x;
      if (p.hps < 1) {
        out.push(T + "YOU ARE DEAD!"); p.hps = 0; p.allowed = false; p.bear = null;
        c.later.push(() => news(db, c.t, "Death at the Casino!", " " + PLY + p.name + T + " died trying to tame a bear!"));
        return finish(p, { dead: true, bear: null });
      }
    }
    if (b.rounds < 1) { out.push(RED + "Sorry! You didn't make it in time!", RED + "You lose!"); p.bear = null; return finish(p, { bear: null }); }
    return finish(p, { bear: b });
  }
  if (action === "uman/wrestlers") {   // recommended opponents
    const rows = (await db.prepare("SELECT user_id, data FROM usurper_players WHERE user_id != ? ORDER BY exp DESC LIMIT 40").bind(p.id).all()).results;
    const online = await onlineIds(db), done = p.wrestled || [];
    const list = rows.map(r => { const q = JSON.parse(r.data); return { id: r.user_id, name: q.name, str: q.str, king: !!q.king }; })
      .filter(q => !q.king && !online.has(q.id)).sort((a, b) => a.str - b.str).slice(0, 15)
      .map(q => ({ id: q.id, name: q.name, how: easyTarget(p.str - q.str), fought: done.includes(q.id) }));
    const log = (await db.prepare("SELECT day, body FROM usurper_history WHERE kind = 'indian' ORDER BY id DESC LIMIT 6").all()).results;
    return finish(p, { wrestlers: list, log });
  }
  if (action === "uman/wrestle") {   // Indian Wrestling
    const w = p.wrestle;
    if (body.id) {
      if ((p.wrestlings ?? P3.wrestlings) < 1) { out.push(RED + "Sorry, You have used up your luck in this game!"); return finish(p); }
      const v = await loadOther(c, Math.trunc(+body.id));
      if (!v || v.id === p.id) ctx.fail("Couldn't locate that character.");
      if (v.king) { out.push(RED + "YOU MAY NOT CHALLENGE THE " + kingString(v.sex).toUpperCase()); return finish(p); }
      if ((await onlineIds(db)).has(v.id)) { out.push(PLY + v.name + RED + " is busy right now!"); return finish(p); }
      if ((p.wrestled || []).includes(v.id)) { out.push(RED + "You have already wrestled " + PLY + v.name + RED + "!"); return finish(p); }
      p.wrestled = [...(p.wrestled || []), v.id].slice(-15);
      p.wrestlings = (p.wrestlings ?? P3.wrestlings) - 1;
      out.push(WHITE + "TELEPORTING " + PLY + v.name + WHITE + " ... " + PLY + v.name + WHITE + " has arrived!");
      if (p.team && p.team === v.team) out.push(TALK + "WE ARE IN THE SAME TEAM STUPID!" + T + ", " + PLY + v.name + T + " complains.");
      const x = p.str - v.str;
      let xp;
      if (x <= -300) { out.push(T + "Compared to you, " + PLY + v.name + T + " is a GIANT! You will certainly lose."); xp = p.level * 90; }
      else if (x <= -100) { out.push(PLY + v.name + "s" + T + " muscles are much bigger than yours!"); xp = p.level * 60; }
      else if (x <= 0) { out.push(PLY + v.name + T + " is a pretty strong " + (v.sex === 1 ? "guy!" : "girl!"), T + "This will be a close fight!"); xp = p.level * 35; }
      else if (x <= 25) { out.push(PLY + v.name + T + " and you have pretty much the same strength."); xp = p.level * 25; }
      else if (x <= 75) { out.push(T + "You should beat " + PLY + v.name + T + "."); xp = p.level * 15; }
      else if (x <= 150) { out.push(T + "You should overcome " + PLY + v.name + T + " easy!"); xp = p.level * 12; }
      else { out.push(PLY + v.name + T + " is a weakling compared to you!"); xp = p.level * 5; }
      let a = p.str, b = v.str;
      const div = a > 10000 && b > 10000 ? 10000 : a > 1000 && b > 1000 ? 1000 : a > 100 && b > 100 ? 100 : a > 10 && b > 10 ? 10 : 1;
      a = Math.max(2, Math.floor(a / div)); b = Math.max(2, Math.floor(b / div));
      p.wrestle = { id: v.id, name: v.name, sex: v.sex, p1: a, p2: b, o1: a, o2: b, xp };
      return finish(p, { wrestle: p.wrestle });
    }
    if (!w) ctx.fail("You aren't wrestling anyone.");
    const move = String(body.move || "");
    if (move === "3" && w.p1 >= w.o1) { out.push(WHITE + "YOU NEED NO REST!"); return finish(p, { wrestle: w }); }
    let lose1 = false, lose2 = false, rest1 = false, rest2 = false;
    if (move === "1") { out.push("|11You put pressure on " + PLY + w.name + "s" + "|11 arm!"); lose2 = true; }
    else if (move === "2") { out.push("|11POWER MOVE!"); if (random(5) === 0) { out.push(PLY + w.name + WHITE + " FELL FOR IT!"); w.p2 -= 6; } else { out.push(RED + "YOU FAILED!"); w.p1 -= 2; } }
    else { out.push("|11You rest."); rest1 = true; }
    const o = random(3);
    if (o === 0 || (o === 2 && w.p2 >= w.o2)) { out.push(PLY + w.name + "|11 puts pressure on Your arm!"); lose1 = true; }
    else if (o === 1) { out.push(PLY + w.name + "|11 tried a POWER MOVE!"); if (random(5) === 0) { out.push(WHITE + "YOU FELL FOR IT!"); w.p1 -= 6; } else { out.push(RED + "IT FAILED!"); w.p2 -= 2; } }
    else { out.push(PLY + w.name + "|11 rests."); rest2 = true; }
    if (lose1) w.p1 -= 2; if (lose2) w.p2 -= 2; if (rest1) w.p1++; if (rest2) w.p2++;
    if (w.p1 >= 1 && w.p2 >= 1) return finish(p, { wrestle: w });
    p.wrestle = null;
    let line;
    if (w.p1 < 1 && w.p2 < 1) {
      out.push(GOLD + "A DRAW!", T + "You and " + PLY + w.name + T + " shake hands after this close competition.");
      c.later.push(() => mail(db, c.t, w.id, "Indian Wrestling", p.name + " dared you in a Wrestling match.", "It was a DRAW!"));
      c.later.push(() => news(db, c.t, "Indian Wrestling", " " + PLY + p.name + T + " and " + PLY + w.name + T + " had a draw."));
      line = PLY + p.name + T + " and " + PLY + w.name + T + " had a draw";
    } else if (w.p1 < 1) {
      out.push(T + "You are exhausted! No strength is left in your arm...", T + "With a grin on " + (w.sex === 2 ? "her" : "his") + " face " + PLY + w.name + T + " breaks your arm down on the table.", RED + "YOU LOST! GO AND TRAIN SOME MORE YOU WEAKLING!");
      await bump(db, w.id, "exp", w.xp);
      c.later.push(() => mail(db, c.t, w.id, "Indian Wrestling", p.name + " dared you in a Wrestling match.", "You WON and gained " + cs(w.xp) + " experience points."));
      c.later.push(() => news(db, c.t, "Indian Wrestling", " " + PLY + p.name + T + " lost to " + PLY + w.name + T + "."));
      line = PLY + w.name + T + " beat " + PLY + p.name;
    } else {
      out.push(PLY + w.name + T + " is exhausted! With sweat pouring down " + (w.sex === 2 ? "her" : "his") + " forehead", T + (w.sex === 2 ? "she" : "he") + " tries a last desperate comeback!", T + "But you have it all under control.",
        WHITE + "YOU WON! GOOD MUSCLE-WORK!", T + "You gain " + WHITE + cs(w.xp) + T + " experience points.");
      p.exp += w.xp;
      c.later.push(() => mail(db, c.t, w.id, "Indian Wrestling", p.name + " dared you in a Wrestling match.", "You LOST!"));
      c.later.push(() => news(db, c.t, "Indian Wrestling", " " + PLY + p.name + T + " beat " + PLY + w.name + T + "."));
      line = PLY + p.name + T + " beat " + PLY + w.name;
    }
    c.later.push(() => history(c, "indian", line));
    return finish(p, { wrestle: null, over: true });
  }
  return null;
}
function easyTarget(x) {   // UMAN.PAS Easy_Target
  return x <= -300 ? "Impossible" : x <= -100 ? "Very hard" : x <= 0 ? "Hard" : x <= 25 ? "Even" : x <= 75 ? "Easy" : x <= 150 ? "Very easy" : "Walk-over";
}

// ================================================================== close-combat skills (VARIOUS.PAS)
const BASH = ["Tackle", "Drop-Kick", "Uppercut", "Bite", "Leg-Sweep", "JointBreak", "Knifehand", "Nerve Punch", "Chokehold", "Headbash", "Pull Hair", "Kick", "Straight Punch", "Ram"];
const BASH_RANK = ["Rotten", "Awful", "Lousy", "Pathetic", "Bad", "Poor", "Incompetent", "Below average", "Average", "Above Average", "Pretty good", "Competent", "Good", "Very good",
  "Extraordinary", "Excellent", "Superb", "*COMPLETE*"];
const hitChance = n => (n <= 0 ? 7 : n <= 3 ? 6 : n <= 6 ? 5 : n <= 10 ? 4 : n <= 14 ? 3 : 2);
function immunity(d) { return d > 250 ? "*IMMUNE*" : d > 150 ? "EXTREME" : d > 90 ? "very strong" : d > 70 ? "strong" : d > 40 ? "above average" : d > 28 ? "average" : d > 10 ? "medium" : d > 4 ? "poor" : "very poor"; }
const skills = p => (Array.isArray(p.skills) && p.skills.length === 14 ? p.skills : (p.skills = Array(14).fill(0)));

// ================================================================== the Marketplace (MARKET.PAS) and sending stuff (SENDITEM.PAS)
export async function marketAction(action, body, p, c, ctx, out, finish) {
  const db = c.db;
  if (p.fight) ctx.fail("You are in the middle of a fight!");
  if (action === "market/train") {   // the Combat Master in the little hut
    if (p.trains === undefined) p.trains = 2;
    const what = String(body.what || "");
    if (!what) return finish(p, { train: { trains: p.trains, skills: skills(p).map((v, i) => ({ name: BASH[i], level: v, rank: BASH_RANK[Math.min(17, v)] })), immunity: immunity(p.disres || 0) } });
    if (what === "I") {
      if (p.trains < 1) { out.push(WHITE + "You have no training sessions left!"); return finish(p); }
      if ((p.disres || 0) >= 240) { out.push(WHITE + "You are already immune!", T + "No need to train this more."); return finish(p); }
      p.disres = (p.disres || 0) + random(3) + 1; p.trains--;
      out.push(T + "Your immunity has increased!");
      if (p.race === R.Hobbit) { p.disres++; out.push(GOLD + "For being a Hobbit you receive extra disease resistance!"); }
      out.push(T + "Your resistance is now : " + HI + immunity(p.disres), T + "You have " + WHITE + p.trains + T + " training sessions left.");
      return finish(p);
    }
    const n = Math.trunc(+what);
    if (!(n >= 1 && n <= 14)) ctx.fail("Pick a skill.");
    if (p.trains < 1) { out.push(TALK + "You cannot learn more from your current level!" + T + ", " + PLY + "Liu Zei" + T + " says."); return finish(p); }
    const sk = skills(p);
    if (sk[n - 1] > 16) { out.push(T + "You cannot advance more in this skill.", T + "You are already an EXPERT!"); return finish(p); }
    let used = 0;
    do { p.trains--; sk[n - 1]++; used++; } while (body.full && p.trains > 0 && sk[n - 1] <= 16);
    out.push(T + "Let's see how far you can advance!", PLY + "Liu Zei" + T + " guides you through the art of |13" + BASH[n - 1] + T + ".", HI + "You have advanced in this skill!",
      T + "You've used " + GOLD + used + T + " training" + (used > 1 ? "s" : "") + ". You are now " + WHITE + BASH_RANK[Math.min(17, sk[n - 1])] + T + ".");
    if (sk[n - 1] > 16) out.push(GOLD + "Congratulations!", T + "You have completed your training!");
    return finish(p);
  }
  if (action === "market/beggars") {   // the Beggars Wall: who sits there
    const online = await onlineIds(db);
    const rows = (await db.prepare("SELECT user_id, data FROM usurper_players WHERE location = ? AND user_id != ? LIMIT 20").bind(LOC.beggar, p.id).all()).results;
    return finish(p, { beggars: rows.filter(r => !online.has(r.user_id)).map(r => { const q = JSON.parse(r.data); return { id: r.user_id, name: q.name, alive: q.hps > 0, sex: q.sex,
      line: pick(["Spare a coin, kind stranger?", "Alms for the poor!", "Have mercy upon me!", "God bless you, friend!", "I haven't eaten in days..."]) }; }) });
  }
  if (action === "market/alms" || action === "market/kill") {
    const v = await loadOther(c, Math.trunc(+body.id));
    if (!v || v.location !== LOC.beggar || v.hps < 1) ctx.fail(v ? v.name + " has left this location!" : "Nobody by that name.");
    if ((await onlineIds(db)).has(v.id)) { out.push(PLY + v.name + T + " is busy elsewhere!"); return finish(p); }
    if (action === "market/alms") {
      if ((p.chivnr ?? 0) < 1) { out.push(T + "You have run out of good deeds."); return finish(p); }
      const x = Math.max(0, Math.min(Math.trunc(+body.gold) || 0, p.gold));
      if (!x) return finish(p);
      p.gold -= x; p.chivnr--; v.gold += x; await save(db, v, c.t);
      const ch = random(10) + 5; p.chiv += ch;
      out.push(T + "You approach " + PLY + v.name + T + " and hand " + him(v) + " the money.", PLY + v.name + T + " bless you for your kindness and quickly", T + "returns to " + his(v) + " place. You feel how your soul", T + "is lightening...");
      c.later.push(() => mail(db, c.t, v.id, "Alms", p.name + " gave you " + cs(x) + " gold coins when you sat begging."));
      return finish(p);
    }
    if ((p.darknr ?? 0) < 1) { out.push(RED + "You have run out of dark deeds, my blood-thirsty friend!"); return finish(p); }
    if (p.team && p.team === v.team) { out.push(RED + "You are not allowed to attack your own team-mates!"); return finish(p); }
    if (p.spouse === v.id) { out.push(RED + "You can't attack your own " + (v.sex === 2 ? "wife" : "husband") + "!"); return finish(p); }
    const how = String(body.how || "S").toUpperCase(), X = PLY + v.name + T;
    const text = {
      S: [T + "You approach " + X + " and pretend to give " + him(v) + " some gold. But when " + he(v) + " reaches for " + his(v) + " begging cup", T + "you charge and overcome " + him(v) + ".", T + "A couple of minutes later and you realize that it's over."],
      B: [T + "You scan the vicinity for a nice weapon.", T + "Finally you find a wooden club!", T + "You return and approach " + X + " with a smile, and strike."],
      W: [T + "You approach " + X + " and pretend to give " + him(v) + " some gold.", T + "Then you charge " + him(v) + ". A quick move and it is over."],
      T: [T + "You sneak up behind " + X + " and swiftly strike with your dagger.", T + "You hold a firm grip until the deed is done..."],
      C: [X + " looks afraid as you approach " + him(v) + "...", T + "But you manage to get behind " + him(v) + " and finish it quickly.", T + "You cover the body with some old rags."],
    }[how] || [];
    out.push(...text, T + "Your soul darkens...");
    p.darknr--; p.dark += 100 + random(15);
    v.hps = 0; await save(db, v, c.t);
    await updateRel(c, -1, 1, v, p);
    const s = { S: " strangled the innocent " + RACES[v.race] + " " + X + ".", B: " beat the " + RACES[v.race] + " " + X + " to death with a club!", W: " wrung the innocent " + RACES[v.race] + " " + PLY + v.name + "s" + T + " neck.",
      T: " stabbed " + X + ", the " + RACES[v.race] + "!", C: " sliced " + PLY + v.name + "s" + T + " throat!" }[how] || " murdered " + X + "!";
    c.later.push(() => news(db, c.t, "Brutal Murder!", " " + PLY + p.name + T + s, " It all happened when " + X + " was begging for gold."));
    c.later.push(() => mail(db, c.t, v.id, "Murdered!", p.name + " viciously murdered you when you sat begging!"));
    return finish(p);
  }
  if (action === "team/send") {   // SENDITEM.PAS Team_Transfer: money or potions to an offline team-mate
    if (!p.team) ctx.fail("You are not in a team.");
    const v = await loadOther(c, Math.trunc(+body.id));
    if (!v || v.id === p.id || v.team !== p.team) ctx.fail("That isn't one of your team-mates.");
    if ((await onlineIds(db)).has(v.id)) { out.push(RED + "You can't send stuff to a character who is online from here."); return finish(p); }
    if (body.what === "gold") {
      const x = Math.trunc(+body.n) || 0;
      if (x < 1 || x > p.gold) { out.push(T + "You don't have that kind of gold!"); return finish(p); }
      p.gold -= x; v.gold += x;
      out.push(T + "The gold has been sent to " + PLY + v.name + T + ".");
      c.later.push(() => mail(db, c.t, v.id, "Gold!", p.name + " sent you " + cs(x) + " gold coins."));
    } else {
      let x = Math.trunc(+body.n) || 0;
      if (x < 1 || x > p.healing) { out.push(T + "You don't have that many!"); return finish(p); }
      if (v.healing + x > CFG.maxHeals) { out.push(T + "You can send max " + cs(Math.max(0, CFG.maxHeals - v.healing)) + " potions!"); return finish(p); }
      p.healing -= x; v.healing += x;
      out.push(T + "The potions have been sent to " + PLY + v.name + T + ".");
      c.later.push(() => mail(db, c.t, v.id, "Healing Potions!", p.name + " sent you " + cs(x) + " healing potions."));
    }
    await save(db, v, c.t);
    return finish(p);
  }
  return null;
}

// ================================================================== the Beer Hut brawl (BOBS.PAS, BRAWLC.PAS)
const BRAWL_RACES = ["human", "hobbit", "elf", "half-elf", "dwarf", "troll", "orc", "gnome", "gnoll", "mutant"];
const BRAWL_KEYS = "HOEADTRGNM";
const plural = r => (r === "elf" ? "elves" : r === "half-elf" ? "half-elves" : r === "dwarf" ? "dwarves" : r + "s");
function brawlFoes(b) { return b.foes.reduce((a, x) => a + x, 0); }
export async function brawlAction(action, body, p, c, ctx, out, finish) {
  const db = c.db;
  if (p.fight) ctx.fail("You are in the middle of a fight!");
  let b = p.brawl;
  if (action === "brawl/start") {
    if ((p.brawls ?? 3) < 1) { out.push("|05You are too exhausted!"); return finish(p); }
    const w = Math.trunc(+body.weapon) || 4, how = String(body.how || "S").toUpperCase();
    p.brawls = (p.brawls ?? 3) - 1;
    out.push(T + ["", "You grab a chair...", "You grab a stool...", "You grab a bottle...", "You roll up your sleeves..."][w]);
    let yy = Math.min(60, p.level * 5);
    if (p.level > 30) yy = p.level + random(10);
    if ([C.Barbarian, C.Paladin, C.Warrior].includes(p.cls)) yy += random(7);
    const foes = Array(10).fill(0);
    for (let x = yy; x > 0; x--) foes[random(10)]++;
    b = p.brawl = { foes, total: yy, ted: 0, sta: Math.max(1, p.sta), max: Math.max(1, p.sta), stunned: false, grabbed: false, knocks: 0, weapon: w === 4 ? 0 : w, phase: "round" };
    out.push(T + "There is a grim bunch of " + WHITE + yy + T + " characters in here.");
    out.push(...{ S: [T + "You take your beer and pour it over one of the ugliest-", T + "looking characters sitting at a table!"], C: [T + "You grab an empty bottle, and simply smash it over the head", T + "of one of the guests!"],
      P: [T + "You push one of the standing guests so he falls to", T + "the ground with a surprised look in his face!"], T: [T + "You make a large troll fly by gently putting out your left", T + "foot! Trouble has arrived!"],
      I: [T + "With words that would make your mother wash your mouth, you", T + "let the nearest guest hear what a particular swine he is!"] }[how] || []);
    if (random(2) === 0) {
      out.push(PLY + "Ted the Bartender" + T + " immediately grabs a wooden club and jumps", T + "over the counter to if possible prevent the wrecking of the bar!", TALK + "Get that troublemaker!!" + T + ", he screams, and points at YOU!");
      b.ted = 1; b.total++;
    }
    c.later.push(() => news(db, c.t, "Bar-Fight!", " " + PLY + p.name + T + " started a brawl in Bobs Beer!"));
    return brawlRun(p, c, out, finish, null);
  }
  if (!b) ctx.fail("There is no brawl going on.");
  return brawlRun(p, c, out, finish, body);
}
// One round at a time; stops when the brawler has to decide something.
async function brawlRun(p, c, out, finish, input) {
  const b = p.brawl, db = c.db;
  const agi = p.agi;
  const evade = (y) => { if (b.sta > 5) y++; if (p.cls === C.Jester) y++; if (agi > 50) y++; if (agi > 200) y++; if (agi > 700) y++; if (agi > 1300) y++; return y; };
  const raceName = i => BRAWL_RACES[i];
  for (let guard = 0; guard < 30; guard++) {
    if (b.phase === "object") {   // a flying chair: grab or duck
      if (!input || !/^[GD]$/i.test(input.key || "")) return finish(p, { brawl: brawlView(b) });
      let y = 2;
      if (p.cls === C.Jester) y++; if (b.sta < 2) y--; if (agi > 50) y++; if (agi > 200) y++; if (agi > 700) y++; if (agi > 1300) y++;
      if (input.key.toUpperCase() === "D") out.push(T + "You duck and...");
      else if (y >= 5 && random(2) === 0) { out.push(T + "With the speed of a Ninja warrior, you manage to grab the", T + "flying " + b.obj + "! You have made a deep impression on your opponents!"); y = 9999; }
      else { out.push(T + "In a pathetic attempt you try to catch the flying " + b.obj + "!", T + "But you are not even close!! It's too late to escape..."); y = 1; }
      if (y !== 9999) {
        if (random(y + 2) === 0) { out.push(T + "DONK! You are hit over the head...."); b.sta -= 2; }
        else out.push(T + "You manage to avoid the " + b.obj + " by throwing yourself to the floor!");
      }
      input = null; b.phase = "others";
      if (b.sta <= 0) return brawlLost(p, c, out, finish);
    }
    if (b.phase === "round") {
      if (random(5) === 0) {   // someone tries to get out
        const y = random(10);
        if (b.foes[y] > 0) {
          out.push(T + "A |10" + raceName(y) + T + " PANICS and tries to ESCAPE!");
          if (random(2) === 0) { out.push(T + "He managed to sneak out! What a coward!"); b.foes[y]--; b.total--; } else out.push(T + "He didn't make it! (hehe)");
        }
      }
      if (random(5) === 0) {   // a new guest
        const y = random(10);
        out.push(T + "The door to the Inn opens and a |10" + raceName(y) + T + " enters!");
        if (random(2) === 0) { out.push(T + "The |10" + raceName(y) + T + " immediately throws himself into the fight!"); b.foes[y]++; b.total++; }
        else out.push(T + "But he disappears when he sees what's going on!");
      }
      b.phase = "others";
      if (random(3) === 0 && b.ted + brawlFoes(b) > 0) {   // something comes flying
        b.obj = pick(["chair", "stool", "bottle"]);
        out.push(T + "Suddenly a " + b.obj + " comes flying!");
        if (random(b.ted + brawlFoes(b)) === 0) { out.push(T + "It's aimed for you!", T + "Try to :"); b.phase = "object"; return finish(p, { brawl: brawlView(b) }); }
        const i = b.foes.findIndex(x => x > 0);
        if (i >= 0) {
          out.push(T + "It's aimed for a " + raceName(i) + "!");
          if (random(4) === 0) { out.push(T + "The |10" + raceName(i) + T + " didn't manage to duck!", T + "He is hit over the head, and goes down!"); b.foes[i]--; }
          else out.push(T + "But the |10" + raceName(i) + T + " managed to avoid the flying object!");
        }
      }
    }
    if (b.phase === "others") {
      if (b.ted > 0) {   // Ted swings his club
        out.push(PLY + "Ted" + T + " swings his Club! He looks angrily at you!");
        let y = evade(0);
        if (b.stunned || b.grabbed) y = 1;
        if (random(y) === 0) {
          out.push(T + pick(["You are hit over the head!", "A fearsome stroke lands on your shoulder!", "A stroke lands on your leg!", "You are hit over the arms!", "Oouuchh! You receive a blow in the chest!"]), T + "You were too slow!");
          b.sta--;
          if (b.sta <= 0) {
            c.later.push(() => news(db, c.t, "Bar-Fight!", " " + PLY + p.name + T + " was knocked out by " + PLY + "Ted the Bartender" + T + "!", " (" + PLY + p.name + T + " managed to knock out " + b.knocks + " foes)"));
            return brawlLost(p, c, out, finish, true);
          }
        } else out.push(GOLD + pick(["You easily avoid Teds attack!", "You evade Teds fearsome attack!", "You avoid Teds attack with some difficulties!", "Teds stroke whistles pass you! Gee! That was close!"]));
      }
      if (brawlFoes(b) > 2 && random(4) === 0 && !b.grabbed) {   // a dirty fight
        out.push(T + "A guest grabs your left arm!", T + "Another grabs your right arm!", T + "A third starts to beat you up!", RED + "You are DEFENCELESS!");
        b.sta--; b.grabbed = true;
      }
      for (let i = 0; i < 10 && b.sta > 0; i++) {   // the other brawlers make their moves
        if (!b.foes[i]) continue;
        if (random(4) === 0) { out.push(T + "A chicken |10" + raceName(i) + T + " hides in the shadows!"); continue; }
        if (!(random(2) === 0 || brawlFoes(b) <= 1) || b.stunned || b.grabbed) continue;
        const x = random(14);
        out.push(T + "A |10" + raceName(i) + T + " charges! " + ["He tries to tackle you!", "He tries a drop-kick against you!", "He tries an uppercut against your head!", "He tries to bite you in the leg!",
          "He goes for a leg-sweep against you!", "He tries to break your arm!", "He sends off a Knifehand, aimed at your chest!", "He sends off a nervepunch!", "The bastard tries to choke you!",
          "He goes for a Headbash! Watch it!", "He tries to pull your hair!", "He goes for a kick, aimed at your body!", "He goes for a straight punch in your face!", "He comes rushing at you in high speed! RAM!"][x]);
        let y = evade(1);
        if (p.level > 50) y++; if (p.level > 95) y++;
        if (random(y) === 0) {
          out.push(RED + ["The hard tackle sends you across the floor! You lose your breath!", "You stagger under the impact from the kick!", "The stroke lands neatly on your chin! You see stars and moons!",
            "His bite goes deep in your leg! You are bleeding!", "You fall heavily to the floor!", "Cracck... Something just broke in your body! You are hurt bad!", "You lose your breath when his steelhand goes right in your chest!",
            "The stroke hits a nerve! You are stunned!", "He got you in a chokehold! You can't breathe!", "BONK! You are feeling dizzy! Your head aches!", "Arrgghhh! That really hurt! What a dirty trick!",
            "The well placed kick lands right in solar-plexus! Ouch!", "The punch lands right on your nose! You lose sense of all directions!", "His attack sends you sprawling! You fall to the floor!"][x]);
          if (x === 7) b.stunned = true;
          b.sta -= random(3) + 1;
          if (b.sta <= 0) {
            out.push(T + "Your head starts to spin, and you feel darkness...", T + "All your strength is gone!", T + "Before you slide into unconsciousness you feel how you are being", T + "frisked...");
            c.later.push(() => news(db, c.t, "Bar-Fight!", " Robbed and beaten, " + PLY + p.name + T + " was thrown out in the gutter!", " (" + PLY + p.name + T + " managed to knock out " + b.knocks + " foes)"));
            p.gold = 0; p.brawl = null;
            out.push("", T + "After a long time you wake up from your disgraceful experience.", T + "You find yourself laying in the gutter, outside Bobs Beer.", T + "All your valuables are gone, and you feel dizzy.");
            return finish(p, { brawl: null, over: true });
          }
        } else out.push(T + "You evade the attack!");
      }
      b.phase = (b.ted + brawlFoes(b) > 0 && !b.stunned && !b.grabbed) ? "act" : "end";
      if (b.phase === "act") {
        const r = Math.round(b.sta / b.max * 100);
        out.push(T + (r >= 100 ? "You are in Excellent condition" : r >= 80 ? "You have some small wounds and bruises" : r >= 70 ? "You have some wounds" : r >= 50 ? "You are pretty hurt!" : r >= 30 ? "You are in a bad shape!"
          : r >= 20 ? "You have some BIG and NASTY wounds!" : r >= 5 ? "You are in an awful condition!" : "You are bleeding from wounds ALL over your body!"));
        return finish(p, { brawl: brawlView(b) });
      }
    }
    if (b.phase === "act") {
      if (!input || !input.move) return finish(p, { brawl: brawlView(b) });
      const tk = String(input.target || "").toUpperCase(), mv = String(input.move).toUpperCase();
      const ti = tk === "*" ? 99 : BRAWL_KEYS.indexOf(tk);
      if (ti < 0 || (ti === 99 && !b.ted) || (ti !== 99 && !b.foes[ti])) return finish(p, { brawl: brawlView(b) });
      const s = ti === 99 ? PLY + "Ted the Bartender" + T : "the |10" + raceName(ti) + T;
      const down = () => { if (ti === 99) b.ted = 0; else b.foes[ti]--; b.knocks++; };
      input = null;
      if (mv === "0") {
        if (random(b.sta) === 0) out.push(T + "You make a dash for the door!", RED + "But it's blocked!");
        else {
          out.push(T + "You make it out through a window! (chicken!)");
          c.later.push(() => news(db, c.t, "Bar-Fight!", " " + PLY + p.name + T + " fled the fight! (what a chicken!)"));
          p.brawl = null;
          return finish(p, { brawl: null, over: true });
        }
      } else if (mv === "T") {
        if (!b.weapon) return finish(p, { brawl: brawlView(b) });
        const a = ["", "chair", "stool", "bottle"][b.weapon];
        out.push(T + "You aim and throw the " + a + " at " + s + "!");
        b.weapon = 0;
        if (random(3) === 0) { out.push(GOLD + "The " + a + " hits " + s + GOLD + "!", GOLD + "He loses sense of all directions!"); down(); }
        else {
          out.push(T + "He manages to duck!");
          if (random(10) === 0) { out.push(T + "He manages to catch the " + a + "! He throws it back at you!"); if (random(4) === 0) { out.push(RED + "KLONK! You were hit! That really hurt!"); b.sta--; } else out.push(T + "You manage to avoid the flying object!"); }
        }
      } else {
        const n = "ABCDEFGHIJKLMN".indexOf(mv);
        if (n < 0) return finish(p, { brawl: brawlView(b) });
        const tries = ["Here goes...You take a run and then charge " + s + " and try a tackle!", "BANZAI! You rush " + s + " and try a Drop-Kick!", "You try an uppercut against " + s + "!",
          "You throw yourself against " + s + " with a fearsome battlecry!", "You try a Leg-Sweep against " + s + "!", "You try to break " + s + "s arm!", "You send off a Knifehand against " + s + "!",
          "You try a Nerve Punch against " + s + "!", "You try to get " + s + " in a Chokehold!", "You go for a Headbash against " + s + "!", "You try to pull " + s + "s hair!", "You kick at " + s + "!",
          "You send off a Straight Punch at " + s + "!", "You rush " + s + " with your head lowered!"];
        out.push(T + tries[n]);
        if (random(hitChance(skills(p)[n])) !== 0) out.push(T + pick(["He evades your attack!", "He elegantly blocks your assault!", "But he manages to avoid the assault!", "But he jumps aside just before you reach him!"]));
        else { out.push(GOLD + pick(["Your " + BASH[n] + " hits VERY hard!", "He goes down!", "He loses sense of all directions!", "You send him flying!"])); down(); }
      }
      b.phase = "end";
    }
    if (b.phase === "end") {
      if (brawlFoes(b) < 3) b.grabbed = false;
      if (b.grabbed) {
        out.push(T + "You must get out of this! They are beating you up!");
        if (random(2) === 0) out.push(RED + "You didn't manage to get loose!"); else { out.push(WHITE + "You managed to get away!"); b.grabbed = false; }
      }
      if (b.stunned) {
        out.push(RED + "You are laying on the floor stunned!");
        const i = b.foes.findIndex(x => x > 0 && random(3) === 0);
        if (i >= 0) { out.push(T + "A " + raceName(i) + " approaches! He grins evilly and " + RED + pick(["kicks you in the head!", "kicks you in the chest!", "jumps on your head!", "punches you in the face!"]), RED + "You suffer from your wounds!"); b.sta -= random(2) + 1; }
        b.stunned = false;
      }
      if (b.sta <= 0) return brawlLost(p, c, out, finish);
      if (b.ted + brawlFoes(b) <= 0) {   // cleaned the place out
        c.later.push(() => news(db, c.t, "Bar-Fight!", " " + PLY + p.name + T + " managed to knock out |07" + b.total + T + " foes!", " " + He(p).toUpperCase() + " cleaned the place out!"));
        const xp = b.total * 350, g = b.total * pick([750, 500, 250, 155]);
        out.push(WHITE + "Good Work! You are a true fighter! You managed to stay on your feet!", T + "You receive " + GOLD + cs(xp) + T + " experience points!", T + "You frisk the bodies and find " + GOLD + cs(g) + T + " " + money(g) + "!");
        p.exp += xp; p.gold += g; p.brawl = null;
        return finish(p, { brawl: null, over: true });
      }
      b.phase = "round";
    }
  }
  return finish(p, { brawl: brawlView(b) });
}
function brawlLost(p, c, out, finish, byTed) {
  const b = p.brawl;
  if (!byTed) c.later.push(() => news(c.db, c.t, "Bar-Fight!", " " + PLY + p.name + T + " was knocked out! (loser)", " " + PLY + p.name + T + " managed to knock out |07" + b.knocks + T + " foes."));
  p.gold = 0; p.brawl = null;
  out.push(WHITE + "You have been knocked unconscious!", WHITE + "Better luck next time Conan!", "|07Darkness...");
  return finish(p, { brawl: null, over: true });
}
function brawlView(b) {
  return { phase: b.phase, ted: b.ted, weapon: b.weapon, foes: b.foes.map((n, i) => ({ key: BRAWL_KEYS[i], race: BRAWL_RACES[i], n })).filter(f => f.n > 0), sta: b.sta, max: b.max };
}

// ================================================================== the Gym (GYM.PAS)
// Owned by a gang; members carry club cards. Work-outs, the barrel masters, tug-of-war, massage.
async function gymOwner(db) {
  const r = await db.prepare("SELECT data FROM usurper_realm WHERE k = 'gym'").first();
  const g = r ? JSON.parse(r.data) : { team: "", barrels: [] };
  if (g.team && !(await db.prepare("SELECT 1 FROM usurper_teams WHERE name = ?").bind(g.team).first())) g.team = "";
  return g;
}
async function saveGym(db, g) { await db.prepare("INSERT OR REPLACE INTO usurper_realm (k, data) VALUES ('gym', ?)").bind(JSON.stringify(g)).run(); }
const GYMC = "|13";
export async function gymAction(action, body, p, c, ctx, out, finish) {
  const db = c.db;
  if (p.fight) ctx.fail("You are in the middle of a fight!");
  const g = await gymOwner(db);
  const owner = !!(g.team && p.team === g.team);
  const member = owner || !!(p.gymCard && p.gymCard === g.team);
  if (p.gymSessions === undefined) p.gymSessions = 4;
  if (action === "gym/info") {
    const members = (await db.prepare("SELECT data FROM usurper_players WHERE json_extract(data, '$.gymCard') = ? OR (team = ? AND team != '') LIMIT 30").bind(g.team || "-", g.team || "-").all()).results
      .map(r => { const q = JSON.parse(r.data); return { name: q.name, level: q.level, owner: !!g.team && q.team === g.team }; });
    return finish(p, { gym: { team: g.team, owner, member, sessions: p.gymSessions, massage: p.massage || 0, members } });
  }
  if (action === "gym/apply") {   // ask the owners for a club card
    if (member) { out.push(RED + "Hey bird-brain! You already ARE a member here!"); return finish(p); }
    if (!g.team) { out.push(RED + "There is nobody to send the application to! The Gym is not owned by anyone right now!", RED + "Why don't you take over the Gym now when you have the chance!?"); return finish(p); }
    const owners = (await db.prepare("SELECT user_id FROM usurper_players WHERE team = ? LIMIT 5").bind(g.team).all()).results;
    for (const o of owners) await request(c, o.user_id, p.id, "gymcard", { team: g.team });
    out.push(WHITE + "Your application has been sent to the " + TC + g.team + WHITE + " crew.", T + "You will have to wait and see.");
    return finish(p);
  }
  if (action === "gym/takeover") {
    if (!p.team) { out.push(RED + "You must be in a Team to be able to take over the Gym!"); return finish(p); }
    if (owner) { out.push(GOLD + "The Gym is owned by your gang!"); return finish(p); }
    if (!g.team) {
      g.team = p.team; await saveGym(db, g);
      out.push(WHITE + "YOU ARE IN CHARGE OF " + GYMC + "THE GYM" + WHITE + " NOW! CONGRATULATIONS!", WHITE + "Informing your crew...");
      for (const m of (await db.prepare("SELECT user_id FROM usurper_players WHERE team = ? AND user_id != ?").bind(p.team, p.id).all()).results)
        c.later.push(() => mail(db, c.t, m.user_id, "Gym Take-Over!", p.name + " led your crew in the take-over of The Gym!"));
      c.later.push(() => news(db, c.t, "New Gym Owners!", " The " + TC + p.team + T + " crew took over the " + GYMC + "Gym" + T + ".", " Old members may have to re-apply for new membership cards."));
      return finish(p, { owner: true });
    }
    return gymFistfight(p, c, g, out, finish);
  }
  if (!member) ctx.fail("The Gym is for owners and members only.");
  if (action === "gym/barrels") {   // Lift beer-barrels, and the Barrel Hall of Fame
    if (body.list) return finish(p, { barrels: g.barrels || [] });
    if (p.gymSessions < 1) { out.push(RED + "You have no gym sessions left today!"); return finish(p); }
    const brls = random(p.level) + random(p.str);
    p.gymSessions--;
    out.push(T + "You managed to lift " + WHITE + cs(brls) + T + " barrels!");
    const list = (g.barrels || []).filter(x => x.id !== p.id || x.n > brls);
    if (!(g.barrels || []).some(x => x.id === p.id && x.n >= brls)) list.push({ id: p.id, name: p.name, level: p.level, race: RACES[p.race], cls: CLASSES[p.cls], n: brls, day: today() });
    list.sort((a, b) => b.n - a.n);
    g.barrels = list.slice(0, 15);
    const pos = g.barrels.findIndex(x => x.id === p.id && x.n === brls) + 1;
    await saveGym(db, g);
    if (pos > 0) {
      out.push(WHITE + "Congratulations!!", WHITE + "You made it to #" + pos + " in the BARREL HALL OF FAME!");
      c.later.push(() => news(db, c.t, "Barrel Champion!", " " + PLY + p.name + T + " lifted " + WHITE + cs(brls) + T + " beer barrels!", " " + PLY + p.name + T + " entered position " + WHITE + pos + T + " in the |11Barrel Hall of Fame" + T + "!"));
    } else out.push(RED + "You didn't make it to the hall of fame.");
    return finish(p);
  }
  if (action === "gym/massage") {   // White Water only (see docs/USURPER.md)
    if ((p.massage || 0) >= 1) { out.push(RED + "You have already had your daily dose of massage!"); return finish(p); }
    const cost = p.level * 450;
    if (!owner) {
      if (!body.confirm) return finish(p, { offer: { cost } });
      if (p.gold < cost) { out.push(RED + "You don't have enough gold!"); return finish(p); }
      p.gold -= cost; out.push(T + "You cough up the gold.");
    }
    p.massage = (p.massage || 0) + 1;
    out.push(GOLD + "White Water", PLY + "Hazzan" + T + " the masseur leads you to a quiet room downstairs.", T + "You stretch out on a wooden bench...", PLY + "Hazzan" + T + " makes his appearance a few minutes later, carrying",
      T + "a pail with |06White Water" + T + ".", GOLD + "Ahhh..nice feeling..." + WHITE + "Your Hitpoints maxed out!");
    p.hps = p.maxhps;
    if (p.maxmana > 0) { p.mana = p.maxmana; out.push(GOLD + "Ahhh..nice feeling..." + WHITE + "Your Mana maxed out!"); }
    out.push(T + "With his gentle hands, " + PLY + "Hazzan" + T + " relieves your body of its stiffness...", GOLD + "Ahhh..great feeling..." + WHITE + "Your pouch with Healing Potions is bulging!");
    p.healing = p.healing < CFG.maxHeals ? CFG.maxHeals + 5 : p.healing + 200;
    if (random(2) === 0) {
      const r = await db.prepare("SELECT user_id, name FROM usurper_players WHERE user_id != ? ORDER BY random() LIMIT 1").bind(p.id).first();
      if (r) {
        const v = await loadOther(c, r.user_id);
        out.push(T + "A name suddenly pops into your head; " + PLY + v.name + T + "!", T + "Your mind is filled with " + GOLD + "nice" + T + " pictures of you and " + PLY + v.name + T + " having a good time.", WHITE + "Your relation with " + PLY + v.name + WHITE + " improved!");
        await updateRel(c, 1, 1, v, p); await updateRel(c, 1, 1, p, v, { noSelfMail: true });
      }
    }
    return finish(p);
  }
  if (action === "gym/tug") {   // Tug-of-war: your gang against another, five a side
    if (!p.team) { out.push(RED + "You must be in a Team to pull the rope!"); return finish(p); }
    if (p.gymSessions < 1) { out.push(RED + "You have no gym sessions left today!"); return finish(p); }
    const other = clean(body.team, 40);
    if (!other || other.toUpperCase() === p.team.toUpperCase()) ctx.fail("Pick another team.");
    const online = await onlineIds(db);
    const home = (await db.prepare("SELECT user_id, data FROM usurper_players WHERE team = ? AND hps > 0 ORDER BY exp DESC LIMIT 5").bind(p.team).all()).results.filter(r => r.user_id === p.id || !online.has(r.user_id));
    const away = (await db.prepare("SELECT user_id, data FROM usurper_players WHERE team = ? AND hps > 0 ORDER BY exp DESC LIMIT 5").bind(other).all()).results.filter(r => !online.has(r.user_id));
    if (!away.length) { out.push(RED + "Nobody from " + other + " can come and pull right now."); return finish(p); }
    p.gymSessions--;
    const names = rs => rs.map(r => r.user_id === p.id ? p.name : JSON.parse(r.data).name);
    out.push(WHITE + "Preparing everybody....", WHITE + "DONE!", WHITE + "Pull!", TC + p.team + T + ": " + names(home).join(", "), TC + other + T + ": " + names(away).join(", "));
    let t1 = 26, t2 = 26, bout = 0;
    const log = [];
    while (t1 > 0 && t2 > 0 && bout <= 79) {
      bout++;
      const r = random(3);
      if (r === 0) { t1 = Math.min(26, t1 + 4); t2 = Math.max(0, t2 - 4); log.push(GOLD + "You are pulling them in!!"); }
      else if (r === 1) { t2 = Math.min(26, t2 + 4); t1 = Math.max(0, t1 - 4); log.push(RED + "The other Team caught you off-guard!"); }
      else log.push("|11Both teams struggle...");
    }
    out.push(...log.slice(-6));
    const result = bout > 79 ? "draw" : t2 < 1 ? "win" : "loss";
    if (result === "draw") out.push(WHITE + "A Draw!", WHITE + "Both Teams are exhausted...", WHITE + "You shake hands on a match well performed.");
    else if (result === "win") out.push(GOLD + "You Won!", T + "The Crowd goes crazy over your performance!");
    else out.push(RED + "You lost!!", T + "You can hear the Crowd booing your lousy performance!");
    const reward = (rows, won) => {
      for (const r of rows) {
        const lv = r.user_id === p.id ? p.level : JSON.parse(r.data).level, x = lv * (result === "draw" ? 150 : 250);
        if (result !== "draw" && !won) continue;
        if (r.user_id === p.id) { p.exp += x; out.push(T + "You earned " + WHITE + cs(x) + T + " experience points!"); }
        else c.later.push(() => bump(db, r.user_id, "exp", x));
      }
      for (const r of rows) if (r.user_id !== p.id) c.later.push(() => mail(db, c.t, r.user_id, "Tug-of-War Competition", p.name + " arranged a Tug-of-War Competition, " + p.team + " against " + other + ".",
        result === "draw" ? "It ended in a DRAW." : (won ? "Your team WON!" : "Your team lost.")));
    };
    reward(home, result === "win"); reward(away, result === "loss");
    c.later.push(() => news(db, c.t, "Tug-of-War", " " + TC + p.team + T + " and " + TC + other + T + " met in a Tug-of-War Competition!",
      result === "draw" ? " It ended in a draw after " + bout + " rounds." : " " + TC + (result === "win" ? p.team : other) + T + " won the competition!"));
    return finish(p);
  }
  if (action === "gym/card" || action === "gym/exclude" || action === "gym/abandon") {   // the owners' powers
    if (!owner) ctx.fail("Only the owners can do that.");
    if (action === "gym/abandon") {
      g.team = ""; await saveGym(db, g);
      out.push(RED + "You abandon control of the Gym!");
      c.later.push(() => news(db, c.t, "Gym Abandoned!", " The " + TC + p.team + T + " crew gave up the " + GYMC + "Gym" + T + "."));
      return finish(p);
    }
    const v = await loadOther(c, Math.trunc(+body.id));
    if (!v || v.id === p.id) ctx.fail("Couldn't locate that character.");
    if (action === "gym/card") {
      v.gymCard = g.team; await save(db, v, c.t);
      out.push(WHITE + PLY + v.name + WHITE + " has been given a club card.");
      c.later.push(() => mail(db, c.t, v.id, "Gym Membership", "You have been given a club card to the Gym by " + p.name + "!"));
    } else {
      v.gymCard = null; await save(db, v, c.t);
      out.push(WHITE + PLY + v.name + WHITE + " has been thrown out of the Gym.");
      c.later.push(() => mail(db, c.t, v.id, "Gym Membership", "Your club card to the Gym has been revoked by " + p.name + "!"));
    }
    return finish(p);
  }
  if (action === "gym/quit") {
    if (owner) { out.push(RED + "You are one of the owners! You idiot!"); return finish(p); }
    p.gymCard = null;
    out.push(RED + "You shred your membership card and leave the Gym...!");
    c.later.push(() => news(db, c.t, "Troublemaker leaves!", " " + PLY + p.name + T + " was not satisfied with the " + GYMC + "Gym" + T + " facilities.", " The " + RACES[p.race] + " burned " + his(p) + " membership card!"));
    return finish(p, { left: true });
  }
  return null;
}
// Take_Over_The_Gym: your gang against the owners, bare fists, until one side is knocked cold.
async function gymFistfight(p, c, g, out, finish) {
  const db = c.db, online = await onlineIds(db);
  const load = async team => (await db.prepare("SELECT user_id, data FROM usurper_players WHERE team = ? AND hps > 0 LIMIT 5").bind(team).all()).results;
  const defRows = (await load(g.team)).filter(r => !online.has(r.user_id));
  if ((await load(g.team)).some(r => online.has(r.user_id))) { out.push(RED + "Sorry, Gym owners currently online. Wait until they have left."); return finish(p); }
  const fighter = (id, q) => ({ id, name: q.name, level: q.level, sta: Math.max(1, q.sta), skills: Array.isArray(q.skills) ? q.skills : Array(14).fill(0), exp: 0, kills: [] });
  if (!defRows.length) return takeGym(p, c, g, out, finish, [], [], "unopposed");
  const atkRows = (await load(p.team)).filter(r => r.user_id !== p.id && !online.has(r.user_id));
  const atk = [fighter(p.id, p), ...atkRows.map(r => fighter(r.user_id, JSON.parse(r.data)))].slice(0, 5);
  const def = defRows.map(r => fighter(r.user_id, JSON.parse(r.data))).slice(0, 5);
  out.push(RED + "FIGHT!", TC + p.team + T + " storm the " + GYMC + "Gym" + T + "! " + TC + g.team + T + " defend it!");
  const strike = (a, side, foes) => {
    const alive = foes.filter(f => f.sta > 0);
    if (!alive.length) return;
    const t = pick(alive), mv = random(14), eff = random(a.skills[mv] || 0) + 3;
    if (random(2) === 0) {
      t.sta -= eff;
      if (t.sta < 1) { a.kills.push(t.name); a.exp += t.level * 250; t.by = a.name; side.push(PLY + a.name + T + "s " + BASH[mv] + " knocks out " + PLY + t.name + T + "!"); }
    }
  };
  let rounds = 0;
  while (atk.some(f => f.sta > 0) && def.some(f => f.sta > 0) && rounds++ < 200) {
    const log = [];
    for (const a of atk) if (a.sta > 0) strike(a, log, def);
    for (const d of def) if (d.sta > 0) strike(d, log, atk);
    out.push(...log);
  }
  const won = def.every(f => f.sta < 1);
  for (const f of [...atk, ...def]) {
    if (f.id === p.id) { p.exp += f.exp; if (f.exp) out.push(T + "You earn " + WHITE + cs(f.exp) + T + " experience points."); }
    else if (f.exp) await bump(db, f.id, "exp", f.exp);
  }
  if (!won) {
    out.push(RED + "Your crew was beaten! The " + TC + g.team + RED + " gang keeps the Gym.");
    c.later.push(() => news(db, c.t, "Gym Fight!", " The " + TC + p.team + T + " crew tried to take over the " + GYMC + "Gym" + T + ",", " but the " + TC + g.team + T + " owners threw them out!"));
    return finish(p);
  }
  return takeGym(p, c, g, out, finish, atk, def, "fight");
}
async function takeGym(p, c, g, out, finish, atk, def, how) {
  const db = c.db, old = g.team;
  if (how === "unopposed") out.push(WHITE + "The members in " + TC + old + WHITE + " are dead, incapacitated or otherwise", WHITE + "unable to defend their turf! The " + GYMC + "GYM" + WHITE + " is yours! CONGRATULATIONS!");
  else out.push(GOLD + "VICTORY! The " + GYMC + "Gym" + GOLD + " is yours!");
  g.team = p.team; await saveGym(db, g);
  await db.prepare("UPDATE usurper_players SET data = json_remove(data, '$.gymCard') WHERE json_extract(data, '$.gymCard') = ?").bind(old).run();
  for (const f of def) c.later.push(() => mail(db, c.t, f.id, "Gym Lost!", p.name + " and the " + p.team + " crew took over the Gym!", f.by ? "You were knocked out by " + f.by + "." : ""));
  c.later.push(() => news(db, c.t, "New Gym Owners!", " The " + TC + p.team + T + " crew took over the " + GYMC + "Gym" + T + " from " + TC + old + T + "!", " Old members may have to re-apply for new membership cards."));
  return finish(p, { owner: true });
}
