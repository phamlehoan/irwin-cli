import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { mergePackageJsonDeps } from "./template";

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("mergePackageJsonDeps", () => {
  it("merges database scripts into package.json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-pkg-"));
    tmpDirs.push(dir);
    const pkgPath = path.join(dir, "package.json");
    fs.writeFileSync(
      pkgPath,
      JSON.stringify(
        {
          name: "demo",
          scripts: {
            dev: "tsx index.ts",
            g: "irwin g",
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );

    mergePackageJsonDeps(
      pkgPath,
      { prisma: "^7.7.0" },
      undefined,
      {
        "db:generate": "prisma generate",
        "db:push": "prisma db push",
      },
    );

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    assert.equal(pkg.scripts["db:generate"], "prisma generate");
    assert.equal(pkg.scripts["db:push"], "prisma db push");
    assert.equal(pkg.scripts.g, "irwin g");
    assert.equal(pkg.dependencies.prisma, "^7.7.0");
  });
});
