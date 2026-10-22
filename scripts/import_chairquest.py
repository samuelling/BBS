"""Builds web/doors/chairquest.js from Matt Crump's ChairQuest (github.com/CrumpLab/ChairQuest).

Usage:  python3 scripts/import_chairquest.py /path/to/ChairQuest

Matt's game is one HTML page. Everything in its script up to the "RENDERING" marker is the game
itself (state, scenarios, events, endings and rules) and is copied in verbatim. The page's own
HTML rendering is replaced by a terminal front end (TERMINAL below) that walks the same flow:
weeks, external events, bonus scenarios, the Privilege of the Chair side options, and endings.
The real-time "advanced sandbox" after the top ending stays on Matt's site; the door links to it.
"""
import pathlib, re, sys

src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/ext/ChairQuest") / "docs" / "index.html"
html = src.read_text()
script = max(re.findall(r"<script>(.*?)</script>", html, re.S), key=len)
data = script.split("// ---------------- RENDERING ----------------")[0]

TERMINAL = r'''
// ---------------- TERMINAL FRONT END (MEGAzine BBS) ----------------
const CQ_SITE = "https://crumplab.github.io/ChairQuest/";
// The board's terminal is 80 columns of plain text: straighten typographic punctuation.
function cqPlain(s){
  return String(s ?? "").replace(/[—–]/g, "--").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/…/g, "...").replace(/ /g, " ").replace(/&mdash;/g, "--").replace(/&rarr;/g, "->").replace(/<[^>]+>/g, "");
}
function cqText(s, color){ return wrap(esc(cqPlain(s)), 76).split("\n").map(l => (color || "|07") + " " + l).join("\n") + "\n"; }
function cqLetterhead(sub){
  const dept = STATE.deptName || "Department of General Studies";
  const who = "Office of the Chair" + (STATE.chairName ? " -- " + STATE.chairName : "");
  const right = cqPlain(sub);
  return "|17|15 " + pad(esc(cqPlain(dept)), 76) + " |16\n" +
    "|17|07 " + pad(esc(cqPlain(who)), 76 - right.length - 1) + " |14" + esc(right) + " |16\n";
}
function cqGauges(deltas){
  let s = "";
  for (const k of ["health", "pc", "bud", "mor", "dean"]) {
    const v = STATE.stats[k], d = deltas ? deltas[k] : 0;
    const col = v < 30 ? "|12" : v < 60 ? "|14" : "|10";
    const fill = Math.round(v / 5);
    s += "|07 " + pad(STAT_LABELS[k], 19) + col + "#".repeat(fill) + "|08" + ".".repeat(20 - fill) + " " + col + lpad(v, 3) +
      (d ? (d > 0 ? " |10(+" + d + ")" : " |12(" + d + ")") : "") + "\n";
  }
  return s;
}
async function cqScreen(sub, deltas){ cls(); await out(cqLetterhead(sub) + "\n" + cqGauges(deltas) + "\n"); }
async function cqChoose(list, extra){
  // list: [{key, label, sub}] -> returns the chosen key
  let s = "";
  for (const c of list) {
    s += "|07 {" + c.key + "} " + cqText(c.label, "|15").trimStart().replace(/\n\|15 /g, "\n|15     ");
    if (c.sub) s += cqText(c.sub, "|08    ");
  }
  if (extra) s += extra;
  await out("\n" + s + "\n|08 Your call: |07");
  return readKey(list.map(c => c.key).join(""));
}
function cqNextLabel(){
  if (STATE.forcedEnding) return "See what happens";
  if (STATE.pendingBonus) return "One more thing";
  if (STATE.continuation === "returnToWeek") return "Back to the week";
  return "Next week";
}
async function cqConsequence(result, deltas){
  await out("\n" + cqGauges(deltas) + "\n" + cqText(result, "|11") + "\n|07 {N} " + cqNextLabel() + " |15");
  await readKey("N", { enter: "N" });
}
// A scenario with lettered choices (weekly, bonus, low-frequency, records arc).
async function cqChoices(sc, sub, opts = {}){
  await cqScreen(sub);
  await out("|14 " + esc(cqPlain(sc.title)) + "\n" + cqText(opts.plainText ? sc.text : cozyText(sc)));
  const list = sc.choices.map(c => ({ key: c.tag, label: c.label }));
  let side = "", sideKeys = [];
  if (opts.privileges) {
    const care = SELF_CARE_LIMIT - STATE.selfCareUsed, peek = PEEK_LIMIT - STATE.peekUsed;
    const rec = STATE.recordsStage < RECORDS_MANAGEMENT_ARC.length;
    side = "\n|05 PRIVILEGE OF THE CHAIR\n|07 {L} Experience a Low-Frequency Event\n";
    sideKeys.push("L");
    if (care > 0) { side += "|07 {S} Take Care of Yourself |08(" + care + " left this term)\n"; sideKeys.push("S"); }
    if (!STATE.askedPreviousChair) { side += "|07 {P} Ask the Previous Chair for Help\n"; sideKeys.push("P"); }
    if (peek > 0) { side += "|07 {K} Peek Behind the Curtain |08(" + peek + " left this term)\n"; sideKeys.push("K"); }
    if (rec) { side += "|07 {R} " + (STATE.recordsStage === 0 ? "Engage with Records Management Issues" : "Continue: Records Management Issues (Part " + (STATE.recordsStage + 1) + " of " + RECORDS_MANAGEMENT_ARC.length + ")") + "\n"; sideKeys.push("R"); }
    side += "|07 {Q} Quit to the door menu\n"; sideKeys.push("Q");
  }
  let s = "";
  for (const c of list) s += "|07 {" + c.key + "} " + cqText(c.label, "|15").replace(/^\|15 /, "").replace(/\n\|15 /g, "\n|15     ");
  await out("\n" + s + side + "\n|08 Your call: |07");
  const k = await readKey(list.map(c => c.key).join("") + sideKeys.join(""));
  return { key: k, choice: sc.choices.find(c => c.tag === k) };
}
// The odds-based side options (self-care, previous chair, peek).
async function cqOdds(sub, title, intro, options, describe){
  await cqScreen(sub);
  await out("|14 " + title + "\n" + cqText(intro));
  const keys = "123456789";
  const list = options.map((o, i) => ({ key: keys[i], label: "[" + Math.round(o.chance * 100) + "%] " + o.label, sub: describe(o) }));
  list.push({ key: "B", label: "Never mind" });
  const k = await cqChoose(list);
  return k === "B" ? null : options[keys.indexOf(k)];
}
// These few helpers live in Matt's rendering section, so they're reproduced here as written.
function pickExternalEvent(){
  if(STATE.usedExternal.length >= EXTERNAL_EVENTS.length){ STATE.usedExternal = []; }
  const available = EXTERNAL_EVENTS.map((_, i) => i).filter(i => !STATE.usedExternal.includes(i));
  const idx = available[Math.floor(Math.random() * available.length)];
  STATE.usedExternal.push(idx);
  return EXTERNAL_EVENTS[idx];
}
function pickLowFreqEvent(){
  if(STATE.usedLowFreq.length >= LOW_FREQUENCY_EVENTS.length){ STATE.usedLowFreq = []; }
  const available = LOW_FREQUENCY_EVENTS.map((_, i) => i).filter(i => !STATE.usedLowFreq.includes(i));
  const idx = available[Math.floor(Math.random() * available.length)];
  STATE.usedLowFreq.push(idx);
  return LOW_FREQUENCY_EVENTS[idx];
}
function evaluateAfterChoice(){
  STATE.forcedEnding = checkZeroEnding();
  STATE.pendingBonus = STATE.forcedEnding ? null : checkBonusTrigger();
}
function computeDeltas(before){
  const d = {};
  for(const k in STATE.stats){ d[k] = STATE.stats[k] - before[k]; }
  return d;
}
function formatEffectsList(effects){
  return Object.keys(effects).map(k => `${effects[k] > 0 ? "+" : ""}${effects[k]} ${STAT_LABELS[k]}`).join(", ");
}
function cqFx(effects){ return formatEffectsList(effects); }
function cqApply(effects, logTitle, logChoice){
  const before = { ...STATE.stats };
  applyEffects(effects);
  STATE.log.push({ week: STATE.week + 1, title: logTitle, choice: logChoice });
  return before;
}

function cqReset(){
  STATE.stats = { pc: 50, bud: 50, mor: 50, dean: 50, health: 50 };
  STATE.week = 0; STATE.log = []; STATE.scenarios = []; STATE.forcedEnding = null; STATE.pendingBonus = null;
  STATE.bonusFired = { pc: false, bud: false, mor: false, dean: false, health: false };
  STATE.continuation = "advanceWeek"; STATE.usedLowFreq = []; STATE.pendingLowFreq = null; STATE.usedExternal = [];
  STATE.selfCareUsed = 0; STATE.askedPreviousChair = false; STATE.peekUsed = 0; STATE.recordsStage = 0; STATE.smallVictories = 0;
}

// One term, start to ending. Returns "quit" or "again".
async function cqTerm(){
  cqReset();
  STATE.scenarios = shuffled(SCENARIOS).slice(0, STATE.totalWeeks);
  let external = null;   // an external event shown at the top of this week
  // enterWeek(): 25% of weeks open with an external event, then the week's scenario.
  const enterWeek = () => { if (STATE.week < STATE.scenarios.length && Math.random() < 0.25) external = pickExternalEvent(); };
  enterWeek();
  while (true) {
    if (STATE.forcedEnding || STATE.week >= STATE.scenarios.length) return cqEnding();
    if (external) {
      const ev = external; external = null;
      const before = cqApply(ev.effects, "[External Event] " + ev.title, "(automatic -- no choice)");
      STATE.continuation = "returnToWeek"; evaluateAfterChoice();
      await cqScreen("WEEK " + (STATE.week + 1) + " OF " + STATE.scenarios.length + " -- EXTERNAL EVENT", computeDeltas(before));
      await out("|14 " + esc(cqPlain(ev.title)) + "\n" + cqText(cozyText(ev)) + "\n|07 {N} " + cqNextLabel() + " |15");
      await readKey("N", { enter: "N" });
      if (await cqAfter()) continue; else continue;
    }
    const sc = STATE.scenarios[STATE.week];
    const r = await cqChoices(sc, "WEEK " + (STATE.week + 1) + " OF " + STATE.scenarios.length, { privileges: true });
    if (r.key === "Q") { await out("\n|07 Abandon the term? {Y} Yes  {N} No |15"); if ((await readKey("YN")) === "Y") return "quit"; continue; }
    STATE.continuation = "returnToWeek";
    if (r.choice) {
      STATE.continuation = "advanceWeek";
      const before = cqApply(r.choice.effects, sc.title, r.choice.label);
      evaluateAfterChoice();
      await cqConsequence(cozyResult(sc, r.choice), computeDeltas(before));
    } else if (r.key === "L") {
      const ev = pickLowFreqEvent();
      const x = await cqChoices(ev, "LOW-FREQUENCY EVENT");
      const before = cqApply(x.choice.effects, "[Low-Frequency] " + ev.title, x.choice.label);
      evaluateAfterChoice();
      await cqConsequence(cozyResult(ev, x.choice), computeDeltas(before));
    } else if (r.key === "S") {
      const left = SELF_CARE_LIMIT - STATE.selfCareUsed;
      const opt = await cqOdds("A MOMENT FOR YOURSELF", "Take Care of Yourself",
        "You have " + left + " of " + SELF_CARE_LIMIT + " personal breaks left this term. Pick one -- the odds are the odds, whatever you choose.",
        SELF_CARE_OPTIONS, o => Math.round(o.chance * 100) + "% chance: +" + o.success + " Chair Health  /  " + (100 - Math.round(o.chance * 100)) + "% chance: " + o.failure + " Chair Health");
      if (!opt) continue;
      const ok = Math.random() < opt.chance;
      STATE.selfCareUsed += 1;
      const before = cqApply({ health: ok ? opt.success : opt.failure }, "[Self-Care] " + opt.label, ok ? "It worked" : "It didn't go as planned");
      evaluateAfterChoice();
      await cqConsequence(ok ? opt.successText : opt.failureText, computeDeltas(before));
    } else if (r.key === "P" || r.key === "K") {
      const prev = r.key === "P";
      const left = PEEK_LIMIT - STATE.peekUsed;
      const opt = await cqOdds(prev ? "A CALL TO YOUR PREDECESSOR" : "ACCESS YOU PROBABLY SHOULDN'T HAVE",
        prev ? "Ask the Previous Chair for Help" : "Peek Behind the Curtain",
        prev ? "You can only lean on her goodwill once. Choose the question carefully -- the odds are the odds, whatever you ask."
             : "You have " + left + " of " + PEEK_LIMIT + " looks left this term. The files are confidential, the odds are close to a coin flip, and whatever you find, you can't put back.",
        prev ? PREVIOUS_CHAIR_OPTIONS : PEEK_OPTIONS,
        o => o.scenario + "  " + Math.round(o.chance * 100) + "% chance: " + cqFx(o.successEffects) + "  /  " + (100 - Math.round(o.chance * 100)) + "% chance: " + cqFx(o.failureEffects));
      if (!opt) continue;
      const ok = Math.random() < opt.chance;
      if (prev) STATE.askedPreviousChair = true; else STATE.peekUsed += 1;
      const before = cqApply(ok ? opt.successEffects : opt.failureEffects, (prev ? "[Previous Chair] " : "[Peek Behind the Curtain] ") + opt.label, ok ? "It worked" : "It didn't go as planned");
      evaluateAfterChoice();
      await cqConsequence(ok ? opt.successText : opt.failureText, computeDeltas(before));
    } else if (r.key === "R") {
      const stage = STATE.recordsStage, rs = RECORDS_MANAGEMENT_ARC[stage];
      const x = await cqChoices(rs, "RECORDS MANAGEMENT -- PART " + (stage + 1) + " OF " + RECORDS_MANAGEMENT_ARC.length, { plainText: true });
      const before = cqApply(x.choice.effects, "[Records Management] " + rs.title, x.choice.label);
      const last = stage === RECORDS_MANAGEMENT_ARC.length - 1;
      STATE.recordsStage += 1;
      let text = x.choice.result;
      if (last) { STATE.smallVictories += 1; text += " " + RECORDS_MANAGEMENT_EPILOGUE; }
      evaluateAfterChoice();
      await cqConsequence(text, computeDeltas(before));
    }
    await cqAfter();
  }

  // advanceAfterChoice(): the bonus scenario, back to the week, or the next week.
  async function cqAfter(){
    while (STATE.pendingBonus && !STATE.forcedEnding) {
      const sc = STATE.pendingBonus;
      const x = await cqChoices(sc, "A MATTER OUTSIDE THE AGENDA");
      const before = cqApply(x.choice.effects, "[Bonus] " + sc.title, x.choice.label);
      STATE.pendingBonus = null;
      evaluateAfterChoice();
      await cqConsequence(cozyResult(sc, x.choice), computeDeltas(before));
    }
    if (STATE.forcedEnding) return true;
    if (STATE.continuation === "returnToWeek") { STATE.continuation = "advanceWeek"; return true; }
    STATE.stats.health = clamp(STATE.stats.health - 2);
    STATE.week += 1;
    const zero = checkZeroEnding();
    if (zero) STATE.forcedEnding = zero; else enterWeek();
    return true;
  }
}

async function cqEnding(){
  const ending = STATE.forcedEnding || computeEnding();
  const s = STATE.stats, top = !STATE.forcedEnding && ending.title === "The Dean's Office Calls";
  cls();
  await out(cqLetterhead(STATE.forcedEnding ? "TERM ENDED -- WEEK " + (STATE.week + 1) : "END OF TERM") + "\n");
  await out("|14 " + esc(cqPlain(ending.title)).toUpperCase() + "\n\n" + cqText(cozyEndingText(ending)) + "\n");
  await out("|08 FINAL FIGURES\n" + cqGauges() + (STATE.smallVictories ? "|11 Small victories no one will ever notice: " + STATE.smallVictories + "\n" : ""));
  const avg = Math.round((s.pc + s.bud + s.mor + s.dean + s.health) / 5);
  await doorScore("chairquest", avg * 10 + STATE.smallVictories * 25, cqPlain(ending.title) + (STATE.cozyMode ? " (cozy)" : ""));
  if (top) {
    await out("\n|07 A neighboring state university has come calling. It's time to build something of your own.\n" +
      "|08 (Matt's advanced sandbox runs in real time, so it lives on his site: |11" + CQ_SITE.replace("https://", "") + "|08)\n\n" +
      "|07 {T} Take the new position (opens it in your browser)  {N} Begin a new term  {Q} Quit |15");
    const k = await readKey("TNQ");
    if (k === "T") { try { window.open(CQ_SITE, "_blank", "noopener"); } catch (e) {} await out("\n|08 Opened in a new tab. The board is still here when you get back.\n"); await anyKey(); return "again"; }
    return k === "N" ? "again" : "quit";
  }
  await out("\n|07 {N} Begin a new term  {Q} Quit |15");
  return (await readKey("NQ")) === "N" ? "again" : "quit";
}

async function cqTitle(){
  cls();
  await out(
    "|17|15 " + pad("", 76) + " |16\n" +
    "|17|15 " + pad("   C H A I R Q U E S T", 76) + " |16\n" +
    "|17|07 " + pad("   Office of the Chair  //  by Matt Crump", 76) + " |16\n" +
    "|17|15 " + pad("", 76) + " |16\n\n" +
    "|15 Congratulations. You are now Chair.\n\n" +
    cqText("Ten weeks stand between you and the end of your first year -- budgets, tenure cases, a curriculum committee at war with itself, and a Dean's office that speaks almost entirely in memos. You will not please everyone. You may not please anyone.") + "\n" +
    "|08 From the megaZINE collective. Game, scenarios and writing by Matt Crump\n|08 (CrumpLab, github.com/CrumpLab/ChairQuest), shown here in the board's terminal.\n\n" +
    "|07 {B} Begin term     {C} Cozy Chair Mode: " + (STATE.cozyMode ? "|10on " : "|08off") + "|07   (same choices, kinder outcomes)\n" +
    "|07 {R} Not Your First Rodeo     {D} Disclaimer     {Q} Quit |15");
  return readKey("BCRDQ", { enter: "B" });
}

DOOR.chairquest = async function () {
  while (true) {
    const k = await cqTitle();
    if (k === "Q") return;
    if (k === "C") { STATE.cozyMode = !STATE.cozyMode; continue; }
    if (k === "D") {
      await out("\n\n" + cqText("ChairQuest is a silly game that was mostly generated by Claude. The notional author had never used Claude Code before, so he made this as part of learning how to interact with Claude Code. Who knows if this ever works, it's Claude doing this and that after suggestions to do this and that, and no one has the time to check what is happening. If you find a bug, download the repo and ask claude to fix it, then keep doing that and see what happens.", "|08"));
      await anyKey(); continue;
    }
    if (k === "R") {
      await out("\n\n" + cqText("Not your first rodeo? Matt's advanced sandbox (build a department from scratch, in real time) runs on his site.", "|07"));
      try { window.open(CQ_SITE, "_blank", "noopener"); } catch (e) {}
      await anyKey(); continue;
    }
    await out("\n\n|07 Fill in your appointment details, or leave them blank and we'll assume the usual.\n\n|07 Your name: |15");
    STATE.chairName = cqPlain((await readLine({ max: 40 })).trim());
    await out("|07 Department: |15");
    STATE.deptName = cqPlain((await readLine({ max: 50 })).trim());
    act("Playing ChairQuest");
    while ((await cqTerm()) === "again") {}
    return;
  }
};
'''

out = ("// ChairQuest by Matt Crump (CrumpLab) - https://github.com/CrumpLab/ChairQuest\n"
       "// Added to MEGAzine BBS at Matt's request. GENERATED by scripts/import_chairquest.py: the game\n"
       "// (state, scenarios, events, endings, rules) is copied verbatim from his docs/index.html;\n"
       "// only the front end is new, drawing his game in the board's 80-column terminal.\n"
       "(function () {\n" + data + TERMINAL + "\n})();\n")
pathlib.Path(__file__).resolve().parent.parent.joinpath("web/doors/chairquest.js").write_text(out)
print("wrote web/doors/chairquest.js", len(out), "bytes")
