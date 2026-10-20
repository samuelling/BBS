// Shared plumbing for door games. Every file in web/doors/ is pasted into app.js by build.py
// (sorted by name, so this one comes first) and can use the terminal helpers there:
// out, outNow, cls, readKey, readLine, anyKey, sleep, act, api, esc, uc, pad, lpad, wrap, rule, A (audio).
//
// A door registers itself:   DOOR.mygame = async function () { ... };
// and returns when the caller quits. Throwing is fine: guard() reports the error and comes back to the menu.
const DOOR = {};

// Static files a door needs (story files, wasm). Relative, so it works on the Worker and on GitHub Pages.
function doorAsset(name) { return "doors/" + name; }
async function doorFetch(name) {
  const r = await fetch(doorAsset(name));
  if (!r.ok) throw new Error("Couldn't load " + name + " (" + r.status + ")");
  return new Uint8Array(await r.arrayBuffer());
}

// One saved game per caller per door, kept on the board (up to ~60K of text; base64 binary saves).
async function doorSave(game, data) { return api("door/save/put", { game, data }); }
async function doorLoad(game) { const r = await api("door/save/get", { game }); return r.save; }   // { data, at } or null
async function doorDelSave(game) { return api("door/save/del", { game }); }
// High scores: the board keeps each caller's best.
async function doorScore(game, score, detail) { try { return await api("door/score/put", { game, score: Math.round(score), detail: detail || "" }); } catch (e) { return null; } }

function b64FromBytes(u8) { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(s); }
function bytesFromB64(b64) { const s = atob(b64); const u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; }
