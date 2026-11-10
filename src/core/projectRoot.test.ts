import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { resolveIrwinRoot } from "./projectRoot";

const tmp: string[] = [];

function mkApp(root: string, name: string): string {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, "app", "controllers"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".irwin"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".irwin", "features.json"), "{}", "utf8");
  return fs.realpathSync(dir);
}

function withEnv<T>(vars: Record<string, string | undefined>, cwd: string, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  const prevCwd = process.cwd();
  process.chdir(cwd);
  try {
    return fn();
  } finally {
    process.chdir(prevCwd);
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

afterEach(() => {
  for (const d of tmp) fs.rmSync(d, { recursive: true, force: true });
  tmp.length = 0;
});

describe("resolveIrwinRoot (IRW-FIX-040)", () => {
  it("prefers cwd over INIT_CWD (monorepo: standing in svc-a, pnpm started in svc-b)", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-root-"));
    tmp.push(root);
    const a = mkApp(root, "svc-a");
    const b = mkApp(root, "svc-b");
    const got = withEnv({ INIT_CWD: b }, a, () => resolveIrwinRoot());
    assert.equal(fs.realpathSync(got), a);
  });

  it("explicit startDir (--cwd) beats cwd", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-root-"));
    tmp.push(root);
    const a = mkApp(root, "svc-a");
    const b = mkApp(root, "svc-b");
    const got = withEnv({ INIT_CWD: undefined }, a, () => resolveIrwinRoot(b));
    assert.equal(fs.realpathSync(got), b);
  });

  it("falls back to INIT_CWD only when cwd is not inside an Irwin app", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-root-"));
    tmp.push(root);
    const b = mkApp(root, "svc-b");
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-outside-"));
    tmp.push(outside);
    const got = withEnv({ INIT_CWD: b }, outside, () => resolveIrwinRoot());
    assert.equal(fs.realpathSync(got), b);
  });

  it("an invalid explicit startDir does not silently fall back", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-root-"));
    tmp.push(root);
    const a = mkApp(root, "svc-a");
    const nowhere = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-nowhere-"));
    tmp.push(nowhere);
    assert.throws(() => withEnv({ INIT_CWD: undefined }, a, () => resolveIrwinRoot(nowhere)), /Not an Irwin project/);
  });
});
