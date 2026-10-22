// BASIC CLASSICS — four 1970s type-in games, rewritten for MEGAzine BBS.
// Hunt the Wumpus (after Gregory Yob, 1973), Deep Space Patrol (after Mike Mayfield's 1971 space-war
// game and the Ahl/Leedom expansion), Hammurabi (after Doug Dyment, 1968, and David Ahl's version)
// and Lunar Lander (after Jim Storer's 1969 LUNAR). New code and new words; the old rules.
(() => {
  const TITLES = {"wumpus": [" _  _ _   _ _  _ _____   _____ _  _ ___  __      ___   _ __  __ ___ _   _ ___", "| || | | | | \\| |_   _| |_   _| || | __| \\ \\    / / | | |  \\/  | _ \\ | | / __|", "| __ | |_| | .` | | |     | | | __ | _|   \\ \\/\\/ /| |_| | |\\/| |  _/ |_| \\__ \\", "|_||_|\\___/|_|\\_| |_|     |_| |_||_|___|   \\_/\\_/  \\___/|_|  |_|_|  \\___/|___/"], "trek": [" ___  ___ ___ ___   ___ ___  _   ___ ___   ___  _ _____ ___  ___  _", "|   \\| __| __| _ \\ / __| _ \\/_\\ / __| __| | _ \\/_\\_   _| _ \\/ _ \\| |", "| |) | _|| _||  _/ \\__ \\  _/ _ \\ (__| _|  |  _/ _ \\| | |   / (_) | |__", "|___/|___|___|_|   |___/_|/_/ \\_\\___|___| |_|/_/ \\_\\_| |_|_\\\\___/|____|"], "hammurabi": [" _  _   _   __  __ __  __ _   _ ___    _   ___ ___", "| || | /_\\ |  \\/  |  \\/  | | | | _ \\  /_\\ | _ )_ _|", "| __ |/ _ \\| |\\/| | |\\/| | |_| |   / / _ \\| _ \\| |", "|_||_/_/ \\_\\_|  |_|_|  |_|\\___/|_|_\\/_/ \\_\\___/___|"], "lander": [" _   _   _ _  _   _   ___   _      _   _  _ ___  ___ ___", "| | | | | | \\| | /_\\ | _ \\ | |    /_\\ | \\| |   \\| __| _ \\", "| |_| |_| | .` |/ _ \\|   / | |__ / _ \\| .` | |) | _||   /", "|____\\___/|_|\\_/_/ \\_\\_|_\\ |____/_/ \\_\\_|\\_|___/|___|_|_\\"]};
  const rnd = () => Math.random();
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));         // random int a..b
  const fx = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);

  async function title(name, color, credit) {
    cls();
    await out("\n" + TITLES[name].map(l => "|" + color + " " + l).join("\n") + "\n|08 " + credit + "\n" + rule(8));
  }
  async function askNum(prompt, opts = {}) {
    while (true) {
      await out(prompt);
      const s = (await readLine({ max: opts.max || 8 })).trim();
      if (s === "" && opts.blank !== undefined) return opts.blank;
      const n = Number(s);
      if (s !== "" && Number.isFinite(n)) return n;
      await out("|12 Numbers only, please.|07\n");
    }
  }
  function beep(f, d, at = 0) { if (A.ready()) A.tone([f], at, d, 0.25); }

  // ================================================================== HUNT THE WUMPUS
  // The cave is a squashed dodecahedron: 20 rooms, three tunnels each.
  const CAVE = [null, [2, 5, 8], [1, 3, 10], [2, 4, 12], [3, 5, 14], [1, 4, 6], [5, 7, 15], [6, 8, 17], [1, 7, 9], [8, 10, 18],
    [2, 9, 11], [10, 12, 19], [3, 11, 13], [12, 14, 20], [4, 13, 15], [6, 14, 16], [15, 17, 20], [7, 16, 18], [9, 17, 19],
    [11, 18, 20], [13, 16, 19]];
  const near = r => CAVE[r][ri(0, 2)];

  function wumpusSetup() {
    const rooms = [];
    while (rooms.length < 6) { const r = ri(1, 20); if (!rooms.includes(r)) rooms.push(r); }
    const [you, wump, p1, p2, b1, b2] = rooms;
    return { you, wump, pits: [p1, p2], bats: [b1, b2] };
  }
  async function wumpusHelp() {
    cls();
    await out("|14 HOW TO HUNT A WUMPUS\n" + rule(6) + "|07" + wrap(
      "The wumpus lives in a cave of 20 rooms. Each room has three tunnels to other rooms (the cave is " +
      "shaped like a dodecahedron, if you remember geometry class).\n\n" +
      "Hazards: two rooms have bottomless pits. Fall in and that's that. Two other rooms hold super bats. " +
      "Walk in and a bat grabs you and drops you in some random room, which could be anywhere, including trouble.\n\n" +
      "The wumpus has sucker feet, so pits don't bother him, and he's too heavy for bats. He usually sleeps. " +
      "Walking into his room, or shooting an arrow and missing, wakes him. Awake, he moves one room (three times " +
      "out of four) or stays put. If he ends up where you are, he eats you.\n\n" +
      "You have 5 crooked arrows. Each one can fly through 1 to 5 rooms; you name the rooms. If you name a room " +
      "with no tunnel from the last one, the arrow wanders down a random tunnel instead. It can come back and hit you.\n\n" +
      "Warnings, when you're one tunnel away:\n   wumpus: \"I smell a wumpus.\"   pit: \"I feel a draft.\"   bats: \"Bats nearby.\"") + "\n");
    await anyKey();
  }
  async function wumpusPlay(s) {
    let you = s.you, wump = s.wump, arrows = 5, moves = 0;
    const lose = async msg => { await out("\n" + msg + "\n|12 HA HA HA. You lose.|07\n"); beep(110, 0.8); return false; };
    const wakeWumpus = () => { if (rnd() < 0.75) wump = near(wump); };
    cls();
    await out("|14 Hunt the Wumpus|08  you enter the cave with 5 arrows...\n");
    while (true) {
      await out("\n");
      for (const r of CAVE[you]) {
        if (r === wump) await out("|12 I smell a wumpus!\n");
        if (s.pits.includes(r)) await out("|11 I feel a draft.\n");
        if (s.bats.includes(r)) await out("|13 Bats nearby!\n");
      }
      await out("|07 You are in room |15" + you + "|07.  Tunnels lead to |15" + CAVE[you].join("|07, |15") + "|07.  |08(" + arrows + " arrow" + (arrows === 1 ? "" : "s") + ")\n" +
        "|07 {S} Shoot  {M} Move  {Q} Quit |15");
      const k = await readKey("SMQ");
      if (k === "Q") { await out("\n|07 You climb out of the cave. The wumpus sleeps on.\n"); return null; }
      if (k === "M") {
        await out("\n");
        let to;
        while (true) {
          to = Math.trunc(await askNum("|07 Where to? |15", { max: 2 }));
          if (CAVE[you].includes(to)) break;
          await out("|08 Not possible. No tunnel goes there.\n");
        }
        moves++; you = to;
        while (true) {
          if (you === wump) {
            await out("|14 ...OOPS! You bumped a wumpus!\n");
            wakeWumpus();
            if (wump === you) return lose("|12 TSK TSK TSK. The wumpus got you!");
          }
          if (s.pits.includes(you)) return lose("|11 YYYIIIIEEEE... you fell into a bottomless pit.");
          if (s.bats.includes(you)) {
            await out("|13 ZAP! Super bat snatch! Off to elsewhereville for you.\n"); beep(1800, 0.15); beep(2200, 0.15, 0.15);
            you = ri(1, 20); continue;
          }
          break;
        }
        continue;
      }
      // Shoot a crooked arrow.
      await out("\n");
      let n;
      do n = Math.trunc(await askNum("|07 Number of rooms (1-5)? |15", { max: 1 })); while (n < 1 || n > 5);
      const path = [];
      for (let i = 0; i < n; i++) {
        let r;
        while (true) {
          r = Math.trunc(await askNum("|07 Room #" + (i + 1) + "? |15", { max: 2 }));
          if (r < 1 || r > 20) { await out("|08 There are only 20 rooms.\n"); continue; }
          if (i >= 2 && r === path[i - 2]) { await out("|08 Arrows aren't that crooked. Try another room.\n"); continue; }
          break;
        }
        path.push(r);
      }
      moves++;
      let at = you;
      beep(900, 0.08);
      for (const r of path) {
        at = CAVE[at].includes(r) ? r : near(at);
        if (at === wump) {
          await out("\n|10 AHA! You got the wumpus!|07 Hee hee hee. The wumpus'll get you next time!\n");
          for (let i = 0; i < 4; i++) beep(523 * [1, 1.25, 1.5, 2][i], 0.15, i * 0.15);
          return { moves, arrows: arrows - 1 };
        }
        if (at === you) return lose("|12 OUCH! The arrow came around and got you!");
      }
      arrows--;
      await out("|08 Missed. Somewhere in the dark, something stirs.\n");
      wakeWumpus();
      if (wump === you) return lose("|12 TSK TSK TSK. The wumpus got you!");
      if (!arrows) return lose("|08 You're out of arrows.");
    }
  }
  DOOR.wumpus = async function () {
    act("Hunting the Wumpus");
    await title("wumpus", 14, "after Gregory Yob's Hunt the Wumpus (1973), from the People's Computer Company");
    await out("|07 {I} Instructions  {P} Play  {Q} Quit |15");
    let k = await readKey("IPQ", { enter: "P" });
    if (k === "Q") return;
    if (k === "I") await wumpusHelp();
    let setup = null;
    while (true) {
      if (!setup) setup = wumpusSetup();
      const res = await wumpusPlay({ ...setup, pits: setup.pits.slice(), bats: setup.bats.slice() });
      if (res) {
        const score = Math.max(10, 500 - res.moves * 10 + res.arrows * 50);
        const mv = res.moves + " move" + (res.moves === 1 ? "" : "s");
        await out("|07 Found him in |15" + mv + "|07 with |15" + res.arrows + "|07 arrow" + (res.arrows === 1 ? "" : "s") + " to spare. Score: |14" + score + "\n");
        await doorScore("wumpus", score, "got him in " + mv);
      }
      await out("\n|07 {S} Same cave again  {N} New cave  {Q} Quit |15");
      k = await readKey("SNQ");
      if (k === "Q") return;
      if (k === "N") setup = null;
    }
  };

  // ================================================================== LUNAR LANDER
  // Storer's 1969 physics: 10-second burns, a series expansion for the rocket equation.
  async function landerHelp() {
    cls();
    await out("|14 LUNAR LANDER\n" + rule(6) + "|07" + wrap(
      "You're piloting the descent module on its way down to the Moon. The on-board computer has failed, " +
      "so you have to land by hand.\n\n" +
      "Every 10 seconds you set the fuel burn rate: 0 (free fall) or anything from 8 to 200 pounds per second. " +
      "Burning slows you down, but you only have 16,500 pounds of fuel. Starting altitude: 120 miles. " +
      "Starting speed: 3,600 miles per hour, straight down.\n\n" +
      "Land under 1.2 mph for a perfect landing. Up to 10 mph is fine. Up to 60 mph and you live, but you'll " +
      "be waiting a while for a ride home. Faster than that, you make a crater.\n\n" +
      "Tip: free-fall for a long time first. Most of your speed has to come off near the bottom.") + "\n");
    await anyKey();
  }
  function landerGauge(alt) {
    const W = 20, p = Math.max(0, Math.min(W, Math.round(W * Math.sqrt(Math.max(0, alt) / 120))));
    return "|06#|08" + ".".repeat(p) + "|15A|08" + " ".repeat(W - p);
  }
  async function landerPlay() {
    const G = 0.001, Z = 1.8, N = 16500;
    const st = { L: 0, A: 120, V: 1, M: 33000 };
    let I = 0, J = 0, K = 0, T = 0;
    const sub = S => {
      const Q = S * K / st.M;
      J = st.V + G * S + Z * (-Q - Q * Q / 2 - Q ** 3 / 3 - Q ** 4 / 4 - Q ** 5 / 5);
      I = st.A - G * S * S / 2 - st.V * S + Z * S * (Q / 2 + Q ** 2 / 6 + Q ** 3 / 12 + Q ** 4 / 20 + Q ** 5 / 30);
    };
    const apply = S => { st.L += S; T -= S; st.M -= S * K; st.A = I; st.V = J; };
    const land = S => {   // home in on the exact moment of touchdown
      for (let guard = 0; guard < 200 && S >= 5e-3; guard++) {
        const D = st.V + Math.sqrt(st.V * st.V + 2 * st.A * (G - Z * K / st.M));
        if (!Number.isFinite(D) || D <= 0) break;
        S = 2 * st.A / D; sub(S); apply(S);
      }
      return "landed";
    };
    // One 10-second turn. Returns null to keep flying, or how it ended.
    const turn = () => {
      T = 10;
      while (true) {
        if (st.M - N < 0.001) {
          const S = (-st.V + Math.sqrt(st.V * st.V + 2 * st.A * G)) / G;
          st.V += G * S; st.L += S; st.A = 0;
          return "fuel";
        }
        if (T < 0.001) return null;
        let S = T;
        if (st.M < N + S * K) S = (st.M - N) / K;
        sub(S);
        if (I <= 0) return land(S);
        if (st.V > 0 && J < 0) {   // the burn would turn us around: find the moment we stop
          const W = (1 - st.M * G / (Z * K)) / 2;
          S = st.M * st.V / (Z * K * (W + Math.sqrt(W * W + st.V / Z))) + 0.05;
          sub(S);
          if (I <= 0) return land(S);
          apply(S);
          continue;
        }
        apply(S);
      }
    };
    cls();
    await out("|14 Lunar Lander|08  checking the control console... computer FAILED. Land by hand.\n\n" +
      "|11  SEC   MILES+FEET       MPH   LB FUEL" + pad("   ALTITUDE", 27) + "|14BURN\n|08" + "-".repeat(78) + "\n");
    while (true) {
      const mi = Math.floor(st.A), ft = Math.floor(5280 * (st.A - mi));
      await out("|07" + lpad(Math.round(st.L), 5) + lpad(mi, 7) + lpad(ft, 6) + lpad(fx(3600 * st.V), 10) + lpad(Math.round(st.M - N), 10) +
        "   " + landerGauge(st.A) + "  |14? |15");
      while (true) {
        const s = (await readLine({ max: 3 })).trim();
        const k = Number(s);
        if (s !== "" && Number.isFinite(k) && (k === 0 || (k >= 8 && k <= 200))) { K = k; break; }
        await out("|12 Not possible.|07 Burn 0, or 8 to 200 lbs/sec. |14? |15");
      }
      const end = turn();
      if (!end) continue;
      if (end === "fuel") await out("\n|12 *** FUEL OUT at " + fx(st.L) + " seconds. You drop like a rock. ***\n");
      const W = 3600 * st.V;
      await out("\n|15 ON THE MOON at " + fx(st.L) + " sec.  Impact velocity " + fx(W, 2) + " mph.  Fuel left " + Math.max(0, Math.round(st.M - N)) + " lb.\n");
      if (W <= 1.2) { await out("|10 PERFECT LANDING! The Eagle couldn't have done better.\n"); for (let i = 0; i < 3; i++) beep(660 * (1 + i / 4), 0.2, i * 0.2); }
      else if (W <= 10) await out("|10 Good landing.|07 Could be better.\n");
      else if (W <= 60) await out("|14 Craft damaged.|07 You're stranded here until a rescue party arrives.\n Hope you have enough oxygen!\n");
      else {
        await out("|12 Sorry, there were no survivors. You blew it!\n|07 In fact, you blasted a new lunar crater |15" + fx(W * 0.227) + "|07 feet deep.\n");
        if (A.ready()) A.noise(0, 1.2, 200, 0.7, 0.6);
      }
      if (W <= 60) {
        const score = Math.max(1, Math.round(1000 - W * 12 + Math.max(0, st.M - N) / 10));
        await out("|07 Score: |14" + score + "\n");
        await doorScore("lander", score, "landed at " + fx(W, 2) + " mph");
      }
      return;
    }
  }
  DOOR.lander = async function () {
    act("Landing on the Moon");
    await title("lander", 15, "after Jim Storer's LUNAR (1969), as printed in 101 BASIC Computer Games");
    await out("|07 {I} Instructions  {P} Play  {Q} Quit |15");
    let k = await readKey("IPQ", { enter: "P" });
    if (k === "Q") return;
    if (k === "I") await landerHelp();
    while (true) {
      await landerPlay();
      await out("\n|07 {P} Try again  {Q} Quit |15");
      if (await readKey("PQ", { enter: "P" }) === "Q") return;
    }
  };

  // ================================================================== HAMMURABI
  async function hammurabiHelp() {
    cls();
    await out("|14 HAMMURABI\n" + rule(6) + "|07" + wrap(
      "Try your hand at governing ancient Sumeria for a ten-year term of office.\n\n" +
      "Each year you decide how much land to buy or sell, how much grain to feed your people, and how many acres " +
      "to plant. Land trades at 17 to 26 bushels an acre, changing every year. Each person eats 20 bushels a " +
      "year. Seed costs one bushel for every two acres planted, and each person can farm at most 10 acres.\n\n" +
      "The harvest is 1 to 5 bushels an acre. Rats sometimes get into the stores. A plague may strike. If more " +
      "than 45% of the people starve in a single year, you're thrown out. Do well and people move to your city.") + "\n");
    await anyKey();
  }
  async function hammurabiPlay() {
    let year = 0, pop = 95, store = 2800, harvest = 3000, yieldPer = 3, rats = 200, acres = harvest / yieldPer;
    let starved = 0, born = 5, plague = 1, totalDead = 0, avgStarve = 0;
    cls();
    await out("|14 Hammurabi|08  Your Excellency, the scribes await your orders.\n");
    const fink = async () => {
      await out("|12 Due to this extreme mismanagement you have not only been impeached and thrown\n" +
        " out of office, but you have also been declared a national fink!!|07\n");
      return null;
    };
    while (true) {
      year++;
      await out("\n|15 HAMMURABI: I BEG TO REPORT TO YOU,\n" +
        "|07 In year " + year + ", " + starved + " people starved, " + born + " came to the city.\n");
      pop += born;
      if (plague <= 0) { pop = Math.max(1, Math.floor(pop / 2)); await out("|12 A horrible plague struck! Half the people died.\n"); }
      await out("|07 Population is now |15" + pop + "|07. The city owns |15" + acres + "|07 acres.\n" +
        " You harvested |15" + yieldPer + "|07 bushels per acre. Rats ate |15" + rats + "|07 bushels.\n" +
        " You now have |15" + store + "|07 bushels in store.\n");
      if (year === 11) break;
      const price = ri(17, 26);
      await out("|07 Land is trading at |14" + price + "|07 bushels per acre.\n");
      // Buy, or sell.
      let q;
      while (true) {
        q = Math.trunc(await askNum("|07 How many acres do you wish to buy? |15", { blank: 0 }));
        if (q < 0) return fink();
        if (q * price <= store) break;
        await out("|08 Hammurabi: think again. You have only " + store + " bushels of grain. Now then,\n");
      }
      if (q > 0) { acres += q; store -= q * price; }
      else {
        while (true) {
          q = Math.trunc(await askNum("|07 How many acres do you wish to sell? |15", { blank: 0 }));
          if (q < 0) return fink();
          if (q <= acres) break;
          await out("|08 Hammurabi: think again. You own only " + acres + " acres. Now then,\n");
        }
        acres -= q; store += q * price;
      }
      // Feed.
      let food;
      while (true) {
        food = Math.trunc(await askNum("|07 How many bushels do you wish to feed your people? |15", { blank: 0 }));
        if (food < 0) return fink();
        if (food <= store) break;
        await out("|08 Hammurabi: think again. You have only " + store + " bushels. Now then,\n");
      }
      store -= food;
      // Plant.
      let plant;
      while (true) {
        plant = Math.trunc(await askNum("|07 How many acres do you wish to plant with seed? |15", { blank: 0 }));
        if (plant < 0) return fink();
        if (plant > acres) { await out("|08 Hammurabi: think again. You own only " + acres + " acres. Now then,\n"); continue; }
        if (Math.floor(plant / 2) > store) { await out("|08 Hammurabi: think again. You have only " + store + " bushels. Now then,\n"); continue; }
        if (plant > 10 * pop) { await out("|08 But you have only " + pop + " people to tend the fields. Now then,\n"); continue; }
        break;
      }
      store -= Math.floor(plant / 2);
      // The year happens.
      yieldPer = ri(1, 5);
      harvest = plant * yieldPer;
      rats = 0;
      const c = ri(1, 5);
      if (c % 2 === 0) rats = Math.floor(store / c);
      store = store - rats + harvest;
      born = Math.floor(ri(1, 5) * (20 * acres + store) / pop / 100 + 1);
      const fed = Math.floor(food / 20);
      plague = Math.floor(10 * (2 * rnd() - 0.3));
      if (pop < fed) starved = 0;
      else {
        starved = pop - fed;
        if (starved > 0.45 * pop) {
          await out("\n|12 You starved " + starved + " people in one year!!!|07\n");
          return fink();
        }
        avgStarve = ((year - 1) * avgStarve + starved * 100 / pop) / year;
        pop = fed; totalDead += starved;
      }
    }
    // The ten-year review.
    const perPerson = acres / pop;
    await out("\n|15 In your 10-year term of office, " + fx(avgStarve) + "% of the population starved per year\n" +
      " on average, a total of " + totalDead + " people died. You started with 10 acres per person and\n ended with " +
      fx(perPerson) + " acres per person.\n\n");
    let tier;
    if (avgStarve > 33 || perPerson < 7) { await fink(); tier = 0; }
    else if (avgStarve > 10 || perPerson < 9) {
      tier = 1;
      await out("|14 Your heavy-handed performance smacks of Nero and Ivan IV. The people\n" +
        " (remaining) find you an unpleasant ruler and, frankly, hate your guts!!\n");
    } else if (avgStarve > 3 || perPerson < 10) {
      tier = 2;
      await out("|11 Your performance could have been somewhat better, but really wasn't too bad\n at all. " +
        Math.floor(pop * 0.8 * rnd()) + " people would dearly like to see you assassinated, but we all\n have our trivial problems.\n");
    } else {
      tier = 3;
      await out("|10 A fantastic performance!!! Charlemagne, Disraeli and Jefferson combined could\n not have done better!\n");
    }
    if (tier > 0) {
      const score = Math.max(1, Math.round(tier * 1000 + pop * 2 + perPerson * 20 - avgStarve * 30));
      await out("|07 Score: |14" + score + "\n");
      await doorScore("hammurabi", score, pop + " people, " + fx(perPerson) + " acres each");
    }
    return null;
  }
  DOOR.hammurabi = async function () {
    act("Ruling Sumeria");
    await title("hammurabi", 14, "after Doug Dyment's The Sumer Game (1968) and David Ahl's HAMURABI");
    await out("|07 {I} Instructions  {P} Play  {Q} Quit |15");
    let k = await readKey("IPQ", { enter: "P" });
    if (k === "Q") return;
    if (k === "I") await hammurabiHelp();
    while (true) {
      await hammurabiPlay();
      await out("\n|08 So long for now.\n|07 {P} Rule again  {Q} Quit |15");
      if (await readKey("PQ", { enter: "P" }) === "Q") return;
    }
  };

  // ================================================================== DEEP SPACE PATROL
  // The 8x8 galaxy, the 8x8 sectors, the Grelk, and you, in the patrol ship Plunger.
  const DEV = ["Warp engines", "Short-range sensors", "Long-range sensors", "Phaser control", "Photon tubes", "Damage control", "Shield control", "Library computer"];
  const [WARP, SRS, LRS, PHASER, TUBES, DAMCON, SHIELDS, COMPUTER] = [0, 1, 2, 3, 4, 5, 6, 7];
  const E0 = 3000, T0RP = 10;
  // Course vectors (east, north) for 1..9; fractions interpolate between neighbours.
  const DIRS = [null, [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0]];
  function courseVec(c) {
    const i = Math.floor(c), f = c - i, a = DIRS[i], b = DIRS[Math.min(9, i + 1)];
    return [a[0] + (b[0] - a[0]) * f, -(a[1] + (b[1] - a[1]) * f)];   // [dx, dy] with y pointing down the screen
  }
  // The course that heads from one spot to another (dx east, dyDown), the inverse of courseVec.
  function courseTo(dx, dyDown) {
    const dy = -dyDown, m = Math.max(Math.abs(dx), Math.abs(dy));
    if (!m) return null;
    const x = dx / m, y = dy / m, eq = (a, b) => Math.abs(a - b) < 1e-9;
    let c;
    if (eq(x, 1) && y >= 0) c = 1 + y;
    else if (eq(y, 1) && x >= 0) c = 2 + (1 - x);
    else if (eq(y, 1)) c = 3 - x;
    else if (eq(x, -1) && y >= 0) c = 4 + (1 - y);
    else if (eq(x, -1)) c = 5 - y;
    else if (eq(y, -1) && x <= 0) c = 6 + (1 + x);
    else if (eq(y, -1)) c = 7 + x;
    else c = 8 + (1 + y);
    return c >= 9 ? c - 8 : c;
  }
  const qname = (x, y) => (x + 1) + "," + (y + 1);

  function trekNew() {
    const g = {
      gal: [], known: [], qx: ri(0, 7), qy: ri(0, 7), sx: ri(0, 7), sy: ri(0, 7),
      energy: E0, shields: 0, torps: T0RP, dmg: new Array(8).fill(0), docked: false,
      t0: ri(20, 39) * 100, kills: 0, map: null, foes: [], over: null,
    };
    g.t = g.t0;
    let K = 0, B = 0;
    for (let x = 0; x < 8; x++) {
      g.gal[x] = []; g.known[x] = [];
      for (let y = 0; y < 8; y++) {
        const r = rnd();
        const k = r > 0.98 ? 3 : r > 0.95 ? 2 : r > 0.80 ? 1 : 0;
        const b = rnd() > 0.96 ? 1 : 0;
        g.gal[x][y] = { k, b, s: ri(1, 8) };
        g.known[x][y] = null;
        K += k; B += b;
      }
    }
    if (!B) { const x = ri(0, 7), y = ri(0, 7); g.gal[x][y].b = 1; B = 1; if (g.gal[x][y].k < 2) { g.gal[x][y].k++; K++; } }
    if (B < 2) { let x, y; do { x = ri(0, 7); y = ri(0, 7); } while (g.gal[x][y].b); g.gal[x][y].b = 1; B++; }
    if (K < 8) for (let i = K; i < 12; i++) { const c = g.gal[ri(0, 7)][ri(0, 7)]; if (c.k < 3) { c.k++; K++; } }
    g.k0 = K; g.limit = Math.max(25 + ri(0, 9), K + 4);
    return g;
  }
  const foesLeft = g => g.gal.flat().reduce((n, c) => n + c.k, 0);
  const basesLeft = g => g.gal.flat().reduce((n, c) => n + c.b, 0);
  const qcode = c => String(c.k * 100 + c.b * 10 + c.s).padStart(3, "0");
  function enterQuadrant(g) {
    const c = g.gal[g.qx][g.qy];
    g.known[g.qx][g.qy] = qcode(c);
    g.map = Array.from({ length: 8 }, () => new Array(8).fill(""));
    g.map[g.sy][g.sx] = "ship";
    const empty = () => { let x, y; do { x = ri(0, 7); y = ri(0, 7); } while (g.map[y][x]); return [x, y]; };
    g.foes = [];
    for (let i = 0; i < c.k; i++) { const [x, y] = empty(); g.map[y][x] = "foe"; g.foes.push({ x, y, e: 200 * (0.5 + rnd()) }); }
    if (c.b) { const [x, y] = empty(); g.map[y][x] = "base"; g.base = [x, y]; } else g.base = null;
    for (let i = 0; i < c.s; i++) { const [x, y] = empty(); g.map[y][x] = "star"; }
    checkDock(g);
  }
  function checkDock(g) {
    g.docked = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = g.sx + dx, y = g.sy + dy;
      if (x >= 0 && x < 8 && y >= 0 && y < 8 && g.map[y][x] === "base") g.docked = true;
    }
    if (g.docked) { g.energy = E0; g.torps = T0RP; g.shields = 0; }
  }
  function condition(g) {
    if (g.docked) return "|11DOCKED";
    if (g.foes.length) return "|12*RED*";
    if (g.energy < E0 * 0.1) return "|14YELLOW";
    return "|10GREEN";
  }
  const dist = (g, f) => Math.sqrt((f.x - g.sx) ** 2 + (f.y - g.sy) ** 2);

  async function trekSRS(g) {
    if (g.dmg[SRS] < 0) { await out("\n|12 *** Short-range sensors are out ***\n"); return; }
    const glyph = {
      "": "|08 .  ", ship: "|15<O> ", foe: "|12+G+ ", base: "|11[B] ", star: "|14 *  ",
    };
    const panel = [
      ["STARDATE", "|15" + fx(g.t)],
      ["CONDITION", condition(g)],
      ["QUADRANT", "|15" + qname(g.qx, g.qy)],
      ["SECTOR", "|15" + qname(g.sx, g.sy)],
      ["PHOTON TORPEDOES", "|15" + g.torps],
      ["TOTAL ENERGY", "|15" + Math.floor(g.energy + g.shields)],
      ["SHIELDS", (g.shields < 200 && g.foes.length ? "|12" : "|15") + Math.floor(g.shields)],
      ["GRELK REMAINING", "|15" + foesLeft(g)],
      ["STARDATES LEFT", "|15" + fx(g.t0 + g.limit - g.t)],
    ];
    let s = "\n|08       1   2   3   4   5   6   7   8\n   +" + "-".repeat(34) + "+\n";
    for (let y = 0; y < 8; y++) {
      s += "|08 " + (y + 1) + " |  ";
      for (let x = 0; x < 8; x++) s += glyph[g.map[y][x]];
      s = s.slice(0, -1) + "|08 |    " + (panel[y] ? "|03" + pad(panel[y][0], 18) + panel[y][1] : "") + "\n";
    }
    s += "|08   +" + "-".repeat(34) + "+    |03" + pad(panel[8][0], 18) + panel[8][1] + "\n";
    await out(s);
  }
  async function trekLRS(g) {
    if (g.dmg[LRS] < 0) { await out("\n|12 Long-range sensors are inoperable.\n"); return; }
    let s = "\n|07 Long-range scan for quadrant " + qname(g.qx, g.qy) + "\n|08   -------------------\n";
    for (let y = g.qy - 1; y <= g.qy + 1; y++) {
      s += "|08   :";
      for (let x = g.qx - 1; x <= g.qx + 1; x++) {
        if (x < 0 || x > 7 || y < 0 || y > 7) { s += "|08 *** |08:"; continue; }
        const code = qcode(g.gal[x][y]); g.known[x][y] = code;
        s += " " + (g.gal[x][y].k ? "|12" : g.gal[x][y].b ? "|11" : "|15") + code + " |08:";
      }
      s += "\n|08   -------------------\n";
    }
    await out(s + "|08   (Grelk, outposts, stars)\n");
  }
  async function trekFoesFire(g) {
    if (!g.foes.length || g.over) return;
    if (g.docked) { await out("|11 The outpost's shields protect the Plunger.\n"); return; }
    for (const f of g.foes) {
      if (f.e <= 0) continue;
      const h = Math.floor((f.e / dist(g, f)) * (2 + rnd()));
      g.shields -= h; f.e /= 3 + rnd();
      await out("|12 " + h + " unit hit on the Plunger from sector " + qname(f.x, f.y) + "\n");
      if (A.ready()) A.noise(0, 0.25, 400, 1, 0.4);
      if (g.shields < 0) { g.over = "destroyed"; return; }
      await out("|07      (shields down to " + Math.floor(g.shields) + " units)\n");
      if (h >= 20 && rnd() <= 0.6 && h / Math.max(1, g.shields) > 0.02) {
        const d = ri(0, 7);
        g.dmg[d] -= h / Math.max(1, g.shields) + 0.5 * rnd();
        await out("|14 Damage control reports '" + DEV[d] + " damaged by the hit'\n");
      }
    }
  }
  async function killFoe(g, f) {
    await out("|10 *** GRELK DESTROYED at sector " + qname(f.x, f.y) + " ***\n");
    if (A.ready()) A.noise(0, 0.5, 900, 0.8, 0.5);
    g.map[f.y][f.x] = ""; g.foes = g.foes.filter(x => x !== f);
    g.gal[g.qx][g.qy].k--; g.kills++;
    g.known[g.qx][g.qy] = qcode(g.gal[g.qx][g.qy]);
    if (!foesLeft(g)) g.over = "won";
  }
  async function trekNav(g) {
    const c = await askNum("|07 Course (1-9)? |15");
    if (!(c >= 1 && c < 9.0001)) { await out("|08 Lt. Okafor: 'Incorrect course data, sir.'\n"); return; }
    const maxW = g.dmg[WARP] < 0 ? 0.2 : 8;
    const w = await askNum("|07 Warp factor (0-" + maxW + ")? |15");
    if (!(w > 0)) return;
    if (w > maxW) {
      await out(maxW < 1 ? "|14 Warp engines are damaged. Maximum speed = warp 0.2\n" : "|08 Chief engineer Brask reports 'The engines won't take warp " + w + "!'\n");
      return;
    }
    const n = Math.max(1, Math.round(w * 8));
    if (g.energy < n + 10) {
      await out("|14 Engineering: 'Not enough energy to maneuver at warp " + w + "!'\n");
      if (g.shields >= n + 10 - g.energy && g.dmg[SHIELDS] >= 0) await out("|08 Deflector control has " + Math.floor(g.shields) + " units deployed to the shields.\n");
      return;
    }
    await trekFoesFire(g);
    if (g.over) return;
    // Repairs, and the odd surprise, while under way.
    const fix = Math.min(1, w);
    for (let i = 0; i < 8; i++) if (g.dmg[i] < 0) {
      g.dmg[i] += fix;
      if (g.dmg[i] > -0.1 && g.dmg[i] < 0) g.dmg[i] = -0.1;
      else if (g.dmg[i] >= 0) { g.dmg[i] = 0; await out("|10 Damage control report: " + DEV[i] + " repair completed.\n"); }
    }
    if (rnd() <= 0.2) {
      const d = ri(0, 7);
      if (rnd() < 0.6) { g.dmg[d] -= rnd() * 5 + 1; await out("|14 Damage control report: " + DEV[d] + " damaged by a space storm.\n"); }
      else if (g.dmg[d] < 0) { g.dmg[d] = Math.min(0, g.dmg[d] + rnd() * 3 + 1); await out("|10 Damage control report: " + DEV[d] + " state of repair improved.\n"); }
    }
    const [vx, vy] = courseVec(c);
    g.map[g.sy][g.sx] = "";
    let x = g.sx, y = g.sy, left = false;
    for (let i = 0; i < n; i++) {
      const nx = x + vx, ny = y + vy, rx = Math.round(nx), ry = Math.round(ny);
      if (rx < 0 || rx > 7 || ry < 0 || ry > 7) { left = true; break; }
      if (g.map[ry][rx]) {
        await out("|14 Warp engines shut down at sector " + qname(Math.round(x), Math.round(y)) + " due to bad navigation.\n");
        break;
      }
      x = nx; y = ny;
    }
    if (left) {
      // Out of the quadrant: work in galaxy-wide sector coordinates.
      let X = g.qx * 8 + g.sx + vx * n, Y = g.qy * 8 + g.sy + vy * n, hit = false;
      if (X < 0) { X = 0; hit = true; } if (X > 63) { X = 63; hit = true; }
      if (Y < 0) { Y = 0; hit = true; } if (Y > 63) { Y = 63; hit = true; }
      X = Math.round(X); Y = Math.round(Y);
      if (hit) await out("|14 Patrol command: 'Permission to cross the galactic perimeter is DENIED.'\n|08 Chief engineer Brask reports 'Shut down at sector " + qname(X % 8, Y % 8) + " of quadrant " + qname(X >> 3, Y >> 3) + ".'\n");
      g.qx = X >> 3; g.qy = Y >> 3; g.sx = X % 8; g.sy = Y % 8;
      g.energy -= n + 10;
      g.t += w >= 1 ? 1 : 0.1 * Math.floor(10 * w);
      if (g.t > g.t0 + g.limit) { g.over = "time"; return; }
      enterQuadrant(g);
      cls();
      await out("|07 Now entering quadrant |15" + qname(g.qx, g.qy) + "|07...\n");
      if (g.foes.length) {
        await out("|12 COMBAT AREA      CONDITION RED\n");
        if (g.shields <= 200) await out("|12    SHIELDS DANGEROUSLY LOW\n");
      }
      await trekSRS(g);
      return;
    }
    g.sx = Math.round(x); g.sy = Math.round(y);
    g.map[g.sy][g.sx] = "ship";
    g.energy -= n + 10;
    g.t += w >= 1 ? 1 : 0.1 * Math.floor(10 * w);
    if (g.t > g.t0 + g.limit) { g.over = "time"; return; }
    checkDock(g);
    if (g.docked) await out("|11 Docked at the outpost. Shields dropped for docking; energy and torpedoes restocked.\n");
    await trekSRS(g);
  }
  async function trekPhasers(g) {
    if (g.dmg[PHASER] < 0) { await out("|12 Phasers inoperative.\n"); return; }
    if (!g.foes.length) { await out("|08 Science officer Vey reports 'Sensors show no enemy ships in this quadrant.'\n"); return; }
    if (g.dmg[COMPUTER] < 0) await out("|14 Computer failure hampers accuracy.\n");
    await out("|07 Phasers locked on target. Energy available = " + Math.floor(g.energy) + " units\n");
    const x = await askNum("|07 Number of units to fire? |15");
    if (!(x > 0)) return;
    if (x > g.energy) { await out("|08 Not enough energy.\n"); return; }
    g.energy -= x;
    let each = x / g.foes.length;
    if (g.dmg[COMPUTER] < 0) each *= rnd();
    for (const f of g.foes.slice()) {
      const h = Math.floor((each / dist(g, f)) * (rnd() + 2));
      if (h <= 0.15 * f.e) { await out("|08 Sensors show no damage to the enemy at " + qname(f.x, f.y) + "\n"); continue; }
      f.e -= h;
      await out("|07 " + h + " unit hit on Grelk at sector " + qname(f.x, f.y) + "\n");
      if (f.e <= 0) await killFoe(g, f);
      else await out("|08    (sensors show " + Math.floor(f.e) + " units remaining)\n");
    }
    if (g.over) return;
    await trekFoesFire(g);
  }
  async function trekTorpedo(g) {
    if (g.torps <= 0) { await out("|12 All photon torpedoes expended.\n"); return; }
    if (g.dmg[TUBES] < 0) { await out("|12 Photon tubes are not operational.\n"); return; }
    const c = await askNum("|07 Photon torpedo course (1-9)? |15");
    if (!(c >= 1 && c < 9.0001)) { await out("|08 Ensign Tamsin: 'Incorrect course data, sir.'\n"); return; }
    g.torps--; g.energy -= 2;
    const [vx, vy] = courseVec(c);
    let x = g.sx, y = g.sy, track = [];
    if (A.ready()) A.tone([300], 0, 0.3, 0.3);
    await out("|07 Torpedo track:");
    while (true) {
      x += vx; y += vy;
      const rx = Math.round(x), ry = Math.round(y);
      if (rx < 0 || rx > 7 || ry < 0 || ry > 7) { await out("\n|08 Torpedo missed.\n"); break; }
      await out(" |15" + qname(rx, ry));
      const what = g.map[ry][rx];
      if (what === "foe") { await out("\n"); await killFoe(g, g.foes.find(f => f.x === rx && f.y === ry)); break; }
      if (what === "star") { await out("\n|14 Star at " + qname(rx, ry) + " absorbed the torpedo's energy.\n"); break; }
      if (what === "base") {
        await out("\n|12 *** OUTPOST DESTROYED ***\n");
        g.map[ry][rx] = ""; g.gal[g.qx][g.qy].b = 0; g.base = null; g.docked = false;
        await out("|14 Patrol command reviewing your record to consider court martial!\n");
        break;
      }
    }
    if (g.over) return;
    await trekFoesFire(g);
  }
  async function trekShields(g) {
    if (g.dmg[SHIELDS] < 0) { await out("|12 Shield control inoperable.\n"); return; }
    const total = g.energy + g.shields;
    const x = await askNum("|07 Energy available = " + Math.floor(total) + ". Number of units to shields? |15");
    if (!(x >= 0) || x === g.shields) { await out("|08 Shields unchanged.\n"); return; }
    if (x > total) { await out("|08 Shield control: 'This ship doesn\'t run on wishes, captain.' Shields unchanged.\n"); return; }
    g.energy = total - x; g.shields = x;
    await out("|07 Deflector control room report:\n|15   'Shields now at " + Math.floor(g.shields) + " units per your command.'\n");
  }
  async function trekDamage(g) {
    if (g.dmg[DAMCON] < 0) { await out("|12 Damage control report not available.\n"); }
    else {
      let s = "\n|11 DEVICE               STATE OF REPAIR\n";
      DEV.forEach((d, i) => { s += "|07 " + pad(d, 22) + (g.dmg[i] < 0 ? "|12" : "|10") + lpad(fx(g.dmg[i], 2), 8) + "\n"; });
      await out(s);
    }
    if (g.docked && g.dmg.some(d => d < 0)) {
      const days = Math.min(0.9, g.dmg.filter(d => d < 0).length * 0.1 + rnd() * 0.5);
      await out("|07 Technicians standing by to effect repairs to your ship.\n Estimated time to repair: " + fx(days, 2) + " stardates. Will you authorize? |15{Y}|07/|15{N} ");
      if (await readKey("YN") === "Y") { g.dmg.fill(0); g.t += days + 0.1; await out("\n|10 Repairs complete.\n"); }
      else await out("\n");
    }
  }
  async function trekComputer(g) {
    if (g.dmg[COMPUTER] < 0) { await out("|12 Computer disabled.\n"); return; }
    await out("|07 Computer active and awaiting command:\n" +
      "|07   {0} Cumulative galactic record   {1} Status report        {2} Torpedo data\n" +
      "|07   {3} Outpost navigation data      {4} Direction/distance   {Q} Never mind |15");
    const k = await readKey("01234Q");
    await out("\n");
    if (k === "0") {
      let s = "|11 Computer record of the galaxy for quadrant " + qname(g.qx, g.qy) + "\n|08       1     2     3     4     5     6     7     8\n|08    " + "-".repeat(49) + "\n";
      for (let y = 0; y < 8; y++) {
        s += "|08 " + (y + 1) + "  ";
        for (let x = 0; x < 8; x++) {
          const v = g.known[x][y], here = x === g.qx && y === g.qy;
          s += "  " + (here ? "|15" : v ? (v[0] !== "0" ? "|12" : v[1] !== "0" ? "|11" : "|07") : "|08") + (v || "***") + " ";
        }
        s += "\n";
      }
      await out(s + "|08    " + "-".repeat(49) + "\n");
    } else if (k === "1") {
      const k9 = foesLeft(g), left = g.t0 + g.limit - g.t;
      await out("|11   Status report:\n|07 " + k9 + " Grelk left.\n Mission must be completed in " + fx(left) + " stardates.\n" +
        " The Patrol is maintaining " + basesLeft(g) + " outpost" + (basesLeft(g) === 1 ? "" : "s") + " in the galaxy.\n");
      await trekDamage(g);
    } else if (k === "2") {
      if (!g.foes.length) { await out("|08 Sensors show no enemy ships in this quadrant.\n"); return; }
      await out("|07 From the Plunger to Grelk battle cruiser" + (g.foes.length > 1 ? "s" : "") + ":\n");
      for (const f of g.foes) await out("|07   at " + qname(f.x, f.y) + ":  course |15" + fx(courseTo(f.x - g.sx, f.y - g.sy), 2) + "|07  distance |15" + fx(Math.max(Math.abs(f.x - g.sx), Math.abs(f.y - g.sy)), 2) + "\n");
    } else if (k === "3") {
      if (!g.base) { await out("|08 Mr. Vey reports 'Sensors show no outposts in this quadrant.'\n"); return; }
      const [bx, by] = g.base;
      await out("|07 From the Plunger to the outpost: course |15" + fx(courseTo(bx - g.sx, by - g.sy), 2) + "|07  distance |15" + fx(Math.max(Math.abs(bx - g.sx), Math.abs(by - g.sy)), 2) + "\n");
    } else if (k === "4") {
      await out("|07 Direction/distance calculator. You are at quadrant " + qname(g.qx, g.qy) + " sector " + qname(g.sx, g.sy) + ".\n" +
        "|08 Enter coordinates as x,y. Use galaxy-wide sectors (1-64) to cross quadrants.\n");
      const read = async p => {
        await out("|07 " + p + " |15");
        const m = /^\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*$/.exec(await readLine({ max: 12 }));
        return m ? [+m[1], +m[2]] : null;
      };
      const a = await read("Initial coordinates (x,y)?"), b = a && await read("Final coordinates (x,y)?");
      if (!a || !b) { await out("|08 Bad coordinates.\n"); return; }
      const dx = b[0] - a[0], dy = b[1] - a[1], c = courseTo(dx, dy);
      if (c === null) { await out("|08 That's where you already are.\n"); return; }
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      await out("|07 Direction = |15" + fx(c, 2) + "|07   Distance = |15" + fx(d, 2) + "|07   (warp " + fx(d / 8, 2) + " to get there)\n");
    }
  }
  async function trekHelp() {
    cls();
    await out("|14 DEEP SPACE PATROL: ORDERS\n" + rule(6) + "|07" + wrap(
      "You command the patrol ship Plunger. A Grelk armada has crossed into Patrol space. Destroy every Grelk " +
      "warship before the deadline. The galaxy is 8 x 8 quadrants, each 8 x 8 sectors. Coordinates are x,y: " +
      "column first, then row, both counting from 1 at the top left.", 76) + "\n" +
      "|15    4  3  2 |07   {N} Navigate: course 1-9 (fractions too, like 2.5), warp factor.\n" +
      "|15     \\ | /  |07       Warp 1 = one quadrant (8 sectors). Costs energy and time.\n" +
      "|15  5 --<O>-- 1 |07 {S} Short-range scan    {L} Long-range scan (3x3 quadrants)\n" +
      "|15     / | \\  |07   {P} Phasers: energy split among all Grelk here; weaker at range.\n" +
      "|15    6  7  8 |07   {T} Photon torpedo: destroys what it hits. Aim with a course.\n" +
      "|07 {H} Shields: move energy to or from the shields. Grelk fire hits the shields.\n" +
      "|07 {D} Damage report   {C} Library computer (map, status, aim, course calculator)\n" +
      "|07 Dock beside an outpost |11[B]|07 to refuel, rearm and repair. Grelk |12+G+|07 shoot back.\n" +
      "|07 Long-range scan numbers: hundreds = Grelk, tens = outposts, ones = stars.\n");
    await anyKey();
  }
  async function trekPlay() {
    const g = trekNew();
    enterQuadrant(g);
    cls();
    await out("|15 Your orders are as follows:\n|07 Destroy the |12" + g.k0 + "|07 Grelk warships which have invaded Patrol space\n before stardate |15" +
      fx(g.t0 + g.limit) + "|07. That gives you |15" + g.limit + "|07 stardates.\n There " + (basesLeft(g) === 1 ? "is |15" + 1 + "|07 Patrol outpost" : "are |15" + basesLeft(g) + "|07 Patrol outposts") + " in the galaxy for resupplying your ship.\n");
    await out("\n|07 Your mission begins with your patrol ship in quadrant |15" + qname(g.qx, g.qy) + "|07.\n");
    if (g.foes.length) await out("|12 COMBAT AREA      CONDITION RED\n|12    SHIELDS DANGEROUSLY LOW\n");
    await trekSRS(g);
    while (!g.over) {
      if (g.energy + g.shields < 10 || (g.energy < 10 && g.dmg[SHIELDS] < 0)) { g.over = "stranded"; break; }
      await out("\n|07 {N} Navigate  {S} Short scan  {L} Long scan  {P} Phasers  {T} Torpedo\n" +
        "|07 {H} Shields  {D} Damage  {C} Computer  {?} Help  {Q} Resign  |14Command? |15");
      const k = await readKey("NSLPTHDC?Q");
      await out("\n");
      if (k === "N") await trekNav(g);
      else if (k === "S") await trekSRS(g);
      else if (k === "L") await trekLRS(g);
      else if (k === "P") await trekPhasers(g);
      else if (k === "T") await trekTorpedo(g);
      else if (k === "H") await trekShields(g);
      else if (k === "D") await trekDamage(g);
      else if (k === "C") await trekComputer(g);
      else if (k === "?") { await trekHelp(); await trekSRS(g); }
      else if (k === "Q") {
        await out("|07 Resign your command? |15{Y}|07/|15{N} ");
        if (await readKey("YN") === "Y") g.over = "resigned";
        await out("\n");
      }
    }
    // How it ended.
    await out("\n");
    const left = foesLeft(g);
    if (g.over === "won") {
      const rating = Math.round(1000 * (g.k0 / Math.max(0.1, g.t - g.t0)) ** 2);
      await out("|10 CONGRATULATIONS, CAPTAIN! The last Grelk battle cruiser menacing Patrol space\n has been destroyed.\n|15 Your efficiency rating is " + rating + ".\n");
      for (let i = 0; i < 5; i++) beep(392 * [1, 1.26, 1.5, 2, 1.5][i], 0.18, i * 0.18);
      await doorScore("trek", rating, g.k0 + " Grelk in " + fx(g.t - g.t0) + " stardates");
      return;
    }
    if (g.over === "destroyed") await out("|12 The Plunger has been destroyed. The Patrol will be conquered.\n");
    else if (g.over === "time") await out("|12 It is stardate " + fx(g.t) + ". Time's up. The Grelk overrun Patrol space.\n");
    else if (g.over === "stranded") await out("|12 ** FATAL ERROR ** You've just stranded your ship in space. You don't have\n enough energy to maneuver, and shield control can't help.\n");
    else if (g.over === "resigned") await out("|14 You resign your command.\n");
    await out("|15 " + left + "|07 Grelk battle cruisers were left when your mission ended. You got |15" + g.kills + "|07.\n");
    if (g.over === "destroyed" && A.ready()) A.noise(0, 1.5, 150, 0.6, 0.6);
  }
  DOOR.trek = async function () {
    act("On deep space patrol");
    await title("trek", 11, "after Mike Mayfield's Star Trek (1971) and Bob Leedom's 1974 expansion");
    await out("|08                    ,-----.\n|07          ____    _/ |15<O>|07 \\_____\n|07        <|15====|07>==|08(_________)|07=====>   |14the patrol ship PLUNGER\n|08                     `---'\n");
    await out("|07 {I} Orders & instructions  {P} Play  {Q} Quit |15");
    const k = await readKey("IPQ", { enter: "P" });
    if (k === "Q") return;
    if (k === "I") await trekHelp();
    while (true) {
      await trekPlay();
      await out("\n|07 The Patrol needs another captain. {P} Take command  {Q} Quit |15");
      if (await readKey("PQ", { enter: "P" }) === "Q") return;
    }
  };
})();
