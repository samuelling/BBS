// Door games on the board server.
//
// Single-player doors (Zork, Colossal Cave, the BASIC classics) run entirely in the caller's
// browser; the board only keeps their saved game and best score. The shared worlds (Usurper,
// Red Drain, Trade Wipes, Barren Drains) run here, because everyone plays in the same world and
// nobody's browser can be trusted with it. Each shared world is a module with
//   export async function handle(action, body, ctx)  ->  a plain object (sent back as JSON)
// ctx = { env, db, line, user, now, clean, fail(message, status), log(kind, fields) }

import * as usurper from "./usurper.js";
import * as reddrain from "./reddrain.js";
import * as tradewipes from "./tradewipes.js";
import * as barren from "./barren.js";

const WORLDS = { usurper, reddrain, tradewipes, barren };
const SOLO = new Set(["zork1", "zork2", "zork3", "advent", "wumpus", "trek", "hammurabi", "lander", "escape"]);
const MAX_SAVE = 60000;

export async function doorRoute(path, body, ctx) {
  const { db, user, fail, now, clean } = ctx;
  const [game, ...rest] = path.split("/");
  const action = rest.join("/");

  if (game === "save" || game === "score") {
    const g = String(body.game || "");
    if (game === "score" && action === "top") {
      const games = (Array.isArray(body.games) ? body.games : [g]).filter(x => SOLO.has(x)).slice(0, 20);
      const top = {};
      for (const x of games)
        top[x] = (await db.prepare("SELECT handle, score, detail, at FROM door_scores WHERE game = ? ORDER BY score DESC, at LIMIT 10").bind(x).all()).results;
      return { top };
    }
    if (!SOLO.has(g)) fail("No such door.", 404);
    if (path === "save/get") {
      const r = await db.prepare("SELECT data, at FROM door_saves WHERE user_id = ? AND game = ?").bind(user.id, g).first();
      return { save: r || null };
    }
    if (path === "save/put") {
      const data = typeof body.data === "string" ? body.data : "";
      if (!data || data.length > MAX_SAVE) fail("That saved game is too big for the board's disk.");
      await db.prepare("INSERT INTO door_saves (user_id, game, data, at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (user_id, game) DO UPDATE SET data = ?3, at = ?4")
        .bind(user.id, g, data, now()).run();
      return { ok: true };
    }
    if (path === "save/del") {
      await db.prepare("DELETE FROM door_saves WHERE user_id = ? AND game = ?").bind(user.id, g).run();
      return { ok: true };
    }
    if (path === "score/put") {
      const score = Math.trunc(+body.score);
      if (!Number.isFinite(score) || score < 0 || score > 1e9) fail("Bad score.");
      await db.prepare(
        "INSERT INTO door_scores (game, user_id, handle, score, detail, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) " +
        "ON CONFLICT (game, user_id) DO UPDATE SET score = ?4, detail = ?5, at = ?6, handle = ?3 WHERE ?4 > door_scores.score"
      ).bind(g, user.id, user.handle, score, clean(body.detail, 60), now()).run();
      return { ok: true };
    }
    fail("Unknown command.", 404);
  }

  const world = WORLDS[game];
  if (!world) fail("No such door.", 404);
  if (user.level < 10) fail("The shared-world doors open once the SysOp validates your account.", 403);
  return world.handle(action, body, ctx);
}
