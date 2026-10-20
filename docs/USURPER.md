# Usurper on The Septic Tankz

**USURPER** (c) 1993-2009 Jakob Dangarden. Ported to Free Pascal by Rick Parrish,
bug fixes by Dan Zingaro. Usurper is free software under the GNU General Public
License, version 2 or (at your option) any later version. Source:
https://github.com/rickparrish/Usurper

This door is a conversion of the core of that source to JavaScript. The files that
make it up carry the same license, the GNU GPL v2 or later:

| File | What it is |
| --- | --- |
| `worker/doors/usurper.js` | The game engine on the board server. Every rule and die roll happens here. |
| `worker/doors/usurper_data.js` | Usurper's own data tables: 1,001 monsters, 203 classic weapons, 218 classic armors, the 101-step experience table |
| `web/doors/usurper.js` | The screens and menus in the terminal |
| `migrations/0009_usurper.sql` | Characters, the Daily News, in-game mail |

The data tables were extracted from the original editor's source (`SOURCE/EDITOR`:
`EDMONST.PAS`, `EDMONST2.PAS`, `ADDMONST.PAS`, `EWEAPON.PAS`, `EDARMOR.PAS`,
`LEVRES.PAS`). The editor rolled each monster's random strength and spells once when
it wrote `MONSTER.DAT`; the table here is one such roll, made the same way.

## What was converted, and from where

| Part of the game | Pascal source |
| --- | --- |
| Character creation: gender, the 10 races and 11 classes, their start values, the Troll/Orc Paladin rule | `USERHUNC.PAS` |
| Main Street | `GAMEC.PAS` |
| The daily reset: 25 dungeon fights, 3 player fights, dark deeds, 3% bank interest, the dead rise | `MAINT.PAS` |
| The Dungeons of Drunghin: levels 1-100, monsters drawn by level, level changes (your level to +10), the monk who sells potions after a fight | `DUNGEONC.PAS` |
| Fighting monsters: attack, run, heal, quick heal, fight to death, beg for mercy, Assassin backstab, Paladin soul strike, Gnoll poison bite, monster spells (Cause Damage, Snakes, Cyclone, Summon Undead, Vice of Death, Drain Life), dungeon rewards | `PLVSMON.PAS`, `VARIOUS.PAS` (`normal_attack`, `normal_defence`, `dungeon_reward`, `quick_healing`, `healing`) |
| Spells for Clerics, Magicians and Sages: the damage, healing, armor and hold spells (see below) | `CAST.PAS`, `SPELLSU.PAS` |
| Level raises with each class's stat gains, the ten Masters and how each changes them, the gold you receive | `LEVMAST.PAS`, `VARIOUS2.PAS` (`level_raise`, `raise_player`), `LEVRES.PAS` |
| Weaponstore (Tully) and Armorshop (Reese) in CLASSIC mode: buy, the best you can afford, sell for half, list, the troll discount | `WEAPSHOP.PAS`, `ARMSHOP.PAS` |
| Ravanella's Magic Shop: healing potions at 5 gold per level | `MAGIC.PAS` |
| The Healing Hut (Jadu The Fat): disease cures at their prices | `HEALERC.PAS` |
| Bank of Wealth (Lobba): deposit and withdraw | `BANK.PAS` |
| The Empty Barrel (Garth): rooms on four floors; attackers pay 2,500-12,500 in bribes to reach a guest | `INNC.PAS` |
| The Dormitory: sleeping there for free, the list of souls, attacking guests: pick-pocket, murder, wake up and challenge | `DORM.PAS`, `VARIOUS3.PAS` (`Attack_Guest`) |
| Player fights, with the sleeping player fighting back from their stored stats: potions, backstabs, soul strikes, begging for mercy, taking the purse, the after-fight note | `PLVSPLC.PAS`, `PLVSPL2.PAS` |
| The Daily News and the mail waiting for you ("Since your last visit ...") | `NEWS.PAS`, `MAIL.PAS` |

Settings follow Usurper's shipped defaults (`SAMPLES/USURPER.CFG` and the
fallbacks in the code): CLASSIC game mode, 10,000 gold to start, 125 potions at
most, armor absorbs 25% of its power, a 5-level limit on attacking weaker players,
no experience lost on death, and no resurrections: die and you're out until
tomorrow.

## How it plays on this board

- **Shared world, loose multiplayer.** Everyone plays in one town. When you quit
  you choose where to sleep: the Dormitory (free) or a room at the Inn. Anyone
  sleeping who isn't on the board right now can be attacked, and their stored
  character fights back. They find out from their mail the next time they play.
- **Online means on the board.** A player whose phone line is active can't be
  attacked.
- **Days** are New York calendar days. Each character's daily reset runs the first
  time it's touched each day.
- All the rules run on the board server; the terminal only shows what comes back.

## Changes from the original

- The drugs, steroids and brothel locations are left out (Usurper's own "Soft"
  game mode did the same).
- A pick-pocket who gets caught fights it out turn by turn instead of watching an
  automatic fight.
- Spells: only those with simple effects are converted so far: Cure Light, Cure
  Critical, Heal, Power Hat, Armor, Shield, Fog of War, Baptize Monster, Sleep,
  Freeze, Magic Missile, Fireball, Lightning Bolt, Pillar of Fire, Power word
  KILL, Holy Explosion, Call Lightning, Gods Finger, Roast, Hit Self, Energy
  Drain, Death Kiss. The rest are listed but greyed out.
- Diseases only come from spells and the Mad Mage, which aren't converted yet, so
  the Healing Hut has little to do for now.
- Hiring door guards for your Inn room isn't converted, so the bribe is the only
  protection.

## Not converted yet (future work)

Gangs and team fights, the Castle and the throne, royal quests and guards, the
Gods and the Altar, marriage and children, homes, the Marketplace and sending
items, the Gym, wrestling, brawls, the Beggars Wall, bounty hunting, prison,
dungeon events and the Uman caves, the Supreme Being below level 100, NPC
characters, the NEW (inventory) game mode with its item editor, haggling, the
remaining spells, and the full Status and Relations screens.
