import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { getRbacStackContext, syncRbacStackFiles } from "./rbacStackSync";
import { writeRegistry } from "./registry";

const tmpDirs: string[] = [];

function mkProject(features: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-rbac-stack-"));
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

describe("rbacStackSync", () => {
  it("syncs shared RBAC files when admin-rbac-api is enabled", () => {
    const dir = mkProject(["admin-rbac-api"]);
    syncRbacStackFiles(dir, false);
    assert.ok(
      fs.existsSync(path.join(dir, "lib/utils/userPermissions.ts")),
      "userPermissions.ts",
    );
    assert.ok(
      fs.existsSync(path.join(dir, "app/middlewares/validatePermission.middleware.ts")),
      "validatePermission.middleware.ts",
    );
    assert.ok(
      fs.existsSync(path.join(dir, "app/validators/admin.validator.ts")),
      "admin.validator.ts",
    );
  });

  it("syncs on first admin-rbac-api install before registry is updated", () => {
    const dir = mkProject([]);
    syncRbacStackFiles(dir, false, "admin-rbac-api");
    assert.ok(fs.existsSync(path.join(dir, "configs/db/seed-rbac.ts")));
  });

  it("getRbacStackContext reflects registry", () => {
    const dir = mkProject(["admin-rbac-api"]);
    const ctx = getRbacStackContext(dir);
    assert.equal(ctx.adminRbacApiEnabled, true);
    assert.equal(ctx.adminRbacEnabled, false);
  });
});
