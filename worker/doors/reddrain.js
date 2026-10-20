// Legend of the Red Drain: a shared-world forest RPG door, in the spirit of the classic daily-turn
// BBS RPGs. Everything here is original. All rules and dice live on the server; the browser only draws.
//
// One row per player in rd_players. The fight in progress (monster, master or dragon) is kept in the
// row as JSON, so a dropped carrier picks up where it left off. Days are New York calendar days and
// roll over lazily, on a player's first request of the day.

const FIGHTS_PER_DAY = 18;
const PVP_PER_DAY = 3;
const START_GOLD = 250;   // enough for a plunger and some rubber gloves
const ONLINE_MS = 10 * 60_000;   // played this recently = still in the game, can't be attacked

// XP needed to challenge the master at each level (master N moves you from level N to N+1;
// master 12 earns the right to face the dragon).
const XPNEED = [0, 100, 400, 1000, 2500, 6000, 14000, 32000, 70000, 150000, 320000, 700000, 1500000];

const nice = n => { const p = Math.pow(10, Math.max(0, String(Math.round(n)).length - 2)); return Math.round(n / p) * p; };
const WEAPONS = ["Bare Hands", "Plunger", "Toilet Brush", "Snake Auger", "Pipe Wrench", "Flange Flail", "Ballcock Mace",
  "Rusty Rebar", "Copper Pipe Spear", "Ratchet of Ruin", "The Sump Hammer", "Septic Scythe", "Grease Trap Glaive",
  "Hydro-Jetter", "Vorpal Snake", "Excalibidet"]
  .map((name, t) => ({ name, power: t ? Math.round(6 * Math.pow(1.65, t - 1)) : 2, price: t ? nice(100 * Math.pow(2.05, t - 1)) : 0 }));
const ARMORS = ["Birthday Suit", "Rubber Gloves", "Plumber's Kneepads", "Galoshes", "Rain Poncho", "Hip Waders", "Chest Waders",
  "Canvas Coveralls", "Leather Apron", "Tyvek Suit", "Hazmat Suit", "Manhole Cover Shield", "Cast Iron Cuirass",
  "Septic Plate Mail", "The Porcelain Aegis", "Armor of the Golden Throne"]
  .map((name, t) => ({ name, power: t ? Math.round(4 * Math.pow(1.65, t - 1)) : 0, price: t ? nice(100 * Math.pow(2.05, t - 1)) : 0 }));

const CLASSES = {
  P: { name: "Plumber", hp: 22, str: 13, def: 2, skill: "Power Plunge",
       blurb: "Strong arms, strong stomach. Power Plunge hits for double and then some." },
  M: { name: "Septic Mystic", hp: 18, str: 11, def: 2, skill: "Methane Bolt",
       blurb: "Reads the bubbles. Methane Bolt ignores armor and leaves the foe too dazed to swing back." },
  T: { name: "Drain Thief", hp: 20, str: 12, def: 3, skill: "Sneak Strike",
       blurb: "Slips through any pipe. Sneak Strike hits hard and lifts a little extra gold." },
};

const MASTERS = [null,
  ["Gus the Grease Monkey", "You plunge like my grandma. Show me something.", "Huh. Not bad, kid. Not bad at all."],
  ["Wanda Wetvac", "I've sucked up tougher things than you off a basement floor.", "Okay, okay! You're ready for level three."],
  ["Sir Clogsalot", "None shall pass. Mostly because I'm stuck.", "You've freed me, and you've earned it."],
  ["Brother Ballcock", "The water rises. The float rises. Will YOU rise?", "The tank is full. Go in peace."],
  ["Madame Flapper", "Darling, I've seen a thousand flushes. Impress me.", "Divine! Simply divine."],
  ["Rusty Valvez", "Thirty years on the job. Zero leaks. Let's go.", "First leak in thirty years. Well played."],
  ["The Sump Sisters", "We work in pairs. You work alone. Bad odds.", "Fine. FINE. Take your level."],
  ["Old Man Effluent", "I was flowing to the leach field before your parents were born.", "Heh. The current's yours now."],
  ["Lady Leachfield", "Everything ends up in my field eventually. Including you.", "Grow strong, little sprout."],
  ["Captain Backflow", "What goes down must come back up. Mostly on you.", "Reversing course. You win."],
  ["The Honeywagon Baron", "I own every pump truck in the county. What do YOU own?", "You'll go far. Take a card."],
  ["Grandmaster Porcelain", "Beat me and the way to the Red Drain opens. It is not a gift.", "Go, then. The Dragon waits below."],
];

// Ten foes per level, weakest first: "Name|what it does to you".
const MONSTERS = [null,
  ["Damp Sock|flaps wetly at you", "Angry Silverfish|nibbles your ankle", "Lint Gremlin|throws lint in your eyes",
   "Soggy Newspaper|slaps you with the sports section", "Toilet Paper Mummy|unrolls all over you", "Drain Fly|buzzes up your nose",
   "Rubber Duck Gone Bad|squeaks menacingly and pecks", "Wet Wipe Wraith|clings to your face", "Hairball Hatchling|coughs on you",
   "Soap Scum Slug|slimes your boots"],
  ["Sewer Rat|bites you", "Clogged Gnome|bonks you with a tiny plunger", "Grease Goblin|smears you with something",
   "Mildew Mite Swarm|crawls all over you", "Rogue Bath Bomb|fizzes in your face", "Rabid Raccoon|claws at you",
   "Fatberg Pup|rolls into your shins", "Leaky Faucet Imp|drips on your head, relentlessly", "Moldy Mop|swabs you hard",
   "Toothpaste Tube Fiend|squirts you in the eye"],
  ["Cockroach Knight|charges you, lance first", "Sludge Toad|tongue-lashes you", "Drain Snake|coils around your leg",
   "Rusted Pipe Bandit|clubs you", "Flushed Goldfish (Huge Now)|fin-slaps you", "Swamp Gas Spirit|wafts right at you",
   "Gutter Goblin|kicks wet leaves at you", "Muskrat Bruiser|headbutts you", "Sump Pump Golem|sprays you",
   "Hairy Clog Beast|tangles you up"],
  ["Alligator of Urban Legend|chomps you", "Sewer Skeleton|rattles its bones and swings", "Septic Sprite|zaps you with stink",
   "Overflow Ogre|stomps on you", "Grease Trap Ghoul|gnaws at you", "Mutant Leech|drains you",
   "Pipe Bandit Chief|robs you of your dignity", "Moss Troll|smothers you", "Backwash Wolf|howls and bites",
   "Diaper Djinn|grants you three wishes, all for pain"],
  ["Rat Ogre|mauls you", "Fat Cat Plumber|sends you a bill", "Barnacled Brute|scrapes you raw", "Tank Lurker|drags you under",
   "Methane Wisp|ignites right next to you", "Cesspool Kobold|stabs you with a fork", "Lamprey Lord|latches on",
   "Bog Bandit|steals a boot and kicks you with it", "Corroded Knight|swings a rusty sword", "Hydra of Hoses|sprays you from five heads"],
  ["Sewer Minotaur|gores you", "Mudslide Elemental|buries you", "Clog Colossus|crushes you", "Septic Shaman|curses your plumbing",
   "Toadstool Titan|spores you", "Cockroach Queen|lays eggs on you", "Flatulent Wyrmling|breathes on you",
   "Backflow Banshee|shrieks", "Rust Monster|takes the shine off your gear", "Gilded Grub|bites you"],
  ["Sludge Golem|slams you", "Ghost of Plumbers Past|haunts your wallet", "Grease Dragonling|burns you", "The Rat King|sends his subjects at you",
   "Waterlogged Wight|chills you", "Tar Pit Terror|engulfs you", "Pipe Organ Phantom|plays a chord of doom",
   "Abyssal Augerworm|bores into you", "Corrosion Witch|hexes you", "Bog Beast|thrashes you"],
  ["Leviathan of the Lagoon|swallows you briefly", "Lord of the Flies|sends the swarm", "Cast Iron Cyclops|punches you",
   "Sewer Sphinx|asks a riddle and hits you anyway", "Fatberg Prime|rolls over you", "Necroplumber|raises dead pipes against you",
   "Swamp Hag|cackles and scratches", "Gargoyle of the Gutter|dives at you", "Chlorine Chimera|burns your eyes", "Mud Kraken|squeezes you"],
  ["Toxic Tyrant|poisons you", "Bilge Behemoth|tramples you", "The Clogfather|makes you an offer you can't refuse",
   "Sulfur Seraph|blasts you", "Drain Lich|siphons your life", "Effluent Elemental|floods you", "Mire Manticore|stings you",
   "Pump Station Juggernaut|steamrolls you", "Rotgut Revenant|slashes you", "Sewage Siren|sings you toward the rocks"],
  ["Titan of the Treatment Plant|smashes you", "Sludge Wyrm|breathes sludge on you", "Grand Grease Lich|freezes you in lard",
   "Archfiend Augerius|drills you", "Plague Rat Emperor|sends a plague", "Cesspit Colossus|stomps you flat",
   "Bowl Golem Supreme|swirls you", "Night Soil Knight|charges you", "Black Water Hydra|bites with seven heads",
   "Methane Phoenix|explodes and re-forms"],
  ["The Septic Seraphim|smites you", "Leviathan Unclogged|crushes you", "Lord Fatberg the Undying|smothers you",
   "The Backflow Horror|engulfs you", "The Abyssal Plumber|wrenches your soul", "Doom Augerworm|bores through you",
   "Queen of the Lagoon|drowns you", "Toxic Archon|rains acid on you", "Septic Dreadnought|broadsides you",
   "Ancient Grease Dragon|scorches you"],
  ["Chaos Clog|unmakes you a little", "Eldritch Effluent|whispers madness", "Void Plunger|pulls you toward nothing",
   "The Pipe That Should Not Be|coils around you", "Sludge Titan Prime|pummels you", "Elder Rat God|gnaws at reality, and you",
   "Primordial Ooze|dissolves you", "Archdemon of Drains|rends you", "The Last Fatberg|crushes you",
   "Herald of the Red Drain|burns you with red water"],
];

// ------------------------------------------------------------------ helpers
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const chance = p => Math.random() < p;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function monsterStats(level, v) {
  const g = Math.pow(1.62, level - 1);
  return {
    hp: Math.max(4, Math.round(20 * g * v)), str: Math.max(3, Math.round(10.5 * g * v * (level === 1 ? 0.8 : 1))), def: Math.round(3 * g * v),
    gold: Math.round(25 * Math.pow(1.8, level - 1) * v * (0.8 + Math.random() * 0.4)),
    xp: Math.max(1, Math.round((XPNEED[level] - XPNEED[level - 1]) / 22 * v * (0.85 + Math.random() * 0.3))),
  };
}
function skillUses(p) { return 2 + Math.floor(p.level / 3); }
function atk(p) { return p.str + WEAPONS[p.weapon].power; }
function armor(p) { return p.def + ARMORS[p.armor].power; }
// One blow: half the attack is guaranteed, the rest is luck; half the target's armor soaks it.
function blow(attack, defense) { return Math.max(0, Math.round(attack / 2 + Math.random() * attack / 2 - defense / 2)); }

function view(p) {
  return {
    handle: p.handle, cls: p.cls, clsName: CLASSES[p.cls].name, skill: CLASSES[p.cls].skill,
    level: p.level, xp: p.xp, xpNeed: XPNEED[p.level], hp: p.hp, maxhp: p.maxhp, str: p.str, def: p.def,
    attack: atk(p), armorTotal: armor(p),
    gold: p.gold, bank: p.bank, weapon: p.weapon, armor: p.armor, weaponName: WEAPONS[p.weapon].name, armorName: ARMORS[p.armor].name,
    fights: p.fights, pfights: p.pfights, skills: p.skills, alive: !!p.alive, wins: p.wins, kills: p.kills,
    masterDone: p.master_day === p.day, dragonOk: !!p.dragon_ok, days: p.days,
    fight: p.fight ? publicFight(JSON.parse(p.fight)) : null,
    healCost: healCost(p),
  };
}
function publicFight(f) { return { kind: f.kind, name: f.name, hp: f.hp, maxhp: f.maxhp }; }
function healCost(p) { return Math.max(1, Math.round(1.2 * Math.pow(1.105, p.level - 1))); }

async function news(db, text) {
  const t = Date.now();
  await db.batch([
    db.prepare("INSERT INTO rd_news (at, day, text) VALUES (?, ?, ?)").bind(t, today(), text),
    db.prepare("DELETE FROM rd_news WHERE at < ?").bind(t - 14 * 86400_000),
  ]);
}

async function load(ctx) {
  const p = await ctx.db.prepare("SELECT * FROM rd_players WHERE user_id = ?").bind(ctx.user.id).first();
  if (!p) return null;
  const d = today();
  if (p.day !== d) {            // a new day in Flushing
    p.day = d; p.days += 1;
    p.fights = FIGHTS_PER_DAY; p.pfights = PVP_PER_DAY; p.skills = skillUses(p);
    if (!p.alive) { p.alive = 1; p.hp = p.maxhp; }
    p.hp = Math.max(p.hp, p.maxhp);   // a night's sleep heals you
    p.bank = Math.floor(p.bank * 1.01);   // 1% interest a day
    p._dirty = true;
  }
  if (p.handle !== ctx.user.handle) { p.handle = ctx.user.handle; p._dirty = true; }
  return p;
}
const COLS = ["handle", "cls", "level", "xp", "hp", "maxhp", "str", "def", "gold", "bank", "weapon", "armor", "fights", "pfights",
  "skills", "alive", "inn", "wins", "kills", "day", "days", "master_day", "dragon_ok", "fight", "last_at"];
async function save(ctx, p) {
  p.last_at = Date.now();
  const r = await ctx.db.prepare(
    "UPDATE rd_players SET " + COLS.map((c, i) => c + " = ?" + (i + 1)).join(", ") + ", rev = rev + 1 WHERE user_id = ?" + (COLS.length + 1) + " AND rev = ?" + (COLS.length + 2)
  ).bind(...COLS.map(c => p[c] ?? null), p.user_id, p.rev).run();
  if (!r.meta.changes) ctx.fail("The pipes are backed up. Try that again.", 409);
  p.rev += 1;
}
async function need(ctx) {
  const p = await load(ctx);
  if (!p) ctx.fail("You don't have a character yet.", 404);
  return p;
}
function requireAlive(ctx, p) {
  if (!p.alive) ctx.fail("You're dead. The Leach Field claims you until tomorrow.");
}
function requireNoFight(ctx, p) {
  if (p.fight) ctx.fail("You're in the middle of a fight!");
}
function levelUp(p) {
  const c = CLASSES[p.cls];
  p.level += 1;
  p.maxhp = Math.round(p.maxhp * 1.6) + rnd(1, 4);
  p.str = Math.round(p.str * 1.55) + rnd(0, 2);
  p.def = Math.round(p.def * 1.55) + rnd(0, 1);
  p.hp = p.maxhp;
  p.skills = Math.max(p.skills, skillUses(p));
  return c;
}
function freshStats(p, cls, wins) {
  const c = CLASSES[cls];
  Object.assign(p, {
    cls, level: 1, xp: 0, maxhp: c.hp + wins * 4, str: c.str + wins * 2, def: c.def + wins, gold: START_GOLD + wins * 500,
    weapon: 0, armor: 0, dragon_ok: 0, fight: null,
  });
  p.hp = p.maxhp;
  p.skills = skillUses(p);
}

// ------------------------------------------------------------------ combat
function startFight(p, f) { p.fight = JSON.stringify(f); }
function round(ctx, p, mode) {
  const f = JSON.parse(p.fight);
  const log = [];
  let dmg = 0, stunned = false;
  if (mode === "run") {
    const odds = f.kind === "dragon" ? 0.35 : f.kind === "master" ? 1 : 0.6;
    if (chance(odds)) {
      p.fight = null;
      log.push(f.kind === "master" ? "You bow out. " + f.name + " shrugs. \"Come back when you're ready.\"" : "You run like a clogged drain finally letting go. You got away!");
      return { log, outcome: "fled" };
    }
    log.push("You try to run, but " + f.name + " blocks the way!");
  } else if (mode === "skill") {
    if (p.skills < 1) ctx.fail("You're out of " + CLASSES[p.cls].skill + " for today.");
    p.skills -= 1;
    if (p.cls === "P") {
      dmg = Math.round(blow(atk(p), f.def / 2) * 2.5) + 1;
      log.push("|14POWER PLUNGE!|07 You put your whole back into it and hit " + f.name + " for |15" + dmg + "|07 damage!");
    } else if (p.cls === "M") {
      dmg = Math.round(blow(atk(p), 0) * 1.9) + 1; stunned = true;
      log.push("|13METHANE BOLT!|07 A green flash scorches " + f.name + " for |15" + dmg + "|07 damage. It reels, dazed by the fumes.");
    } else {
      dmg = Math.round(blow(atk(p), f.def) * 2.1) + 1;
      const lift = Math.round((f.gold || 0) * (0.2 + Math.random() * 0.3)) + rnd(1, 5 * p.level);
      f.bonus = (f.bonus || 0) + lift;
      log.push("|10SNEAK STRIKE!|07 You slip behind " + f.name + " and hit for |15" + dmg + "|07, lifting |14" + lift + "|07 gold on the way.");
    }
  } else {
    dmg = blow(atk(p), f.def);
    if (chance(0.06)) { dmg = dmg * 2 + 1; log.push("|14**CRITICAL**|07 You find a weak spot!"); }
    log.push(dmg ? "You hit " + f.name + " with your " + WEAPONS[p.weapon].name + " for |15" + dmg + "|07 damage." : "You miss " + f.name + " entirely.");
  }
  f.hp -= dmg;
  if (f.hp <= 0) {
    p.fight = null;
    return { log, outcome: "win", f };
  }
  if (!stunned) {
    const hit = blow(f.str, armor(p));
    p.hp = Math.max(0, p.hp - hit);
    log.push(hit ? "|12" + cap(f.name) + " " + f.verb + " for " + hit + " damage." : cap(f.name) + " " + f.verb + ", but it glances off your " + ARMORS[p.armor].name + ".");
  }
  if (p.hp <= 0) {
    p.fight = null;
    return { log, outcome: "lose", f };
  }
  p.fight = JSON.stringify(f);
  return { log, outcome: null, f };
}

async function finish(ctx, p, r) {
  const f = r.f, log = r.log;
  if (r.outcome === "win") {
    if (f.kind === "monster") {
      const gold = f.gold + (f.bonus || 0);
      p.gold += gold; p.xp += f.xp;
      log.push("", "|10You have killed " + f.name + "!|07", "You find |14" + gold + "|07 gold and gain |11" + f.xp + "|07 experience.");
      if (p.xp >= XPNEED[p.level] && p.master_day !== p.day && p.level <= 12 && !(p.level === 12 && p.dragon_ok))
        log.push("|13You feel ready. Your master at the Training Hall should hear about this.");
    } else if (f.kind === "master") {
      const m = MASTERS[p.level];
      p.gold += f.bonus || 0;
      log.push("", "|15" + m[0] + ": |07\"" + m[2] + "\"");
      if (p.level === 12) {
        p.dragon_ok = 1; p.hp = p.maxhp;
        log.push("|12The way to the Red Drain is open. Look for it in the deepest part of the Leach Field.");
        await news(ctx.db, "|15" + p.handle + "|07 bested |14" + m[0] + "|07. The Red Drain Dragon stirs...");
      } else {
        levelUp(p);
        log.push("|10*** You are now level " + p.level + "! ***", "|07HP |15" + p.maxhp + "|07, strength |15" + p.str + "|07, defense |15" + p.def + "|07. You feel fully healed.");
        await news(ctx.db, "|15" + p.handle + "|07 defeated |14" + m[0] + "|07 and is now level |15" + p.level + "|07.");
      }
    } else if (f.kind === "dragon") {
      p.wins += 1;
      const wins = p.wins;
      log.push("", "|12THE RED DRAIN DRAGON|07 lets out a gurgle that shakes the whole county, and sinks, at last, into the dark water. The pipes of Flushing run clear.",
        "", "|14You are a legend.|07 The people carry you through town. Then, because this is Flushing, everyone forgets you by morning. " +
        "You wake up at level 1 with a little something extra: |15+2 strength, +4 hit points and +1 defense|07 for every dragon you've slain.");
      freshStats(p, p.cls, wins);
      await news(ctx.db, "|12*** |15" + p.handle + "|12 HAS SLAIN THE RED DRAIN DRAGON! ***|07 (dragon kill #" + wins + ")");
    }
  } else if (r.outcome === "lose") {
    if (f.kind === "master") {
      p.hp = 1;
      log.push("", "|15" + MASTERS[p.level][0] + "|07 knocks you flat, then helps you up.", "\"Not today. Come back tomorrow.\" You limp out with 1 hit point.");
    } else {
      const lostGold = p.gold, lostXp = Math.floor(p.xp / 10);
      p.alive = 0; p.hp = 0; p.gold = 0; p.xp -= lostXp;
      log.push("", "|12You have been killed by " + f.name + ".|07",
        "|07You lose the |14" + lostGold + "|07 gold you were carrying and |11" + lostXp + "|07 experience.",
        "|08The Leach Field keeps you until tomorrow.");
      await news(ctx.db, "|15" + p.handle + "|07 was killed by |12" + f.name + "|07" + (f.kind === "dragon" ? " in the depths of the Red Drain." : " in the Leach Field."));
    }
  }
  await save(ctx, p);
  return { log, outcome: r.outcome, player: view(p) };
}

// Forest happenings. Each one costs a fight, like a battle would.
const EVENTS = [
  p => { const g = rnd(10, 40) * p.level * p.level; p.gold += g; return ["|14A gold tooth glints in a puddle.|07", "You pocket it. Worth |14" + g + "|07 gold at the pawn shop. Don't think about it."]; },
  p => { if (p.hp < p.maxhp) { p.hp = p.maxhp; return ["|13The Bidet Fairy rises from a sparkling fountain.|07", "\"Refreshing, isn't it?\" You are |10fully healed|07."]; }
         p.maxhp += 1 + Math.floor(p.level / 3); p.hp = p.maxhp;
         return ["|13The Bidet Fairy rises from a sparkling fountain.|07", "You're already healthy, so she blesses you instead. |10Max HP up!|07"]; },
  p => { p.fights += 2; return ["|11A pump truck driver waves you over.|07", "\"Hop in, I'll get you to the good spots.\" You save time: |10+2 fights today|07."]; },
  p => { const x = Math.max(1, Math.round((XPNEED[p.level] - XPNEED[p.level - 1]) / 12)); p.xp += x;
         return ["|15An old septic man is tangled in his own hose.|07", "You help him out. He tells you a war story that's actually useful. |11+" + x + " experience|07."]; },
  p => { const g = Math.min(p.gold, rnd(5, 25) * p.level); p.gold -= g;
         return ["|12The Toll Rat of the Culvert demands payment.|07", g ? "There are a lot of them. You pay |14" + g + "|07 gold." : "You have nothing. The rats laugh at you and leave."]; },
  p => { if (chance(0.5)) { p.str += 1; return ["|10A traveling salesman sells you Dr. Pipe's Tonic.|07", "It tastes like a radiator. You feel |10stronger|07 (+1 strength)."]; }
         const h = Math.min(p.hp - 1, Math.round(p.maxhp / 5)); p.hp -= h;
         return ["|10A traveling salesman sells you Dr. Pipe's Tonic.|07", "It tastes like a radiator because it IS radiator fluid. You lose |12" + h + "|07 HP."]; },
  p => { const h = Math.min(p.hp - 1, Math.round(p.maxhp / 4)); p.hp -= h;
         return ["|12BACKFLOW!|07 A pipe bursts right next to you.", "You are hosed down with something warm. You lose |12" + h + "|07 HP and some self-respect."]; },
  p => { p.def += 1; return ["|11You find a lost rubber duck and return it to a crying child.|07", "The child's mom gives you her old oven mitts. |10+1 defense|07."]; },
  p => { const g = rnd(1, 3) * 50 * p.level; p.bank += g;
         return ["|14The County Water Board sends you a refund check.|07", "Overcharged since 1987. |14" + g + "|07 gold, deposited straight to the bank."]; },
];

// ------------------------------------------------------------------ actions
export async function handle(action, body, ctx) {
  const { db } = ctx;
  switch (action) {
    case "status": {
      let p = await load(ctx);
      const notices = [];
      if (p) {
        if (p.inn) p.inn = 0;   // walking out of the inn
        const rows = (await db.prepare("SELECT id, at, text FROM rd_notices WHERE user_id = ? AND seen = 0 ORDER BY id LIMIT 20").bind(ctx.user.id).all()).results;
        if (rows.length) await db.prepare("UPDATE rd_notices SET seen = 1 WHERE user_id = ? AND id <= ?").bind(ctx.user.id, rows[rows.length - 1].id).run();
        notices.push(...rows);
        await save(ctx, p);
      }
      return {
        player: p ? view(p) : null, notices,
        weapons: WEAPONS, armors: ARMORS, masters: MASTERS.map(m => m && m[0]),
        classes: Object.fromEntries(Object.entries(CLASSES).map(([k, c]) => [k, { name: c.name, skill: c.skill, blurb: c.blurb }])),
        fightsPerDay: FIGHTS_PER_DAY,
      };
    }
    case "me": {
      const p = await need(ctx);
      if (p._dirty) await save(ctx, p);
      return { player: view(p) };
    }
    case "create": {
      if (await load(ctx)) ctx.fail("You already have a character.");
      const cls = String(body.cls || "").toUpperCase();
      if (!CLASSES[cls]) ctx.fail("Pick a class.");
      const p = { user_id: ctx.user.id, handle: ctx.user.handle, bank: 0, wins: 0, kills: 0, alive: 1, inn: 0, days: 1, day: today(),
        fights: FIGHTS_PER_DAY, pfights: PVP_PER_DAY, master_day: null, last_at: Date.now(), rev: 0 };
      freshStats(p, cls, 0);
      await db.prepare("INSERT INTO rd_players (user_id, created_at) VALUES (?, ?)").bind(ctx.user.id, Date.now()).run();
      await save(ctx, p);
      await news(db, "|15" + p.handle + "|07 arrived in Flushing, a fresh-faced |11" + CLASSES[cls].name + "|07.");
      return { player: view(p) };
    }
    case "forest": {
      const p = await need(ctx); requireAlive(ctx, p);
      if (p.fight) return { player: view(p), resume: true };
      if (p.fights < 1) ctx.fail("You're too tired to fight any more today. Come back tomorrow.");
      p.fights -= 1;
      if (chance(0.11)) {
        const text = EVENTS[rnd(0, EVENTS.length - 1)](p);
        await save(ctx, p);
        return { event: text, player: view(p) };
      }
      const i = rnd(0, 9);
      const [name, verb] = MONSTERS[p.level][i].split("|");
      const s = monsterStats(p.level, 0.75 + i * 0.06);
      startFight(p, { kind: "monster", name, verb, maxhp: s.hp, ...s });
      await save(ctx, p);
      return { player: view(p) };
    }
    case "attack": case "skill": case "run": {
      const p = await need(ctx);
      if (!p.fight) ctx.fail("There's nothing here to fight.");
      return finish(ctx, p, round(ctx, p, action));
    }
    case "master": {
      const p = await need(ctx); requireAlive(ctx, p); requireNoFight(ctx, p);
      const m = MASTERS[p.level];
      if (p.level === 12 && p.dragon_ok) return { say: "Grandmaster Porcelain looks up. \"I have nothing left to teach you. The Dragon waits below the Leach Field.\"", player: view(p) };
      if (p.master_day === p.day) return { say: m[0] + " is icing a sore shoulder. \"One lesson a day. Come back tomorrow.\"", player: view(p) };
      if (p.xp < XPNEED[p.level])
        return { say: m[0] + " looks you over. \"Not yet. You need |11" + (XPNEED[p.level] - p.xp) + "|07 more experience before you waste my time.\"", player: view(p) };
      if (!body.fight) return { ready: true, greet: m[1], player: view(p) };
      p.master_day = p.day;
      const g = Math.pow(1.62, p.level - 1);
      const hp = Math.round(20 * g * 2.2);
      startFight(p, { kind: "master", name: m[0], verb: "lands a textbook blow", hp, maxhp: hp, str: Math.round(10.5 * g * 1.25), def: Math.round(3 * g * 1.4), gold: 0 });
      await save(ctx, p);
      return { player: view(p) };
    }
    case "dragon": {
      const p = await need(ctx); requireAlive(ctx, p); requireNoFight(ctx, p);
      if (p.level < 12 || !p.dragon_ok) ctx.fail("You can't find the way down. Grandmaster Porcelain knows it.");
      if (p.fights < 1) ctx.fail("You're too tired to face the Dragon today.");
      p.fights -= 1;
      const hp = 48000 + rnd(0, 4000);
      startFight(p, { kind: "dragon", name: "the Red Drain Dragon", verb: "spews boiling red water at you", hp, maxhp: hp, str: 3100, def: 900, gold: 0 });
      await save(ctx, p);
      return { player: view(p) };
    }
    case "heal": {
      const p = await need(ctx); requireAlive(ctx, p); requireNoFight(ctx, p);
      const want = Math.max(0, Math.min(p.maxhp - p.hp, body.all ? p.maxhp : Math.trunc(+body.hp || 0)));
      const per = healCost(p);
      const can = Math.min(want, Math.floor(p.gold / per));
      if (!want) return { say: "You look fine to me, hon.", player: view(p) };
      if (!can) return { say: "That'll be " + per + " gold a hit point, and you're broke.", player: view(p) };
      p.hp += can; p.gold -= can * per;
      await save(ctx, p);
      return { say: "Hilda slaps a poultice on you. |10" + can + "|07 HP restored for |14" + can * per + "|07 gold.", player: view(p) };
    }
    case "buy": {
      const p = await need(ctx); requireNoFight(ctx, p);
      const list = body.kind === "armor" ? ARMORS : WEAPONS, col = body.kind === "armor" ? "armor" : "weapon";
      const t = Math.trunc(+body.tier);
      if (!(t >= 1 && t < list.length)) ctx.fail("We don't carry that.");
      if (t === p[col]) ctx.fail("You already have one of those.");
      const tradeIn = Math.floor(list[p[col]].price / 2);
      const cost = list[t].price - tradeIn;
      if (p.gold < cost) ctx.fail("That's " + list[t].price + " gold, less " + tradeIn + " for your trade-in. You're short.");
      p.gold -= cost; p[col] = t;
      await save(ctx, p);
      return { say: "Pleasure doing business. Enjoy your |15" + list[t].name + "|07.", player: view(p) };
    }
    case "bank": {
      const p = await need(ctx); requireNoFight(ctx, p);
      const amt = body.all ? (body.op === "dep" ? p.gold : p.bank) : Math.trunc(+body.amount || 0);
      if (amt <= 0) ctx.fail("How much?");
      if (body.op === "dep") { if (amt > p.gold) ctx.fail("You don't have that much on you."); p.gold -= amt; p.bank += amt; }
      else { if (amt > p.bank) ctx.fail("Your account doesn't have that much."); p.bank -= amt; p.gold += amt; }
      await save(ctx, p);
      return { player: view(p) };
    }
    case "inn": {
      const p = await need(ctx); requireAlive(ctx, p); requireNoFight(ctx, p);
      const cost = 20 * p.level;
      if (p.gold < cost) ctx.fail("A room is " + cost + " gold. Try the bank.");
      p.gold -= cost; p.inn = 1;
      await save(ctx, p);
      return { cost, player: view(p) };
    }
    case "players": {
      const rows = (await db.prepare("SELECT handle, cls, level, xp, wins, kills, alive FROM rd_players ORDER BY wins DESC, level DESC, xp DESC LIMIT 50").all()).results;
      return { rows: rows.map(r => ({ ...r, clsName: CLASSES[r.cls].name })) };
    }
    case "news": {
      const d = today();
      const rows = (await db.prepare("SELECT at, day, text FROM rd_news ORDER BY id DESC LIMIT 40").all()).results;
      return { today: d, rows };
    }
    case "targets": {
      const p = await need(ctx);
      const rows = (await db.prepare(
        "SELECT user_id id, handle, cls, level, wins FROM rd_players WHERE user_id != ? AND alive = 1 AND inn = 0 AND last_at < ? AND level >= ? ORDER BY level DESC, xp DESC LIMIT 20"
      ).bind(ctx.user.id, Date.now() - ONLINE_MS, Math.max(1, p.level - 2)).all()).results;
      return { rows: rows.map(r => ({ ...r, clsName: CLASSES[r.cls].name })), pfights: p.pfights };
    }
    case "pvp": {
      const p = await need(ctx); requireAlive(ctx, p); requireNoFight(ctx, p);
      if (p.pfights < 1) ctx.fail("You've picked enough fights for one day.");
      const v = await db.prepare("SELECT * FROM rd_players WHERE user_id = ?").bind(Math.trunc(+body.id) || 0).first();
      if (!v || v.user_id === p.user_id) ctx.fail("Nobody by that name is sleeping in the fields.");
      if (!v.alive || v.inn || v.last_at > Date.now() - ONLINE_MS || v.level < p.level - 2) ctx.fail("You can't get at " + v.handle + " right now.");
      p.pfights -= 1;
      const log = ["|07You find |15" + v.handle + "|07 asleep in the Leach Field and kick them awake.", ""];
      let php = p.hp, vhp = v.hp > 0 ? v.hp : v.maxhp;
      for (let i = 0; i < 40 && php > 0 && vhp > 0; i++) {
        const a = blow(atk(p), armor(v)); vhp -= a;
        if (i < 6) log.push(a ? "You hit " + v.handle + " for |15" + a + "|07." : "You miss " + v.handle + ".");
        if (vhp <= 0) break;
        const b = blow(atk(v), armor(p)); php -= b;
        if (i < 6) log.push(b ? "|12" + v.handle + " hits you for " + b + "." : v.handle + " swings and misses.");
      }
      if (php > 0 && vhp > 0) { php = Math.max(1, php); vhp = Math.max(1, vhp); }
      const won = vhp <= 0;
      const loser = won ? v : p, winner = won ? p : v;
      const loot = loser.gold, xpLoss = Math.floor(loser.xp / 10), xpGain = Math.max(1, Math.round((XPNEED[winner.level] - XPNEED[winner.level - 1]) / 10));
      loser.gold = 0; loser.xp -= xpLoss; loser.alive = 0; loser.hp = 0;
      winner.gold += loot; winner.xp += xpGain; winner.kills += 1;
      p.hp = won ? Math.max(1, php) : 0;
      if (won) v.hp = 0; else v.hp = Math.max(1, vhp);
      if (log.length > 14) log.push("|08...and so on, for a while.|07");
      if (won) log.push("", "|10You have killed " + v.handle + "!|07", "You take |14" + loot + "|07 gold off the body and gain |11" + xpGain + "|07 experience.");
      else log.push("", "|12" + v.handle + " has killed you!|07", "They take your |14" + loot + "|07 gold. You lose |11" + xpLoss + "|07 experience.", "|08The Leach Field keeps you until tomorrow.");
      const vr = await db.prepare("UPDATE rd_players SET hp = ?, gold = ?, xp = ?, alive = ?, kills = ?, rev = rev + 1 WHERE user_id = ? AND rev = ?")
        .bind(v.hp, v.gold, v.xp, v.alive, v.kills, v.user_id, v.rev).run();
      if (!vr.meta.changes) ctx.fail("They rolled over in their sleep. Try again.", 409);
      await save(ctx, p);
      await db.prepare("INSERT INTO rd_notices (user_id, at, text, seen) VALUES (?, ?, ?, 0)").bind(v.user_id, Date.now(), won
        ? "|15" + p.handle + "|07 found you asleep in the Leach Field and |12killed you|07." + (loot ? " They took |14" + loot + "|07 gold." : "") +
          (xpLoss ? " You lost |11" + xpLoss + "|07 experience." : "") + " You were dead until the next day."
        : "|15" + p.handle + "|07 attacked you in your sleep, and |10you killed them|07! You took their |14" + loot + "|07 gold and gained |11" + xpGain + "|07 experience.").run();
      await news(db, won ? "|15" + p.handle + "|07 killed |15" + v.handle + "|07 in their sleep." : "|15" + p.handle + "|07 tried to murder |15" + v.handle + "|07 in their sleep and |12got killed instead|07.");
      return { log, won, player: view(p) };
    }
  }
  ctx.fail("Unknown command.", 404);
}
