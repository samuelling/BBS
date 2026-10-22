// Z-machine interpreter (versions 1-3) and the Zork I / II / III doors.
//
// Written for MEGAzine BBS from the Z-Machine Standards Document 1.1. It plays the original
// Infocom story files: Zork I-III, whose source Microsoft released under the MIT License in 2025
// (see doors/ZORK-LICENSE.txt). The machine runs synchronously until it needs something from the
// outside world (a line of input, a save, a restore, the end of the game), then hands control back
// to the door, which awaits the terminal or the board and resumes it.

const ZM_A0 = "abcdefghijklmnopqrstuvwxyz";
const ZM_A1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ZM_A2 = { 1: "\0" + "0123456789.,!?_#'\"/\\<-:()", 2: "\0\n0123456789.,!?_#'\"/\\-:()", 3: "\0\n0123456789.,!?_#'\"/\\-:()" };
// ZSCII 155-223: the default extra characters (Standard 1.1, section 3.8.5.3).
const ZM_EXTRA = "äöüÄÖÜß»«ëïÿËÏáéíóúýÁÉÍÓÚÝàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛåÅøØãñõÃÑÕæÆçÇþðÞÐ£œŒ¡¿";
const zs16 = x => (x << 16) >> 16;

class ZMachine {
  constructor(story) {
    this.story = story;
    this.mem = story.slice();
    this.v = this.mem[0];
    if (this.v < 1 || this.v > 3) throw new Error("This door plays version 1-3 story files (got version " + this.v + ").");
    this.staticBase = this.rw(0x0e);
    this.globals = this.rw(0x0c);
    this.objTable = this.rw(0x0a);
    this.dict = this.rw(0x08);
    this.abbr = this.rw(0x18);
    this.alpha = [ZM_A0, ZM_A1, ZM_A2[this.v]];
    this.out = [];
    this.streams3 = [];
    this.screen = true;
    this.read = null;
    this.onBeep = null;
    this.reseed();
    this.restart();
    this.buildDict();
  }

  // ------------------------------------------------------------ memory
  rw(a) { return (this.mem[a] << 8) | this.mem[a + 1]; }
  // Writes past dynamic memory are dropped. The original Infocom interpreters never checked, and at
  // least one shipped bug relies on that (Zork III, "enter all").
  ww(a, x) { if (a + 1 < this.staticBase) { this.mem[a] = (x >> 8) & 255; this.mem[a + 1] = x & 255; } }
  wb(a, x) { if (a < this.staticBase) this.mem[a] = x & 255; }
  unpack(p) { return p * 2; }   // versions 1-3
  setHeader() {
    // Flags 1 (v3): status line available, no split screen, fixed-pitch font is the default.
    if (this.v === 3) this.mem[1] &= ~0x70;
    this.mem[0x32] = 1; this.mem[0x33] = 1;   // Standard 1.1
  }
  restart() {
    const keep = this.mem[0x11] & 3;   // transcripting and fixed-pitch survive a restart
    this.mem.set(this.story.subarray(0, this.staticBase));
    this.mem[0x11] = (this.mem[0x11] & ~3) | keep;
    this.setHeader();
    this.pc = this.rw(0x06);
    this.stack = [];
    this.frames = [];
    this.fp = { ret: -1, store: -1, locals: [], base: 0, argc: 0 };
  }

  // ------------------------------------------------------------ random numbers
  reseed(seed) {
    this.rngState = seed === undefined ? (Math.random() * 4294967296) >>> 0 : seed >>> 0;
    this.rngSeq = 0; this.rngPredict = seed !== undefined && seed < 1000 ? seed : 0;
  }
  rand() {   // mulberry32
    let t = (this.rngState = (this.rngState + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  random(range) {
    if (range > 0) {
      if (this.rngPredict) { this.rngSeq = (this.rngSeq % this.rngPredict) + 1; return ((this.rngSeq - 1) % range) + 1; }
      return 1 + Math.floor(this.rand() * range);
    }
    if (range < 0) this.reseed(-range); else this.reseed();
    return 0;
  }

  // ------------------------------------------------------------ variables
  getVar(v) {
    if (v === 0) {
      if (this.stack.length <= this.fp.base) throw new Error("Stack underflow.");
      return this.stack.pop();
    }
    if (v < 16) return this.local(v);
    return this.rw(this.globals + 2 * (v - 16));
  }
  setVar(v, x) {
    x &= 0xffff;
    if (v === 0) this.stack.push(x);
    else if (v < 16) { this.local(v); this.fp.locals[v - 1] = x; }
    else this.ww(this.globals + 2 * (v - 16), x);
  }
  local(v) {
    if (v > this.fp.locals.length) throw new Error("Routine has no local variable " + v + ".");
    return this.fp.locals[v - 1];
  }
  // Indirect references (inc, dec, store, load, pull...) work on the top of the stack in place.
  peekVar(v) {
    if (v === 0) { if (this.stack.length <= this.fp.base) throw new Error("Stack underflow."); return this.stack[this.stack.length - 1]; }
    return this.getVar(v);
  }
  pokeVar(v, x) {
    if (v === 0) { if (this.stack.length <= this.fp.base) throw new Error("Stack underflow."); this.stack[this.stack.length - 1] = x & 0xffff; return; }
    this.setVar(v, x);
  }

  // ------------------------------------------------------------ text
  zscii(c) {
    if (c === 13) return "\n";
    if (c >= 32 && c <= 126) return String.fromCharCode(c);
    if (c >= 155 && c <= 223) return ZM_EXTRA[c - 155];
    return c === 0 ? "" : "?";
  }
  decode(addr, nested) {
    const m = this.mem, v = this.v;
    let out = "", lock = 0, alpha = 0, state = 0, abbrevBase = 0, high = 0;
    for (;;) {
      const w = (m[addr] << 8) | m[addr + 1]; addr += 2;
      for (const c of [(w >> 10) & 31, (w >> 5) & 31, w & 31]) {
        if (state === 1) { if (!nested) out += this.decode(this.rw(this.abbr + 2 * (abbrevBase + c)) * 2, true).text; state = 0; continue; }
        if (state === 2) { high = c; state = 3; continue; }
        if (state === 3) { out += this.zscii((high << 5) | c); state = 0; continue; }
        if (c === 0) { out += " "; alpha = lock; continue; }
        if (c <= 3 && (v >= 3 || (v === 2 && c === 1))) { state = 1; abbrevBase = 32 * (c - 1); alpha = lock; continue; }
        if (c === 1 && v === 1) { out += "\n"; alpha = lock; continue; }
        if (c <= 5) {
          if (v >= 3) { if (c >= 4) alpha = c - 3; }
          else if (c <= 3) alpha = (lock + c - 1) % 3;
          else { lock = (lock + c - 3) % 3; alpha = lock; }
          continue;
        }
        if (alpha === 2 && c === 6) { state = 2; alpha = lock; continue; }
        out += this.alpha[alpha][c - 6];
        alpha = lock;
      }
      if (w & 0x8000) break;
    }
    return { text: out, end: addr };
  }
  print(s) {
    if (this.streams3.length) {
      const t = this.streams3[this.streams3.length - 1];
      for (const ch of s) t.data.push(ch === "\n" ? 13 : this.toZscii(ch));
      return;
    }
    if (this.screen) this.out.push(s);
  }
  toZscii(ch) {
    const c = ch.charCodeAt(0);
    if (c >= 32 && c <= 126) return c;
    const i = ZM_EXTRA.indexOf(ch);
    return i >= 0 ? 155 + i : 63;
  }
  takeOutput() { const s = this.out.join(""); this.out = []; return s; }

  // ------------------------------------------------------------ objects (v1-3 layout)
  oa(o) { return this.objTable + 62 + (o - 1) * 9; }
  attr(o, a) { return o ? (this.mem[this.oa(o) + (a >> 3)] >> (7 - (a & 7))) & 1 : 0; }
  setAttr(o, a, on) {
    if (!o) return;
    const p = this.oa(o) + (a >> 3), bit = 0x80 >> (a & 7);
    this.wb(p, on ? this.mem[p] | bit : this.mem[p] & ~bit);
  }
  parent(o) { return o ? this.mem[this.oa(o) + 4] : 0; }
  sibling(o) { return o ? this.mem[this.oa(o) + 5] : 0; }
  child(o) { return o ? this.mem[this.oa(o) + 6] : 0; }
  setParent(o, x) { this.wb(this.oa(o) + 4, x); }
  setSibling(o, x) { this.wb(this.oa(o) + 5, x); }
  setChild(o, x) { this.wb(this.oa(o) + 6, x); }
  props(o) { return this.rw(this.oa(o) + 7); }
  shortName(o) { if (!o) return ""; const p = this.props(o); return this.mem[p] ? this.decode(p + 1).text : ""; }
  firstProp(o) { const p = this.props(o); return p + 1 + 2 * this.mem[p]; }
  findProp(o, n) {   // address of the size byte, or 0
    for (let p = this.firstProp(o); this.mem[p]; p += 2 + (this.mem[p] >> 5)) {
      const num = this.mem[p] & 31;
      if (num === n) return p;
      if (num < n) return 0;   // properties are stored in descending order
    }
    return 0;
  }
  getProp(o, n) {
    const p = o ? this.findProp(o, n) : 0;
    if (!p) return this.rw(this.objTable + 2 * (n - 1));
    return (this.mem[p] >> 5) === 0 ? this.mem[p + 1] : this.rw(p + 1);
  }
  putProp(o, n, x) {
    const p = this.findProp(o, n);
    if (!p) throw new Error("put_prop: object " + o + " has no property " + n + ".");
    if ((this.mem[p] >> 5) === 0) this.wb(p + 1, x); else this.ww(p + 1, x);
  }
  nextProp(o, n) {
    if (!o) return 0;
    let p;
    if (n === 0) p = this.firstProp(o);
    else { p = this.findProp(o, n); if (!p) throw new Error("get_next_prop: no property " + n + "."); p += 2 + (this.mem[p] >> 5); }
    return this.mem[p] & 31;
  }
  removeObj(o) {
    const p = this.parent(o);
    if (!p) return;
    if (this.child(p) === o) this.setChild(p, this.sibling(o));
    else {
      let x = this.child(p);
      while (x && this.sibling(x) !== o) x = this.sibling(x);
      if (x) this.setSibling(x, this.sibling(o));
    }
    this.setParent(o, 0); this.setSibling(o, 0);
  }
  insertObj(o, d) {
    if (!o) return;
    this.removeObj(o);
    this.setParent(o, d); this.setSibling(o, this.child(d)); this.setChild(d, o);
  }

  // ------------------------------------------------------------ dictionary and input
  buildDict() {
    const m = this.mem; let a = this.dict;
    const n = m[a++];
    this.separators = [];
    for (let i = 0; i < n; i++) this.separators.push(m[a++]);
    const len = m[a++]; let count = zs16(this.rw(a)); a += 2;
    count = Math.abs(count);
    this.words = new Map();
    for (let i = 0; i < count; i++, a += len) this.words.set(m[a] + "," + m[a + 1] + "," + m[a + 2] + "," + m[a + 3], a);
  }
  encode(word) {
    const shift2 = this.v >= 3 ? 5 : 3, A2 = this.alpha[2];
    let zs = [];
    for (const ch of word) {
      let i = ZM_A0.indexOf(ch);
      if (i >= 0) { zs.push(i + 6); continue; }
      i = A2.indexOf(ch);
      if (i > 0 && ch !== "\n") { zs.push(shift2, i + 6); continue; }
      const c = this.toZscii(ch);
      zs.push(shift2, 6, (c >> 5) & 31, c & 31);
    }
    zs = zs.slice(0, 6);
    while (zs.length < 6) zs.push(5);
    const w1 = (zs[0] << 10) | (zs[1] << 5) | zs[2], w2 = 0x8000 | (zs[3] << 10) | (zs[4] << 5) | zs[5];
    return [w1 >> 8, w1 & 255, w2 >> 8, w2 & 255];
  }
  lookup(word) { return this.words.get(this.encode(word).join(",")) || 0; }
  // Called by the door with the line the caller typed.
  input(line) {
    const { text, parse } = this.read; this.read = null;
    const m = this.mem;
    const max = Math.max(0, m[text] - 1);
    const codes = [];
    for (const ch of String(line).toLowerCase()) {
      if (codes.length >= max) break;
      const c = this.toZscii(ch);
      if (c !== 63 || ch === "?") codes.push(c);
    }
    for (let i = 0; i < codes.length; i++) this.wb(text + 1 + i, codes[i]);
    this.wb(text + 1 + codes.length, 0);
    this.tokenize(text, parse, codes);
  }
  tokenize(text, parse, codes) {
    const words = [];
    let start = -1;
    const end = i => { if (start >= 0) { words.push([start, i - start]); start = -1; } };
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 32) end(i);
      else if (this.separators.includes(c)) { end(i); words.push([i, 1]); }
      else if (start < 0) start = i;
    }
    end(codes.length);
    const maxWords = this.mem[parse], n = Math.min(words.length, maxWords);
    this.wb(parse + 1, n);
    for (let k = 0; k < n; k++) {
      const [pos, len] = words[k];
      const w = String.fromCharCode(...codes.slice(pos, pos + len));
      const e = parse + 2 + 4 * k;
      this.ww(e, this.lookup(w));
      this.wb(e + 2, len);
      this.wb(e + 3, pos + 1);
    }
  }

  // ------------------------------------------------------------ status line
  status() {
    return {
      room: this.shortName(this.rw(this.globals)),
      a: zs16(this.rw(this.globals + 2)),
      b: zs16(this.rw(this.globals + 4)),
      time: this.v === 3 && !!(this.mem[1] & 2),
    };
  }

  // ------------------------------------------------------------ save / restore
  snapshot() {
    const diff = [];
    let z = 0;
    for (let i = 0; i < this.staticBase; i++) {
      const x = this.mem[i] ^ this.story[i];
      if (x === 0) { if (++z === 256) { diff.push(0, 255); z = 0; } }
      else { if (z) { diff.push(0, z - 1); z = 0; } diff.push(x); }
    }
    if (z) diff.push(0, z - 1);
    const frames = this.frames.concat([this.fp]).map(f => [f.ret, f.store, f.locals, f.base, f.argc]);
    let bin = "";
    for (let i = 0; i < diff.length; i += 8192) bin += String.fromCharCode(...diff.slice(i, i + 8192));
    return JSON.stringify({ z: 1, id: this.storyId(), pc: this.pc, stack: this.stack, frames, mem: btoa(bin) });
  }
  storyId() { return this.rw(2) + "/" + String.fromCharCode(...this.story.subarray(0x12, 0x18)); }
  restoreFrom(json) {
    let s;
    try { s = JSON.parse(json); } catch (e) { return false; }
    if (!s || s.z !== 1 || s.id !== this.storyId()) return false;
    const bin = atob(s.mem), keep = this.mem[0x11] & 3;
    const dyn = new Uint8Array(this.staticBase);
    let i = 0, j = 0;
    while (j < bin.length && i < dyn.length) {
      const x = bin.charCodeAt(j++);
      if (x === 0) { const n = bin.charCodeAt(j++) + 1; for (let k = 0; k < n && i < dyn.length; k++, i++) dyn[i] = this.story[i]; }
      else { dyn[i] = this.story[i] ^ x; i++; }
    }
    for (; i < dyn.length; i++) dyn[i] = this.story[i];
    this.mem.set(dyn);
    this.mem[0x11] = (this.mem[0x11] & ~3) | keep;
    this.setHeader();
    const fr = s.frames.map(f => ({ ret: f[0], store: f[1], locals: f[2].slice(), base: f[3], argc: f[4] }));
    this.fp = fr.pop(); this.frames = fr;
    this.stack = s.stack.slice();
    this.pc = s.pc;
    return true;
  }
  verify() {
    const len = this.rw(0x1a) * 2;
    let sum = 0;
    for (let i = 0x40; i < Math.min(len, this.story.length); i++) sum = (sum + this.story[i]) & 0xffff;
    return sum === this.rw(0x1c);
  }
  // The door calls these after the board answers a save or restore.
  resumeSave(ok) { this.branch(ok); }
  resumeRestore(json) { if (json && this.restoreFrom(json)) this.branch(true); else this.branch(false); }

  // ------------------------------------------------------------ execution
  // Runs until the story needs something: "input", "save", "restore", "quit", or "yield" (after a
  // long stretch of work, so the browser stays responsive).
  run(limit = 100000) {
    for (let n = 0; n < limit; n++) {
      const r = this.step();
      if (r) return r;
    }
    return "yield";
  }
  store(x) { this.setVar(this.mem[this.pc++], x); }
  branch(cond) {
    const m = this.mem, b = m[this.pc++];
    let off;
    if (b & 0x40) off = b & 0x3f;
    else { off = ((b & 0x3f) << 8) | m[this.pc++]; if (off & 0x2000) off -= 0x4000; }
    if (!!cond === !!(b & 0x80)) {
      if (off === 0) this.ret(0);
      else if (off === 1) this.ret(1);
      else this.pc += off - 2;
    }
  }
  call(paddr, args, storeVar) {
    if (paddr === 0) { if (storeVar >= 0) this.setVar(storeVar, 0); return; }
    let a = this.unpack(paddr);
    const n = this.mem[a++];
    if (n > 15) throw new Error("Bad routine at " + a.toString(16) + ".");
    const locals = new Array(n);
    for (let i = 0; i < n; i++, a += 2) locals[i] = this.rw(a);
    for (let i = 0; i < Math.min(args.length, n); i++) locals[i] = args[i];
    this.frames.push(this.fp);
    this.fp = { ret: this.pc, store: storeVar, locals, base: this.stack.length, argc: args.length };
    this.pc = a;
  }
  ret(x) {
    const f = this.fp;
    if (!this.frames.length) throw new Error("Return from the main routine.");
    this.stack.length = f.base;
    this.fp = this.frames.pop();
    this.pc = f.ret;
    if (f.store >= 0) this.setVar(f.store, x);
  }
  step() {
    const m = this.mem;
    let pc = this.pc;
    const op = m[pc++];
    let form, num;
    const types = [];
    if (op < 0x80) { form = 2; num = op & 0x1f; types.push(op & 0x40 ? 2 : 1, op & 0x20 ? 2 : 1); }
    else if (op < 0xc0) { num = op & 0x0f; const t = (op >> 4) & 3; if (t === 3) form = 0; else { form = 1; types.push(t); } }
    else {
      form = op & 0x20 ? 3 : 2; num = op & 0x1f;
      const tb = m[pc++];
      for (let s = 6; s >= 0; s -= 2) { const t = (tb >> s) & 3; if (t === 3) break; types.push(t); }
    }
    const a = [];
    for (const t of types) {
      if (t === 0) { a.push((m[pc] << 8) | m[pc + 1]); pc += 2; }
      else if (t === 1) a.push(m[pc++]);
      else a.push(this.getVar(m[pc++]));
    }
    this.pc = pc;
    switch (form) {
      case 2: return this.op2(num, a, op);
      case 1: return this.op1(num, a[0], op);
      case 0: return this.op0(num, op);
      default: return this.opVar(num, a, op);
    }
  }
  bad(op) { throw new Error("Illegal opcode 0x" + op.toString(16) + " at " + this.pc.toString(16) + "."); }
  op2(n, o, op) {
    const [x, y] = o;
    switch (n) {
      case 1: return this.branch(o.slice(1).some(v => v === x));
      case 2: return this.branch(zs16(x) < zs16(y));
      case 3: return this.branch(zs16(x) > zs16(y));
      case 4: { const v = zs16(this.peekVar(x)) - 1; this.pokeVar(x, v); return this.branch(v < zs16(y)); }
      case 5: { const v = zs16(this.peekVar(x)) + 1; this.pokeVar(x, v); return this.branch(v > zs16(y)); }
      case 6: return this.branch(this.parent(x) === y);
      case 7: return this.branch((x & y) === y);
      case 8: return this.store(x | y);
      case 9: return this.store(x & y);
      case 10: return this.branch(this.attr(x, y));
      case 11: return this.setAttr(x, y, true);
      case 12: return this.setAttr(x, y, false);
      case 13: return this.pokeVar(x, y);
      case 14: return this.insertObj(x, y);
      case 15: return this.store(this.rw((x + 2 * y) & 0xffff));
      case 16: return this.store(this.mem[(x + y) & 0xffff]);
      case 17: return this.store(this.getProp(x, y));
      case 18: { const p = x ? this.findProp(x, y) : 0; return this.store(p ? p + 1 : 0); }
      case 19: return this.store(this.nextProp(x, y));
      case 20: return this.store(zs16(x) + zs16(y));
      case 21: return this.store(zs16(x) - zs16(y));
      case 22: return this.store(Math.imul(zs16(x), zs16(y)));
      case 23: if (!zs16(y)) throw new Error("Division by zero."); return this.store(Math.trunc(zs16(x) / zs16(y)));
      case 24: if (!zs16(y)) throw new Error("Division by zero."); return this.store(zs16(x) % zs16(y));
    }
    this.bad(op);
  }
  op1(n, x, op) {
    switch (n) {
      case 0: return this.branch(x === 0);
      case 1: { const s = this.sibling(x); this.store(s); return this.branch(s !== 0); }
      case 2: { const c = this.child(x); this.store(c); return this.branch(c !== 0); }
      case 3: return this.store(this.parent(x));
      case 4: return this.store(x ? (this.mem[x - 1] >> 5) + 1 : 0);
      case 5: return this.pokeVar(x, zs16(this.peekVar(x)) + 1);
      case 6: return this.pokeVar(x, zs16(this.peekVar(x)) - 1);
      case 7: return this.print(this.decode(x).text);
      case 9: return this.removeObj(x);
      case 10: return this.print(this.shortName(x));
      case 11: return this.ret(x);
      case 12: this.pc += zs16(x) - 2; return;
      case 13: return this.print(this.decode(this.unpack(x)).text);
      case 14: return this.store(this.peekVar(x));
      case 15: return this.store(~x & 0xffff);
    }
    this.bad(op);
  }
  op0(n, op) {
    switch (n) {
      case 0: return this.ret(1);
      case 1: return this.ret(0);
      case 2: { const d = this.decode(this.pc); this.pc = d.end; return this.print(d.text); }
      case 3: { const d = this.decode(this.pc); this.pc = d.end; this.print(d.text + "\n"); return this.ret(1); }
      case 4: return;
      case 5: return "save";
      case 6: return "restore";
      case 7: this.restart(); return;
      case 8: return this.ret(this.getVar(0));
      case 9: this.getVar(0); return;
      case 10: return "quit";
      case 11: return this.print("\n");
      case 12: return;   // show_status: the door draws the status line before every prompt
      case 13: return this.branch(this.verify());
      case 15: return this.branch(true);
    }
    this.bad(op);
  }
  opVar(n, o, op) {
    switch (n) {
      case 0: { const sv = this.mem[this.pc++]; return this.call(o[0], o.slice(1), sv); }
      case 1: return this.ww((o[0] + 2 * o[1]) & 0xffff, o[2]);
      case 2: return this.wb((o[0] + o[1]) & 0xffff, o[2]);
      case 3: return this.putProp(o[0], o[1], o[2]);
      case 4: this.read = { text: o[0], parse: o[1] }; return "input";
      case 5: return this.print(this.zscii(o[0]));
      case 6: return this.print(String(zs16(o[0])));
      case 7: return this.store(this.random(zs16(o[0])));
      case 8: return this.setVar(0, o[0]);
      case 9: { const v = this.getVar(0); return this.pokeVar(o[0], v); }
      case 10: case 11: return;   // split_window / set_window: Zork doesn't use the upper window
      case 19: {
        const s = zs16(o[0]);
        if (s === 1) this.screen = true;
        else if (s === -1) this.screen = false;
        else if (s === 3) this.streams3.push({ table: o[1], data: [] });
        else if (s === -3 && this.streams3.length) {
          const t = this.streams3.pop();
          this.ww(t.table, t.data.length);
          t.data.forEach((c, i) => this.wb(t.table + 2 + i, c));
        }
        return;
      }
      case 20: return;
      case 21: if (this.onBeep && (o[0] === 1 || o[0] === 2)) this.onBeep(o[0]); return;
    }
    this.bad(op);
  }
}

// ---------------------------------------------------------------- the Zork doors
const ZORK_GAMES = {
  zork1: { file: "zork1.z3", title: "ZORK I: The Great Underground Empire", year: 1980 },
  zork2: { file: "zork2.z3", title: "ZORK II: The Wizard of Frobozz", year: 1981 },
  zork3: { file: "zork3.z3", title: "ZORK III: The Dungeon Master", year: 1982 },
};
const zorkStories = {};

// Word-wraps finished game text to the terminal, keeping the story's own line breaks and indents.
function zWrap(text, width = 79) {
  return text.split("\n").map(line => {
    if (line.length <= width) return line;
    const indent = line.match(/^ */)[0], words = line.slice(indent.length).split(" ");
    const lines = []; let cur = indent;
    for (const w of words) {
      if (cur.length + w.length + (cur.trim() ? 1 : 0) > width && cur.trim()) { lines.push(cur); cur = w; }
      else cur += (cur.trim() ? " " : "") + w;
    }
    lines.push(cur);
    return lines.join("\n");
  }).join("\n");
}
function zStatusBar(zm) {
  const s = zm.status();
  const right = s.time
    ? "Time: " + ((s.a + 11) % 12 + 1) + ":" + String(s.b).padStart(2, "0") + (s.a >= 12 ? " pm" : " am")
    : "Score: " + s.a + "   Moves: " + s.b;
  const room = esc(s.room).slice(0, 78 - right.length - 3);
  return "|17|15 " + room + " ".repeat(Math.max(1, 78 - room.length - right.length)) + right + " |16|07\n";
}

async function zorkDoor(id) {
  const g = ZORK_GAMES[id];
  cls();
  await out("|15 " + g.title + "\n" + rule(8) +
    "|07 Copyright (c) " + g.year + " Infocom, Inc. Source code released by Microsoft under\n" +
    " the MIT License (2025).\n\n" +
    "|07 Type |15SAVE|07 and |15RESTORE|07 to keep your place on the board. |15QUIT|07 to leave.\n");
  let saved = null;
  try { saved = await doorLoad(id); } catch (e) { saved = null; }
  if (saved) await out("|08 You have a game saved on the board from " + d8(saved.at) + ". Type RESTORE to pick it up.\n");
  if (!zorkStories[id]) { await out("|08 Loading " + g.file.toUpperCase() + "... "); zorkStories[id] = await doorFetch(g.file); await out("|08done.\n"); }
  await out(rule(8) + "\n");

  const zm = new ZMachine(zorkStories[id]);
  zm.onBeep = kind => { if (A.ready()) A.tone([kind === 1 ? 1000 : 400], 0, 0.15, 0.25); };
  const flush = async () => {
    const t = zm.takeOutput();
    if (t) await out("|07" + esc(zWrap(t)));
  };
  while (true) {
    const r = zm.run();
    if (r === "yield") { await flush(); await sleep(0); continue; }
    if (r === "input") {
      // Draw the status line above Zork's own ">" prompt, the way the top line of the screen showed it.
      const t = zm.takeOutput();
      const cut = t.lastIndexOf("\n");
      const head = cut >= 0 ? t.slice(0, cut + 1) : "", prompt = cut >= 0 ? t.slice(cut + 1) : t;
      if (head) await out("|07" + esc(zWrap(head)));
      if (prompt.trim() === ">") await out(zStatusBar(zm));
      await out("|07" + esc(prompt));
      const line = await readLine({ max: 78 });
      zm.input(line);
      continue;
    }
    if (r === "save") {
      await flush();
      let ok = false;
      try { await doorSave(id, zm.snapshot()); ok = true; await out("|08[Saved to the board.]|07\n"); }
      catch (e) { await out("|12[" + esc(e.message || "Couldn't save.") + "]|07\n"); }
      zm.resumeSave(ok);
      continue;
    }
    if (r === "restore") {
      await flush();
      let data = null;
      try { const s = await doorLoad(id); data = s && s.data; } catch (e) { data = null; }
      if (!data) await out("|08[There's no saved game on the board.]|07\n");
      zm.resumeRestore(data);
      continue;
    }
    // quit
    await flush();
    const s = zm.status();
    if (!s.time && s.a > 0) await doorScore(id, s.a, s.b + " moves");
    await anyKey("\n|08[The game is over. Press any key to return to the doors.]");
    return;
  }
}
DOOR.zork1 = () => zorkDoor("zork1");
DOOR.zork2 = () => zorkDoor("zork2");
DOOR.zork3 = () => zorkDoor("zork3");
