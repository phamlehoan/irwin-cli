/**
 * Smoke E2E: irwin new → add database/session/auth → doctor → optional g scaffold
 * Run from irwin-cli after build. App is created under VIZ Framework/.tmp/e2e-smoke
 * so the repo root stays clean (ts-rails resolved from npm).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(__dirname, "..");
const vizRoot = path.resolve(cliRoot, "..");
const cliBin = path.join(cliRoot, "dist", "cli.js");
const appName = "e2e-smoke";
const tmpRoot = path.join(vizRoot, ".tmp");
const appDir = path.join(tmpRoot, appName);

function run(cmd, opts = {}) {
  execSync(cmd, {
    stdio: "inherit",
    cwd: opts.cwd ?? appDir,
    env: { ...process.env, ...opts.env },
  });
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`E2E failed: ${msg}`);
    process.exit(1);
  }
}

if (!fs.existsSync(cliBin)) {
  console.error("Build irwin-cli first: npm run build");
  process.exit(1);
}

if (fs.existsSync(appDir)) {
  fs.rmSync(appDir, { recursive: true, force: true });
}

fs.mkdirSync(tmpRoot, { recursive: true });
console.log("\n[e2e] irwin new");
run(`node "${cliBin}" new ${appName} --skip-dev -pm npm`, { cwd: tmpRoot });

assert(fs.existsSync(path.join(appDir, ".irwin", "features.json")), "registry missing");

const add = (feature) => {
  console.log(`\n[e2e] irwin add ${feature}`);
  run(`node "${cliBin}" add ${feature}`, { cwd: appDir });
};

console.log("\n[e2e] npm install");
run("npm install", { cwd: appDir });

add("database");
add("session");
add("auth");

console.log("\n[e2e] db:seed");
run("npm run db:seed", { cwd: appDir });

console.log("\n[e2e] irwin doctor");
run(`node "${cliBin}" doctor`, { cwd: appDir });

assert(
  fs.existsSync(path.join(appDir, "configs", "routes", "auth.route.ts")),
  "auth routes missing",
);
assert(
  fs.existsSync(path.join(appDir, "app", "models", "generated", "prisma", "client")),
  "prisma client missing",
);

console.log("\n[e2e] irwin g scaffold Product name:string");
run(`node "${cliBin}" g scaffold Product name:string`, { cwd: appDir });

assert(
  fs.existsSync(path.join(appDir, "app", "controllers", "products.controller.ts")) ||
    fs.existsSync(path.join(appDir, "app", "controllers", "product.controller.ts")),
  "scaffold controller missing",
);

console.log("\n[e2e] PASS — cleaning up", appDir);
try {
  fs.rmSync(appDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
} catch (e) {
  console.warn(
    "[e2e] cleanup skipped (remove manually):",
    e instanceof Error ? e.message : e,
  );
}
