# Usurper on MEGAzine BBS

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
| **Phase 2:** Team Corner: create, join (team password), apply, quit, change password, sack a member, team messages, examine teams, team rankings and scores; 5 members at most | `TCORNER.PAS`, `SORTTEAM.PAS` |
| Gang wars: challenge a team or take the town, member-against-member bouts, experience for each bout won, turf changing hands, 2 team fights a day, the daily town reward to the team holding the town | `GANGWARS.PAS`, `CHALLENG.PAS`, `MAINT.PAS` |
| The Castle: outside the gates (donate to the treasury, apply for the Royal Guard, infiltrate), the list of monarchs, proclaiming yourself ruler of an empty throne | `CASTLE.PAS`, `GAMEC.PAS` |
| Ruling: the royal tax (0-5%, on good, evil or all), the treasury, moat creatures, hiring and paying guards, imprisoning, freeing and executing, proclamations, abdicating, sleeping in the royal bed | `CASTLE.PAS`, `KMAINT.PAS`, `EDITOR/MOATRES.PAS` (moat creatures) |
| Usurping the throne: swim the moat, beat each royal guard, then the king (who rises from the dead to defend); level 25 needed, no team, the king must not be on the board | `CHALLKNG.PAS` |
| The ruler's daily round: allowances, guard salaries paid from the treasury, the Royal Tax, quest expiry | `KMAINT.PAS`, `MAINT.PAS` |
| Royal quests: the king issues them (difficulty 1-10, the monster count and monster range by difficulty), players claim and fight them, rewards and penalties | `RQUESTS.PAS`, `PLYQUEST.PAS` |
| Prison: waking up in a cell, demanding release, 3 escape attempts a day, the king's prisoner list; breaking someone out (gate guard, prison guards) | `PRISONC.PAS`, `PRISONC1.PAS`, `PRISONF.PAS` |
| Bounty hunting: post a bounty (anonymously if you like), the Wanted list, the bounty paid to whoever kills the target | `BOUNTY.PAS`, `WANTEDSC.PAS` |
| The Beggars Wall: sleep by the wall for 500 gold and find 1,000 in the bank the next day | `GAMEC.PAS`, `MAINT.PAS` |
| **Phase 3:** Relations between characters (married, love, passion, friendship, trust, respect, normal, suspicion, anger, enemy, hate), relation news and mail, jealousy | `RELATION.PAS`, `RELATIO2.PAS` |
| The Love Corner: approach somebody (looks, feelings both ways), change attitude, dates (hold hands, dinner, kiss) answered by the other player, marriage (both in love, level × 150,000 gold), divorce (the children stay with the spouse and get depressed), the gift shop (roses, chocolate, scorpions), Lydia the gossip-monger (spy, poison a relation), married couples, love history, children in the realm | `LOVERS.PAS`, `MAIL.PAS` |
| Children: pregnancy (5 days), birth and naming, birthdays, upbringing costs, experience for raising them, leaving home at 18, the Royal Orphanage paid from the treasury | `CHILDREN.PAS`, `RELATION.PAS` (`Give_Birth`) |
| Home Sweet Home: list children, the nursery (children's party, sending a child to the Royal Care-House), custody (share, abandon, orphanage), an evening at home with your spouse, sleeping at home (safe from attacks) | `HOME.PAS` |
| The Supreme Being: level 100 meets it in the dungeons; the three doors (lantern, black sword, staffs), the cup, the final fight, the after-life choice (become a God, or rest in peace), the heroes list | `SUPREMEC.PAS`, `DUNGEONC.PAS`, `PLVSMON.PAS` |
| The Gods: becoming immortal, god ranks and power, daily deeds, power from believers; the Divine Realm (status, immortals, believers, flocks, mortals, examine, comment to the mortals, holy news, visiting Manwe for rank, recruiting believers, poisoning relations, freeing prisoners) | `VARGODS.PAS`, `GODWORLD.PAS`, `INITGODS.PAS` |
| The Temple / Altar of the Gods: worship and losing faith, sacrificing gold, desecrating altars, altars and god ranking, holy news | `TEMPLE.PAS` |
| All the remaining spells, including the lasting ones checked every round (Freeze, Sleep, Web, Fear, Escape, Invisibility, Angel, Duplicate, Giant, Prismatic Cage, Summon Demon, Divination), Disease, Poison and Steal | `CAST.PAS`, `SPELLSU.PAS` |
| Dungeon events: the wishing well, the old man/woman with a map (treasure, the worm cave), the wounded warrior (orc band), the treasure chest (gas, potions, scrolls: blessing, undead, the secret cave), the wounded traveller and his papers (delivered at the Magic Shop), the merchant (escort through three days of robbers, or robbery), the beggar, the witch-doctor, strangers (robbers, the burial-ground map) | `DUNGEVC.PAS`, `DUNGEV2.PAS`, `MAGIC.PAS` |
| The Cave of Uman: High and Low, Tame the Bear, Indian Wrestling with its log | `UMAN.PAS` |
| The Marketplace (classic mode): the Beggars Wall (alms, murder), the combat master (the 14 close-combat moves, disease immunity) | `MARKET.PAS` |
| Sending gold and healing potions to an offline team-mate (Team Corner) | `SENDITEM.PAS` |
| Bobs Beer Hut in the Shady Shops: the brawl (weapons, flying chairs, Ted the Bartender, dirty fights, the 14 moves) | `SHADY.PAS`, `BOBS.PAS`, `BRAWLC.PAS` |
| The Gym: taking it over (free, or a gang fistfight), club cards (applications answered by the owners), lifting beer barrels and the Barrel Hall of Fame, tug-of-war between gangs, massage | `GYM.PAS`, `CHALLENG.PAS` |

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
- Gang-war bouts are fought automatically, the way the original fought two
  computer-run characters; a member who isn't on the board comes in at full
  hitpoints. Bouts against royal guards and the king are played turn by turn.
- Phase 3 (migration `0026_usurper3.sql`): everyone here is a real player, so dates, gifts, family
  evenings, God recruitment and Gym applications wait for the other player to answer next time they
  play, the way Usurper handled offline human players.
- Left out to keep the board PG-13: the adult options (intimacy, "go to bed", the whorehouse, the Hall
  of Dreams), abortion, the harassed-woman dungeon event, sniffing glue, the drug palace, steroids and
  the Tox Utha't massage oil, and harming children (beating, poisoning, kidnapping). Children come from
  a married couple's evening at home (with the original's baby rules: a man and a woman, one in three,
  mothers 18-45 here instead of 14-45). An orphan the treasury can't pay for goes to a farm far away
  instead of to the wolves.
- Same-sex relationships and marriage are allowed (Usurper's AllowHomoRelations switch, on here).
- Characters who finish the game leave it: their row is removed and the account can start a new
  mortal or enter the Divine Realm as the God.
- The castle, the Team Corner, quests and the Wanted list sit under
  **Challenges** on Main Street. New tables come from migration
  `0024_usurper2.sql`; existing characters keep working with sane defaults.

## Not converted yet (future work)

NPC characters; the NEW (inventory) game mode with its item editor, items and the Players Market and
Alabat's store that need it; haggling; the Gym's dumb-bells (not finished in the original either);
Bobs Beer Hut's beer drinking, dancing and thievery; Orbs bar, Groggo's magic services and the
Alchemists' Heaven; Good Deeds and Evil Deeds from Main Street; the gods' child intervention and
suicide; casting spells in player fights; the King's marriage bans and royal adoption; the full
Status screen (STATUSC.PAS) and the Top-list screens of the Love Corner.
