// Colossal Cave Adventure — the real thing.
//
// This is Eric S. Raymond's Open Adventure (BSD-2-Clause), the faithful C version of Will Crowther
// and Don Woods's 1976-77 game, compiled to WebAssembly (public/doors/advent.wasm; rebuild with
// scripts/build_advent.sh). Below is just enough WASI for it to run in the terminal: its printf()s
// land on the screen, and its readline() waits for Q-Slodem's line input. Binaryen's asyncify pass
// lets the C code pause mid-call while the caller types. The game's SAVE file goes to the board.

class AdventExit extends Error { constructor(code) { super("exit " + code); this.code = code; } }

// Runs the program. io = { write(text), readLine() -> Promise<string|null>, loadSave() -> Uint8Array|null, storeSave(bytes) }
async function adventRun(wasmBytes, args, io) {
  let mem, ex, dataPtr = 0, pending = null, resumeLine = null, rewinding = false;
  const DATA_SIZE = 65536;
  const u8 = () => new Uint8Array(mem.buffer), dv = () => new DataView(mem.buffer);
  const dec = new TextDecoder("latin1"), enc = new TextEncoder();
  const argBytes = args.map(a => enc.encode(a + "\0"));

  const wasi = {
    args_sizes_get(argc, bufSize) { dv().setUint32(argc, args.length, true); dv().setUint32(bufSize, argBytes.reduce((n, b) => n + b.length, 0), true); return 0; },
    args_get(argv, buf) { let p = buf; argBytes.forEach((b, i) => { dv().setUint32(argv + i * 4, p, true); u8().set(b, p); p += b.length; }); return 0; },
    clock_time_get(id, prec, out) { dv().setBigUint64(out, BigInt(Date.now()) * 1000000n, true); return 0; },
    // Every fd is a terminal: the game then skips echoing input (Q-Slodem already shows it).
    fd_fdstat_get(fd, out) { const d = dv(); for (let i = 0; i < 24; i++) d.setUint8(out + i, 0); d.setUint8(out, 2); return 0; },
    fd_read() { return 52; },          // ENOSYS: input comes through readline()
    fd_seek() { return 70; },          // ESPIPE
    fd_close() { return 0; },
    fd_write(fd, iovs, n, written) {
      const d = dv(); let total = 0, s = "";
      for (let i = 0; i < n; i++) {
        const p = d.getUint32(iovs + i * 8, true), l = d.getUint32(iovs + i * 8 + 4, true);
        s += dec.decode(u8().subarray(p, p + l)); total += l;
      }
      if (fd === 1 || fd === 2) io.write(s);
      d.setUint32(written, total, true); return 0;
    },
    proc_exit(code) { throw new AdventExit(code); },
  };
  let saveBytes = null;
  const env = {
    js_readline(buf, max) {
      if (rewinding) {
        ex.asyncify_stop_rewind(); rewinding = false;
        const line = resumeLine; resumeLine = null;
        if (line === null) return -1;
        const b = enc.encode(line).subarray(0, max);
        u8().set(b, buf); return b.length;
      }
      // Park the C stack and come back once the caller has typed a line.
      const d = dv(); d.setUint32(dataPtr, dataPtr + 8, true); d.setUint32(dataPtr + 4, dataPtr + DATA_SIZE, true);
      pending = io.readLine();
      ex.asyncify_start_unwind(dataPtr);
      return 0;
    },
    js_save_size() { saveBytes = io.loadSave(); return saveBytes ? saveBytes.length : 0; },
    js_save_read(buf) { if (saveBytes) u8().set(saveBytes, buf); },
    js_save_write(buf, len) { io.storeSave(u8().slice(buf, buf + len)); },
  };
  const { instance } = await WebAssembly.instantiate(wasmBytes, { wasi_snapshot_preview1: wasi, env });
  ex = instance.exports; mem = ex.memory;
  dataPtr = ex.adv_alloc(DATA_SIZE);
  try {
    while (true) {
      ex._start();
      if (ex.asyncify_get_state() !== 1) return 0;     // ran to the end without exit()
      ex.asyncify_stop_unwind();
      resumeLine = await pending; pending = null;
      rewinding = true;
      ex.asyncify_start_rewind(dataPtr);
    }
  } catch (e) {
    if (e instanceof AdventExit) return e.code;
    throw e;
  }
}

DOOR.advent = async function () {
  cls();
  await out(
    "|14 C O L O S S A L   C A V E   A D V E N T U R E\n" + rule(6) +
    "|07 The original text adventure, by |15Will Crowther|07 (1976) and |15Don Woods|07 (1977).\n" +
    "|07 This is |15Open Adventure|07, Eric S. Raymond's faithful C version of Woods's\n" +
    "|07 430-point edition, BSD licensed, running here for real.\n\n" +
    "|08 Talk to it in one or two words: |07ENTER BUILDING|08, |07GET LAMP|08, |07NORTH|08, |07INVENTORY|08.\n" +
    "|08 |07SAVE|08 and |07RESUME|08 keep your place on the board. |07QUIT|08 ends the game.\n" + rule(6));

  const [wasm, save] = await Promise.all([doorFetch("advent.wasm"), doorLoad("advent").catch(() => null)]);
  let saved = save ? bytesFromB64(save.data) : null;
  const args = ["advent"];
  if (saved) {
    await out("|07 You have a saved game from |15" + d8(save.at) + "|07.  {R} Resume it  {N} New game  {Q} Back |15");
    const k = await readKey("RNQ", { enter: "R" });
    if (k === "Q") return;
    if (k === "R") args.push("-r", "advent.sav");
    outNow("\n");
  }

  // The game writes in bursts; show each burst when it stops to ask for input.
  let buf = "", all = "", lastAsk = "", pendingSave = null;
  const flush = async () => {
    if (!buf) return;
    let s = buf.replace(/\r/g, ""); buf = "";
    if (/^\nCan't open file .*, try again\.\n?$/.test(s) || /^Can't open file .*, try again\.\n?$/.test(s)) s = "\n|12No saved game on the board yet.|07\n";
    else s = "|07" + esc(s);
    // The command prompt in yellow.
    s = s.replace(/\n> $/, "\n|14> ").replace(/^> $/, "|14> ");
    await out(s);
  };
  const io = {
    write(t) { buf += t; all = (all + t).slice(-4000); },
    async readLine() {
      // The game asks for a save file name; the board has one slot, so answer for the caller.
      if (/File name: $/.test(buf)) {
        buf = buf.replace(/\nFile name: $/, "").replace(/File name: $/, "");
        await flush();
        if (lastAsk === "file") { lastAsk = ""; return ""; }     // the slot was empty: give up quietly
        lastAsk = "file";
        return "advent.sav";
      }
      lastAsk = "";
      await flush();
      const l = await readLine({ max: 76 });
      return l;
    },
    loadSave() { return saved; },
    storeSave(bytes) {
      saved = bytes;
      pendingSave = doorSave("advent", b64FromBytes(bytes));
    },
  };
  const code = await adventRun(wasm, args, io);
  await flush();
  if (pendingSave) {
    try { await pendingSave; await out("\n|10Game saved on the board.|07 Choose Resume next time you open this door.\n"); }
    catch (e) { await out("\n|12The board couldn't save your game: " + esc(e.message) + "|07\n"); }
  }
  const m = /You scored (\d+) out of a possible (\d+), using (\d+) turns?/.exec(all);
  if (m && !pendingSave) {
    await doorScore("advent", +m[1], m[1] + "/" + m[2] + " in " + m[3] + " turns");
  }
  await anyKey();
};
