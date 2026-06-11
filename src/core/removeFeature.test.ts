import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadManifest } from "./manifest";
import { collectPatchBackups, revertFeatureArtifacts } from "./removeFeature";
import { applyPatches } from "./patchEngine";

describe("remove / manifest", () => {
  it("admin requires auth", () => {
    const admin = loadManifest("admin");
    assert.ok(admin.requires?.includes("auth"));
  });

  it("notifications requires database and auth", () => {
    const n = loadManifest("notifications");
    assert.ok(n.requires?.includes("database"));
    assert.ok(n.requires?.includes("auth"));
  });

  it("auth-oauth requires auth", () => {
    const m = loadManifest("auth-oauth");
    assert.ok(m.requires?.includes("auth"));
  });

  it("admin-rbac requires admin", () => {
    const m = loadManifest("admin-rbac");
    assert.ok(m.requires?.includes("admin"));
  });

  it("admin-rbac-api requires auth-api not admin", () => {
    const m = loadManifest("admin-rbac-api");
    assert.ok(m.requires?.includes("auth-api"));
    assert.ok(m.requires?.includes("database"));
    assert.ok(!m.requires?.includes("admin"));
  });
});

describe("revertFeatureArtifacts", () => {
  it("restores patched file and deletes copied file", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-remove-"));
    const target = path.join(root, "lib", "index.ts");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "// @irwin:lib-exports\n", "utf8");

    const patches = [
      {
        file: "lib/index.ts",
        ops: [
          {
            type: "insertAfter" as const,
            marker: "// @irwin:lib-exports",
            content: "\nexport const x = 1;\n",
          },
        ],
      },
    ];

    const backups = collectPatchBackups(root, patches);
    applyPatches(root, patches, false);

    const copied = path.join(root, "app", "demo.ts");
    fs.mkdirSync(path.dirname(copied), { recursive: true });
    fs.writeFileSync(copied, "export {};\n", "utf8");

    const result = revertFeatureArtifacts(
      root,
      { copiedFiles: ["app/demo.ts"], patchBackups: backups },
      false,
    );

    assert.equal(fs.readFileSync(target, "utf8"), "// @irwin:lib-exports\n");
    assert.ok(!fs.existsSync(copied));
    assert.equal(result.deletedFiles.length, 1);
    assert.equal(result.restoredFiles.length, 1);

    fs.rmSync(root, { recursive: true, force: true });
  });
});
