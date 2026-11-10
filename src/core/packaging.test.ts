import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { runNew } from "../commands/new";

const PKG_ROOT = path.resolve(__dirname, "..", "..");

describe("packaging (IRW-FIX-046)", () => {
  it("npm pack contains the template gitignore (stored as _gitignore)", () => {
    const out = execSync("npm pack --dry-run --json --ignore-scripts", {
      cwd: PKG_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const files = (JSON.parse(out)[0].files as Array<{ path: string }>).map((f) => f.path);
    assert.ok(files.includes("templates/base/_gitignore"), "templates/base/_gitignore must be published");
    assert.ok(files.includes("dist/cli.js"), "dist/cli.js must be published");
    assert.ok(files.some((f) => f.startsWith("features/auth/")), "feature packs must be published");
    assert.ok(!files.some((f) => /\.test\.js(\.map)?$/.test(f)), "compiled tests must not be published");
  });

  it("irwin new writes a real .gitignore that ignores .env and node_modules", async () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-gi-"));
    try {
      await runNew("demo", { cwd: parent, skipInstall: true, skipDev: true });
      const gi = fs.readFileSync(path.join(parent, "demo", ".gitignore"), "utf8");
      assert.match(gi, /node_modules/);
      assert.match(gi, /\.env/);
      assert.ok(!fs.existsSync(path.join(parent, "demo", "_gitignore")));
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });
});
