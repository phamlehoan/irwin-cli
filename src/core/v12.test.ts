import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { runAdd } from "../commands/add";
import { runNew, resolveNewTarget } from "../commands/new";
import { runRemove } from "../commands/remove";
import { applyFeature } from "./applyFeature";
import { checkPackBlocks, readInstalledVersion } from "./doctorChecks";
import { npmFeatureRoots } from "./featureSource";
import { loadManifest, validateManifest } from "./manifest";
import { getIrwinCliRoot } from "./packageRoot";
import { runFeaturePostInstall } from "./postInstall";
import {
  readRegistry,
  validateRegistry,
  withRegistryLock,
  writeRegistry,
} from "./registry";
import { ensureGeneratedSecrets } from "./secrets";
import { addWorkspaceOverrides, findWorkspaceRoot, mergeNpmIntoProject, planInstall } from "./workspace";
import { mergePackageJsonDeps } from "./template";

const tmpDirs: string[] = [];
const cwd0 = process.cwd();

function tmp(prefix = "irwin-v12-"): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

async function mkProject(opts: Parameters<typeof runNew>[1] = {}): Promise<string> {
  const parent = tmp();
  await runNew("demo", { cwd: parent, skipInstall: true, skipDev: true, ...opts });
  return path.join(parent, "demo");
}

function add(root: string, id: string, force = false) {
  return applyFeature(root, loadManifest(id, root), { force });
}

function read(root: string, rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function treeHash(dir: string, rel = "", out: Record<string, string> = {}): Record<string, string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) treeHash(p, r, out);
    else out[r] = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
  }
  return out;
}

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
  return out;
}

afterEach(() => {
  process.chdir(cwd0);
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe("one source for initializeHash (T-033)", () => {
  const defs = (root: string) =>
    walkFiles(root)
      .filter((f) => f.endsWith(".ts") && !f.includes("node_modules"))
      .filter((f) => /export function initializeHash\b/.test(fs.readFileSync(f, "utf8")));

  it("session + auth-api share the hash pack: one definition, one export, one call", async () => {
    for (const order of [
      ["hash", "session", "database", "api", "swagger", "auth-api"],
      ["hash", "database", "api", "swagger", "auth-api", "session"],
    ]) {
      const root = await mkProject();
      for (const id of order) add(root, id);
      assert.equal(defs(root).length, 1, `order ${order.join(",")}`);
      const index = read(root, "configs/initializers/index.ts");
      assert.equal(index.split('export * from "./hash"').length - 1, 1);
      assert.equal(read(root, "configs/application.ts").split("initializeHash();").length - 1, 1);
      assert.ok(!/initializeHash/.test(read(root, "configs/initializers/session.ts")));
    }
  });

  it("session and auth-api refuse to install without the hash pack", async () => {
    const root = await mkProject();
    assert.throws(() => add(root, "session"), /requires "hash"/);
  });
});

describe("feature-store home is opt-in (T-039)", () => {
  it("default new project has no homeFeatures.ts and no catalog", async () => {
    const root = await mkProject();
    assert.ok(!fs.existsSync(path.join(root, "lib/irwin/homeFeatures.ts")));
    assert.ok(!fs.existsSync(path.join(root, "configs/irwin/featureCatalog.json")));
    assert.ok(!/homeFeatures/.test(read(root, "app/controllers/home.controller.ts")));
    assert.ok(!fs.existsSync(path.join(root, "app/views/home.view/_features.pug")));
    add(root, "mailer");
    assert.ok(!fs.existsSync(path.join(root, "lib/irwin/homeFeatures.ts")), "add must not create it");
  });

  it("--with-home generates it and keeps it in sync", async () => {
    const root = await mkProject({ withHome: true });
    assert.ok(fs.existsSync(path.join(root, "lib/irwin/homeFeatures.ts")));
    assert.equal(readRegistry(root).withHome, true);
    assert.ok(/homeFeatures/.test(read(root, "app/controllers/home.controller.ts")));
  });

  it("--api-only never gets the store", async () => {
    const root = await mkProject({ apiOnly: true, withHome: true });
    assert.ok(!fs.existsSync(path.join(root, "lib/irwin/homeFeatures.ts")));
  });
});

describe("irwin new accepts a path and a scoped name (T-041)", () => {
  it("creates services/inv with package name @erp/inv", async () => {
    const parent = tmp();
    await runNew("services/inv", { cwd: parent, name: "@erp/inv", skipInstall: true, noStart: true });
    const pkg = JSON.parse(read(path.join(parent, "services", "inv"), "package.json")) as { name: string };
    assert.equal(pkg.name, "@erp/inv");
  });

  it("validates names", () => {
    assert.deepEqual(resolveNewTarget("a/b-c").packageName, "b-c");
    assert.throws(() => resolveNewTarget("../x"), /Invalid directory/);
    assert.throws(() => resolveNewTarget("ok", "Bad Name"), /Invalid package name/);
    assert.throws(() => resolveNewTarget("bad name"), /Invalid app name/);
    assert.equal(resolveNewTarget("x", "@s/y").packageName, "@s/y");
  });
});

describe("workspace-aware install (T-042)", () => {
  function wsFixture(): { ws: string; app: string } {
    const ws = tmp("irwin-ws-");
    fs.writeFileSync(path.join(ws, "pnpm-workspace.yaml"), "packages:\n  - services/*\n", "utf8");
    const app = path.join(ws, "services", "inv");
    fs.mkdirSync(app, { recursive: true });
    fs.writeFileSync(path.join(app, "package.json"), JSON.stringify({ name: "@erp/inv" }), "utf8");
    return { ws, app };
  }

  it("installs only the target package from the workspace root, tolerating CI lockfiles", () => {
    const { ws, app } = wsFixture();
    const plan = planInstall("pnpm", app, { CI: "true" });
    assert.equal(plan.cwd, ws);
    assert.deepEqual(plan.args, ["install", "--filter", "@erp/inv...", "--no-frozen-lockfile"]);
    assert.equal(plan.scope, "workspace-filtered");
    assert.deepEqual(planInstall("pnpm", app, {}).args, ["install", "--filter", "@erp/inv..."]);
  });

  it("a lone app (no workspace above) keeps the plain install", async () => {
    const root = await mkProject();
    assert.equal(findWorkspaceRoot(root), null);
    const plan = planInstall("pnpm", root, {});
    assert.deepEqual(plan.args, ["install"]);
    assert.equal(plan.cwd, root);
    assert.deepEqual(planInstall("pnpm", root, { CI: "true" }).args, ["install", "--no-frozen-lockfile"]);
  });

  it("pnpm overrides land in the workspace root, not in the ignored package.json", () => {
    const { ws, app } = wsFixture();
    mergeNpmIntoProject(app, { dependencies: { vue: "3.5.35" }, pnpmOverrides: { vue: "3.5.35" } }, mergePackageJsonDeps);
    const pkg = JSON.parse(read(app, "package.json")) as { dependencies: Record<string, string>; pnpm?: unknown };
    assert.equal(pkg.dependencies.vue, "3.5.35");
    assert.equal(pkg.pnpm, undefined);
    assert.match(read(ws, "pnpm-workspace.yaml"), /overrides:\n {2}vue: "3\.5\.35"/);
    // idempotent
    assert.deepEqual(addWorkspaceOverrides(ws, { vue: "3.5.35" }), []);
  });

  it("new inside a workspace does not start the dev server by default", async () => {
    const { ws } = wsFixture();
    // skipInstall + no skipDev: it must return (not spawn dev) because a workspace is detected.
    await runNew("services/other", { cwd: ws, skipInstall: true });
    assert.ok(fs.existsSync(path.join(ws, "services", "other", "package.json")));
  });
});

describe("no cwd-bound paths in generated code (T-043)", () => {
  it("templates and packs resolve paths from the project root, not process.cwd()", () => {
    const hits: string[] = [];
    for (const base of ["templates", "features"]) {
      for (const f of walkFiles(path.join(getIrwinCliRoot(), base))) {
        if (!f.endsWith(".ts")) continue;
        // loadDotenv/path helpers use cwd only as the last-resort fallback when no package.json exists.
        if (/loadDotenv\.ts$|utils[\\/]path\.ts$/.test(f)) continue;
        if (/process\.cwd\(\)/.test(fs.readFileSync(f, "utf8"))) hits.push(path.relative(getIrwinCliRoot(), f));
      }
    }
    assert.deepEqual(hits, []);
  });

  it("locale-fallback and the auth i18n plugin use rootPath()", () => {
    const root = getIrwinCliRoot();
    assert.match(fs.readFileSync(path.join(root, "templates/base/configs/plugins/locale-fallback.ts"), "utf8"), /rootPath\(/);
    assert.match(fs.readFileSync(path.join(root, "features/auth/files/configs/plugins/i18n.ts"), "utf8"), /rootPath\(/);
  });
});

describe("doctor is accurate and read-only (T-044)", () => {
  it("finds packages hoisted into an ancestor node_modules", () => {
    const ws = tmp();
    const app = path.join(ws, "apps", "a");
    fs.mkdirSync(app, { recursive: true });
    fs.mkdirSync(path.join(ws, "node_modules", "ts-rails"), { recursive: true });
    fs.writeFileSync(path.join(ws, "node_modules", "ts-rails", "package.json"), '{"name":"ts-rails","version":"1.2.3"}');
    assert.equal(readInstalledVersion(app, "ts-rails"), "1.2.3");
    assert.equal(readInstalledVersion(app, "not-there-xyz"), null);
  });

  it("discovers @irwin plugins through symlinks and ancestor node_modules", () => {
    const ws = tmp();
    const app = path.join(ws, "apps", "a");
    fs.mkdirSync(app, { recursive: true });
    const real = path.join(ws, "store", "feature-x");
    fs.mkdirSync(real, { recursive: true });
    fs.writeFileSync(path.join(real, "manifest.json"), '{"id":"x","version":"1.0.0"}');
    fs.mkdirSync(path.join(ws, "node_modules", "@irwin"), { recursive: true });
    fs.symlinkSync(real, path.join(ws, "node_modules", "@irwin", "feature-x"), "junction");
    const found = npmFeatureRoots(app).map((s) => s.packageName);
    assert.deepEqual(found, ["@irwin/feature-x"]);
  });

  it("reports a pack block that was removed by hand", async () => {
    const root = await mkProject();
    add(root, "hash");
    assert.ok(checkPackBlocks(root, readRegistry(root)).every((c) => c.level === "ok"));
    const app = path.join(root, "configs/application.ts");
    fs.writeFileSync(app, fs.readFileSync(app, "utf8").replace("initializeHash();", ""), "utf8");
    const msgs = checkPackBlocks(root, readRegistry(root)).filter((c) => c.level === "warn");
    assert.ok(msgs.some((c) => /block \d+ missing in configs\/application\.ts/.test(c.message)));
  });

  it("`irwin doctor` without --fix writes nothing", async () => {
    const root = await mkProject({ withHome: true });
    fs.rmSync(path.join(root, "configs/irwin/featureCatalog.json"));
    const before = treeHash(root);
    spawnSync(process.execPath, [path.join(getIrwinCliRoot(), "dist", "cli.js"), "doctor"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, INIT_CWD: "" },
    });
    assert.deepEqual(treeHash(root), before);
  });
});

describe("registry v2: schema, atomic write, lock, backups (T-045)", () => {
  it("rejects malformed registries with a readable message and accepts legacy v1", async () => {
    assert.deepEqual(validateRegistry({ features: [] }), []);
    assert.match(validateRegistry({ features: [{ version: "1" }] }).join(), /features\[0\]\.id/);
    assert.match(validateRegistry({ features: {} }).join(), /features: expected an array/);
    assert.match(validateRegistry({ schemaVersion: 99, features: [] }).join(), /newer/);
    const root = await mkProject();
    fs.writeFileSync(path.join(root, ".irwin/features.json"), "{ not json");
    assert.throws(() => readRegistry(root), /not valid JSON/);
  });

  it("writes atomically and stamps schemaVersion 2 (no temp file left behind)", async () => {
    const root = await mkProject();
    const reg = readRegistry(root);
    delete reg.schemaVersion;
    writeRegistry(root, reg);
    assert.equal(readRegistry(root).schemaVersion, 2);
    assert.deepEqual(fs.readdirSync(path.join(root, ".irwin")).filter((f) => f.endsWith(".tmp")), []);
  });

  it("a second command while one runs fails with a lock error; the registry stays valid", async () => {
    const root = await mkProject();
    await withRegistryLock(root, async () => {
      await assert.rejects(runAddIn(root, "mailer"), /Another irwin command/);
    });
    // lock released: add now succeeds
    await runAddIn(root, "mailer");
    assert.ok(readRegistry(root).features.some((f) => f.id === "mailer"));
    assert.ok(!fs.existsSync(path.join(root, ".irwin/features.lock")));
  });

  it("recovers a stale lock left by a dead process", async () => {
    const root = await mkProject();
    fs.writeFileSync(path.join(root, ".irwin/features.lock"), JSON.stringify({ pid: 2 ** 22 + 12345, at: Date.now() }));
    await withRegistryLock(root, () => undefined);
    assert.ok(!fs.existsSync(path.join(root, ".irwin/features.lock")));
  });

  it("overwritten originals live in .irwin/backups, not in features.json, and remove restores them", async () => {
    const root = await mkProject();
    const stub = path.join(root, "typing-stubs/express/index.d.ts");
    fs.mkdirSync(path.dirname(stub), { recursive: true });
    fs.writeFileSync(stub, "// original stub\n");
    add(root, "hash");
    add(root, "session");
    const entry = readRegistry(root).features.find((f) => f.id === "session")!;
    const over = entry.artifacts!.overwrittenFiles!.find((o) => o.file === "typing-stubs/express/index.d.ts")!;
    assert.ok(over.backup && !over.originalBase64);
    assert.ok(fs.existsSync(path.join(root, over.backup)));
    assert.ok(!fs.readFileSync(path.join(root, ".irwin/features.json"), "utf8").includes("original stub"));
    assert.ok(entry.addedDeps?.dependencies?.includes("express-session"));
    process.chdir(root);
    runRemove("session");
    assert.equal(fs.readFileSync(stub, "utf8"), "// original stub\n");
    assert.ok(!fs.existsSync(path.join(root, ".irwin/backups/session")));
  });

  it("a legacy base64 original is still restored", async () => {
    const root = await mkProject();
    const stub = path.join(root, "typing-stubs/express/index.d.ts");
    fs.mkdirSync(path.dirname(stub), { recursive: true });
    fs.writeFileSync(stub, "// legacy original\n");
    add(root, "hash");
    add(root, "session");
    const reg = readRegistry(root);
    const over = reg.features.find((f) => f.id === "session")!.artifacts!.overwrittenFiles!.find(
      (o) => o.file === "typing-stubs/express/index.d.ts",
    )!;
    over.originalBase64 = Buffer.from("// legacy original\n").toString("base64");
    delete over.backup;
    delete over.originalSha256;
    writeRegistry(root, reg);
    process.chdir(root);
    runRemove("session");
    assert.equal(fs.readFileSync(stub, "utf8"), "// legacy original\n");
  });

  it("manifest validation accepts postInstall.generateSecrets and rejects a bad one", () => {
    const base = { id: "x", version: "1.0.0" };
    assert.deepEqual(validateManifest({ ...base, postInstall: { generateSecrets: ["A"] } }), []);
    assert.match(validateManifest({ ...base, postInstall: { generateSecrets: "A" } }).join(), /generateSecrets/);
  });
});

async function runAddIn(root: string, id: string): Promise<void> {
  process.chdir(root);
  await runAdd(id, { skipInstall: true });
}

describe("no insecure defaults in pack code (T-047)", () => {
  const root = getIrwinCliRoot();
  const files = ["templates", "features"].flatMap((b) => walkFiles(path.join(root, b)));
  const text = (f: string) => fs.readFileSync(f, "utf8");

  it("no default secret, shared password or seeded demo account anywhere in packs/templates", () => {
    const bad = /change-me|password123|dev-secret|admin@example\.com|"[^"\n]*-secret-[^"\n]*"/;
    const hits = files.filter((f) => !/\.(png|ico|svg|woff2?)$/.test(f) && bad.test(text(f))).map((f) => path.relative(root, f));
    assert.deepEqual(hits, []);
  });

  it("CORS never reflects any origin with credentials", () => {
    const hits = files.filter((f) => /origin:[^\n]*\|\|\s*true/.test(text(f)));
    assert.deepEqual(hits, []);
  });

  it("jwt helper reads its secret lazily with no fallback, and stores refresh tokens hashed", () => {
    const jwt = text(path.join(root, "features/auth-stack/files-shared/lib/utils/jwt.ts"));
    assert.ok(!/SESSION_SECRET/.test(jwt));
    assert.match(jwt, /function jwtSecret\(\)/);
    const login = text(path.join(root, "features/auth-api/files/app/services/auth/authLogin.service.ts"));
    assert.match(login, /password: hashToken\(refreshToken\)/);
    assert.ok(!/password: refreshToken/.test(login));
  });

  it("the ai pack requires auth-api (its route needs a Bearer token)", () => {
    assert.ok(loadManifest("ai").requires?.includes("auth-api"));
  });

  it("ensureGeneratedSecrets fills empty keys, never overwrites, and is idempotent", () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, ".env.example"), "A=\nB=keep\n");
    assert.deepEqual(ensureGeneratedSecrets(dir, ["A", "B", "C"]).sort(), ["A", "C"]);
    const env = read(dir, ".env");
    assert.match(env, /^A=[A-Za-z0-9_-]{40,}$/m);
    assert.match(env, /^B=keep$/m);
    assert.deepEqual(ensureGeneratedSecrets(dir, ["A", "B", "C"]), []);
  });

  it("`irwin new` gives the project its own SESSION_SECRET; add session/auth-api/database generate theirs", async () => {
    const root = await mkProject();
    assert.match(read(root, ".env"), /^SESSION_SECRET=\S{40,}$/m);
    for (const id of ["hash", "database", "api", "swagger", "auth-api"]) add(root, id);
    for (const id of ["database", "auth-api"]) {
      await runFeaturePostInstall(root, loadManifest(id, root), { skipInstall: true });
    }
    const env = read(root, ".env");
    assert.match(env, /^JWT_SECRET=\S{40,}$/m);
    assert.match(env, /^SEED_ADMIN_PASSWORD=\S{40,}$/m);
  });
});
