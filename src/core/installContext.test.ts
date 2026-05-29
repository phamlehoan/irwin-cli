import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  getJobsInstallContext,
  matchesWhen,
  resolveFeatureManifest,
} from "./installContext";
import type { FeatureManifest } from "./manifest";
import { writeRegistry } from "./registry";

const tmpDirs: string[] = [];

function mkProject(files: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-ctx-"));
  tmpDirs.push(dir);
  fs.mkdirSync(path.join(dir, "app", "controllers"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".irwin"), { recursive: true });
  writeRegistry(dir, {
    irwinCliVersion: "0.0.0",
    tsRails: "1.0.0",
    features: [],
  });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf8");
  }
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe("getJobsInstallContext", () => {
  it("detects jobs from registry", () => {
    const root = mkProject();
    writeRegistry(root, {
      irwinCliVersion: "0.0.0",
      tsRails: "1.0.0",
      features: [{ id: "jobs", version: "1.0.0", addedAt: "" }],
    });
    const ctx = getJobsInstallContext(root);
    assert.equal(ctx.jobsEnabled, true);
    assert.equal(ctx.jobsQueueMode, "database");
  });

  it("detects redis mode from .env", () => {
    const root = mkProject({
      ".env": "JOBS_USE_REDIS=true\n",
      "configs/application.ts": "initializeJobs();\n",
    });
    const ctx = getJobsInstallContext(root);
    assert.equal(ctx.jobsEnabled, true);
    assert.equal(ctx.jobsUseRedis, true);
    assert.equal(ctx.jobsQueueMode, "redis");
  });
});

describe("resolveFeatureManifest", () => {
  it("filters patches by when", () => {
    const root = mkProject();
    const manifest: FeatureManifest = {
      id: "test",
      version: "1.0.0",
      patches: [
        { file: "a.ts", ops: [{ type: "append", content: "a" }] },
        {
          file: "b.ts",
          when: { jobsEnabled: true },
          ops: [{ type: "append", content: "b" }],
        },
      ],
    };
    const resolved = resolveFeatureManifest(manifest, root);
    assert.equal(resolved.patches?.length, 1);
    assert.equal(resolved.patches?.[0]?.file, "a.ts");
  });
});

describe("matchesWhen", () => {
  it("jobsUseDatabase requires jobs without redis", () => {
    const ctx = {
      jobsEnabled: true,
      jobsUseRedis: false,
      jobsQueueMode: "database" as const,
    };
    assert.equal(matchesWhen({ jobsUseDatabase: true }, ctx), true);
    assert.equal(matchesWhen({ jobsUseRedis: true }, ctx), false);
  });
});
