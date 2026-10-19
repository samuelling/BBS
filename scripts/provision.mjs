// Makes sure the board's D1 database and R2 bucket exist on the Cloudflare
// account, and writes the database id into wrangler.jsonc. Safe to run every deploy.
import { execSync } from "node:child_process";
import fs from "node:fs";

const DB = "septic-tankz";
const BUCKET = "septic-tankz-files";
const sh = cmd => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const wr = args => sh(`npx wrangler ${args}`);
const fail = msg => { console.error(`::error::${msg}`); process.exit(1); };

function listDbs() {
  const out = wr("d1 list --json");
  return JSON.parse(out.slice(out.indexOf("[")));
}

let db = listDbs().find(d => d.name === DB);
if (!db) {
  console.log(`Creating D1 database ${DB}`);
  wr(`d1 create ${DB}`);
  db = listDbs().find(d => d.name === DB);
}
if (!db) fail(`Couldn't create the ${DB} database.`);
const id = db.uuid || db.id || db.database_id;
const cfgPath = "wrangler.jsonc";
fs.writeFileSync(cfgPath, fs.readFileSync(cfgPath, "utf8").replace(/"database_id":\s*"[^"]*"/, `"database_id": "${id}"`));
console.log(`D1 database ${DB}: ${id}`);

try {
  wr(`r2 bucket create ${BUCKET}`);
  console.log(`Created R2 bucket ${BUCKET}`);
} catch (e) {
  const msg = `${e.stdout || ""}${e.stderr || ""}`;
  if (/already exists|10004/i.test(msg)) console.log(`R2 bucket ${BUCKET} already exists`);
  else if (/enable R2|10042|purchase/i.test(msg)) {
    fail("R2 isn't turned on for this Cloudflare account yet. In the Cloudflare dashboard open R2 Object Storage and enable it, then re-run this workflow.");
  } else fail(`Couldn't create the R2 bucket:\n${msg}`);
}
