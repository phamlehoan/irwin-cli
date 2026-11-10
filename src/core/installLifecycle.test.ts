import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { runNew } from "../commands/new";
import { runRemove } from "../commands/remove";
import { applyFeature } from "./applyFeature";
import { loadManifest } from "./manifest";
import { PatchPreflightError } from "./patchEngine";
import { runFeaturePostInstall } from "./postInstall";
import { readRegistry } from "./registry";
import { revertFeatureArtifacts } from "./removeFeature";
import { restoreSnapshot, takeSnapshot } from "./snapshot";

const dirs: string[] = [];
const cwd0 = process.cwd();

async function mkProject(): Promise<string> {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-life-"));
  dirs.push(parent);
  await runNew("demo", { cwd: parent, skipInstall: true, skipDev: true });
  return path.join(parent, "demo");
}

function add(root: string, id: string, force = false) {
  return applyFeature(root, loadManifest(id, root), { force });
}

function read(root: string, rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function listTree(dir: string, rel = "", out: Record<string, string> = {}): Record<string, string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) listTree(p, r, out);
    else out[r] = fs.readFileSync(p, "utf8");
  }
  return out;
}

afterEach(() => {
  process.chdir(cwd0);
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});

describe("patches are idempotent (T-034)", () => {
  it("adding a pack twice with --force does not duplicate inserted content", async () => {
    const root = await mkProject();
    add(root, "database");
    add(root, "hash");
    add(root, "session");
    add(root, "auth");
    add(root, "jobs");
    const volatile = (t: Record<string, string>) => {
      const { ".irwin/features.json": _a, "configs/irwin/featureCatalog.json": _b, ...rest } = t;
      void _a;
      void _b;
      return rest;
    };
    const once = volatile(listTree(root));
    const again = add(root, "jobs", true);
    assert.ok(again.patchResults.every((p) => p.applied === 0), "second run must insert nothing");
    assert.deepEqual(volatile(listTree(root)), once);
  });
});

describe("failed installs roll back completely (T-035)", () => {
  it("a missing marker aborts before any write and leaves tree + registry untouched", async () => {
    const root = await mkProject();
    add(root, "database");
    add(root, "hash");
    add(root, "session");
    add(root, "auth");

    // Rename the method the `jobs` pack anchors on (the user refactored configs/application.ts).
    const app = read(root, "configs/application.ts");
    assert.match(app, /protected setupViewEngine\(\) \{/);
    fs.writeFileSync(
      path.join(root, "configs/application.ts"),
      app.replace("protected setupViewEngine() {", "protected setupViews() {"),
      "utf8",
    );

    const before = listTree(root);
    const regBefore = JSON.stringify(readRegistry(root));

    assert.throws(
      () => add(root, "jobs"),
      (e: unknown) => e instanceof PatchPreflightError || /marker/i.test(String((e as Error).message)),
    );

    assert.deepEqual(listTree(root), before, "project tree must be exactly as before");
    assert.equal(JSON.stringify(readRegistry(root)), regBefore, "registry must not change");
  });

  it("restoreSnapshot undoes edits, deletions and new files", async () => {
    const root = await mkProject();
    const snap = takeSnapshot(root);
    const before = listTree(root);
    fs.writeFileSync(path.join(root, "package.json"), "{}", "utf8");
    fs.writeFileSync(path.join(root, "new-file.txt"), "x", "utf8");
    fs.mkdirSync(path.join(root, "brand", "new", "dir"), { recursive: true });
    fs.writeFileSync(path.join(root, "brand", "new", "dir", "a.ts"), "x", "utf8");
    fs.rmSync(path.join(root, "app", "controllers", "home.controller.ts"));
    restoreSnapshot(snap);
    assert.deepEqual(listTree(root), before);
    assert.ok(!fs.existsSync(path.join(root, "brand")), "directories created by the failed run are pruned");
  });
});

describe("remove only touches what the pack owns (T-036)", () => {
  it("restores overwritten originals, deletes created files, keeps files you edited", async () => {
    const root = await mkProject();
    const initial = listTree(root);
    add(root, "database");
    add(root, "hash");
    add(root, "session");
    add(root, "auth");
    add(root, "admin");
    process.chdir(root);

    const entry = readRegistry(root).features.find((f) => f.id === "admin")!;
    const created = entry.artifacts!.createdFiles!;
    assert.ok(created.length > 0, "v2 artifacts record created files");
    const edited = created.find((f) => f.endsWith(".pug"))!;
    fs.appendFileSync(path.join(root, edited), "\n// my own change\n", "utf8");

    runRemove("admin");

    assert.ok(fs.existsSync(path.join(root, edited)), "user-edited file must be kept");
    for (const f of created.filter((f) => f !== edited)) {
      assert.ok(!fs.existsSync(path.join(root, f)), `${f} should be deleted`);
    }
    assert.ok(!readRegistry(root).features.some((f) => f.id === "admin"));
    void initial;
  });

  it("removing a pack takes out exactly its inserted blocks and keeps later user edits", async () => {
    const root = await mkProject();
    add(root, "database");
    add(root, "hash");
    add(root, "session");
    add(root, "auth");
    add(root, "jobs");
    process.chdir(root);

    const file = "lib/index.ts";
    fs.appendFileSync(path.join(root, file), "\nexport const userAddedLater = 1;\n", "utf8");
    runRemove("jobs");
    assert.match(read(root, file), /userAddedLater/, "edits made after install survive remove");
    assert.doesNotMatch(read(root, file), /\.\/jobs/, "the pack's export line is gone");
  });

  it("does not delete a file that another enabled pack also owns", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-shared-"));
    dirs.push(root);
    const rel = "lib/shared.ts";
    fs.mkdirSync(path.join(root, "lib"), { recursive: true });
    fs.writeFileSync(path.join(root, rel), "export {};\n", "utf8");
    const artifacts = { copiedFiles: [rel], patchBackups: [], createdFiles: [rel], overwrittenFiles: [], patchedFiles: [] };
    const res = revertFeatureArtifacts(root, artifacts, false, {
      others: [{ id: "other", version: "1", addedAt: "", artifacts: { ...artifacts } }],
    });
    assert.ok(fs.existsSync(path.join(root, rel)));
    assert.equal(res.keptFiles[0]?.file, rel);
  });
});

describe("--skip-install skips post-install scripts (T-037)", () => {
  async function projectWithScript(): Promise<string> {
    const root = await mkProject();
    fs.writeFileSync(path.join(root, "mark.js"), "require('fs').writeFileSync('ran.txt','1')\n", "utf8");
    const pkgPath = path.join(root, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    pkg.scripts = { ...(pkg.scripts ?? {}), mark: "node mark.js" };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
    const regPath = path.join(root, ".irwin", "features.json");
    const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
    reg.packageManager = "npm";
    fs.writeFileSync(regPath, JSON.stringify(reg, null, 2), "utf8");
    return root;
  }
  const manifest = { id: "x", version: "1.0.0", postInstall: { scripts: ["mark"] } };

  it("skipInstall=true: script is NOT run", async () => {
    const root = await projectWithScript();
    await runFeaturePostInstall(root, manifest, { skipInstall: true });
    assert.ok(!fs.existsSync(path.join(root, "ran.txt")));
  });

  it("skipInstall=false: script runs", async () => {
    const root = await projectWithScript();
    await runFeaturePostInstall(root, manifest, { skipInstall: false });
    assert.ok(fs.existsSync(path.join(root, "ran.txt")));
  });
});
