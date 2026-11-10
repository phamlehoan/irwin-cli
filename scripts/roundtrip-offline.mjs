// Offline round-trip: irwin new -> add every pack -> remove every pack, compare trees.
// No network and no package manager needed (everything runs with --skip-install).
// Usage: node scripts/roundtrip-offline.mjs [--keep]
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");
const keep = process.argv.includes("--keep");
const verbose = process.argv.includes("--verbose");

function run(cwd, args) {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", env: { ...process.env, INIT_CWD: "" } });
  return { code: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

function tree(dir, rel = "", out = new Map()) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) tree(p, r, out);
    else out.set(r, crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"));
  }
  return out;
}

const features = path.join(root, "features");
const manifests = new Map();
for (const d of fs.readdirSync(features, { withFileTypes: true })) {
  const mf = path.join(features, d.name, "manifest.json");
  if (d.isDirectory() && fs.existsSync(mf)) manifests.set(d.name, JSON.parse(fs.readFileSync(mf, "utf8")));
}
const order = [];
const visit = (id) => {
  if (order.includes(id)) return;
  for (const r of manifests.get(id)?.requires ?? []) visit(r);
  order.push(id);
};
for (const id of manifests.keys()) visit(id);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-roundtrip-"));
let failed = false;
const fail = (m) => {
  failed = true;
  console.error("FAIL:", m);
};

const IGNORE = new Set(["package.json", ".irwin/features.json", ".env", "configs/irwin/featureCatalog.json"]);
// package.json: deps are not pruned on remove (documented). .env: created from .env.example, user-owned.
// featureCatalog.json: carries a generatedAt timestamp.

function diffTrees(a, b) {
  const out = [];
  for (const [f, h] of a) if (!IGNORE.has(f) && b.get(f) !== h) out.push(`${b.has(f) ? "changed" : "missing"}  ${f}`);
  for (const f of b.keys()) if (!IGNORE.has(f) && !a.has(f)) out.push(`added    ${f}`);
  return out;
}

function newApp(name) {
  const r = run(tmp, ["new", name, "--skip-install", "--skip-dev"]);
  if (r.code !== 0) {
    console.error(r.out);
    process.exit(1);
  }
  return path.join(tmp, name);
}

function addAll(app, extra = []) {
  for (const id of order) {
    const r = run(app, ["add", id, "--skip-install", ...extra]);
    if (r.code !== 0) fail(`add ${id} ${extra.join(" ")}\n${r.out}`);
  }
}

// Phase A — idempotency: the first `--force` pass may legitimately change things (it re-copies
// shared files and lets admin-rbac pick up the jobs UI); a SECOND pass must change nothing,
// i.e. patches are not applied twice.
{
  const app = newApp("idem");
  addAll(app);
  addAll(app, ["--force"]);
  const afterForce = tree(app);
  addAll(app, ["--force"]);
  const d = diffTrees(afterForce, tree(app));
  if (d.length) fail(`add --force is not idempotent:\n  ${d.join("\n  ")}`);
  else console.log(`A ok: repeated add --force over ${order.length} packs is idempotent`);
}

// Phase B — exact unwind: remove in reverse order restores the original project.
{
  const app = newApp("unwind");
  const before = tree(app);
  addAll(app);
  const peak = tree(app).size;
  for (const id of [...order].reverse()) {
    const r = run(app, ["remove", id]);
    if (r.code !== 0) fail(`remove ${id}\n${r.out}`);
    if (verbose || /keep |manual /.test(r.out)) console.log(`remove ${id}\n${r.out}`);
  }
  const d = diffTrees(before, tree(app));
  if (d.length) fail(`tree differs after add-all/remove-all:\n  ${d.join("\n  ")}`);
  else console.log(`B ok: add-all/remove-all restored the project (${order.length} packs, ${peak} files at peak)`);
}

console.log(failed ? "ROUNDTRIP FAILED" : "ROUNDTRIP OK");
if (!keep) fs.rmSync(tmp, { recursive: true, force: true });
else console.log("kept:", tmp);
process.exit(failed ? 1 : 0);