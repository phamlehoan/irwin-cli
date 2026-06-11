import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { getAuthStackContext, syncAuthStackFiles } from "./authStackSync";
import { writeRegistry } from "./registry";

const tmpDirs: string[] = [];

function mkProject(features: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-auth-stack-"));
  tmpDirs.push(dir);
  fs.mkdirSync(path.join(dir, ".irwin"), { recursive: true });
  writeRegistry(dir, {
    irwinCliVersion: "0.0.0",
    tsRails: "1.0.0",
    features: features.map((id) => ({
      id,
      version: "1.0.0",
      addedAt: new Date().toISOString(),
    })),
  });
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe("authStackSync", () => {
  it("syncs JWT currentUser when only auth-api is enabled", () => {
    const dir = mkProject(["auth-api"]);
    syncAuthStackFiles(dir, false);
    const src = fs.readFileSync(
      path.join(dir, "app/middlewares/currentUser.middleware.ts"),
      "utf8",
    );
    assert.match(src, /verifyToken/);
    assert.match(src, /req\.session/);
    assert.doesNotMatch(src, /getUserById\(userId, true\)/);
  });

  it("syncs rbac currentUser when admin-rbac is enabled", () => {
    const dir = mkProject(["auth-api", "auth", "admin-rbac"]);
    syncAuthStackFiles(dir, false);
    const src = fs.readFileSync(
      path.join(dir, "app/middlewares/currentUser.middleware.ts"),
      "utf8",
    );
    assert.match(src, /getUserById\(userId, true\)/);
    assert.match(src, /hasAdminAccess/);
  });

  it("merged validator includes web and API classes", () => {
    const dir = mkProject(["auth"]);
    syncAuthStackFiles(dir, false);
    const src = fs.readFileSync(
      path.join(dir, "app/validators/auth.validator.ts"),
      "utf8",
    );
    assert.match(src, /RegisterApiValidator/);
    assert.match(src, /RegisterUserValidator/);
    assert.match(src, /passwordConfirmation/);
  });

  it("syncs on first auth-api install before registry is updated", () => {
    const dir = mkProject([]);
    syncAuthStackFiles(dir, false, "auth-api");
    assert.ok(
      fs.existsSync(path.join(dir, "lib/utils/jwt.ts")),
      "jwt.ts should exist",
    );
  });

  it("getAuthStackContext reflects registry", () => {
    const dir = mkProject(["auth-api"]);
    const ctx = getAuthStackContext(dir);
    assert.equal(ctx.authApiEnabled, true);
    assert.equal(ctx.authEnabled, false);
  });

  it("syncs rbac currentUser when only admin-rbac-api is enabled", () => {
    const dir = mkProject(["auth-api", "admin-rbac-api"]);
    syncAuthStackFiles(dir, false);
    const src = fs.readFileSync(
      path.join(dir, "app/middlewares/currentUser.middleware.ts"),
      "utf8",
    );
    assert.match(src, /getUserById\(userId, true\)/);
    assert.match(src, /hasAdminAccess/);
  });
});
