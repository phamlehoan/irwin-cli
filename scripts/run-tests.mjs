// Runs every compiled test (dist/**/*.test.js) with the built-in node test runner.
// Explicit file list: works on Node 20/22, Windows/POSIX, no shell globbing.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".test.js")) out.push(p);
  }
  return out;
}

const files = walk(path.join(root, "dist")).sort();
if (files.length === 0) {
  console.error("No compiled tests found in dist/. Run the build first.");
  process.exit(1);
}
const r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit", cwd: root });
process.exit(r.status ?? 1);
