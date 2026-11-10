import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import ts from "typescript";
import { readManifestFileStrict, validateManifest } from "./manifest";

/** dist/core/featuresBundle.test.js -> package root */
const PKG_ROOT = path.resolve(__dirname, "..", "..");
const FEATURES = path.join(PKG_ROOT, "features");

/** Template directories used by authStackSync / rbacStackSync; they are not installable packs. */
const INTERNAL_DIRS = new Set(["auth-stack", "admin-rbac-stack"]);

const allDirs = fs
  .readdirSync(FEATURES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const packIds = allDirs.filter((d) => !INTERNAL_DIRS.has(d));

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe("bundled feature packs: manifests (T-030)", () => {
  it("there is at least one pack", () => {
    assert.ok(packIds.length > 0);
  });

  for (const id of packIds) {
    it(`${id}: manifest.json is valid JSON and structurally valid`, () => {
      const manifest = readManifestFileStrict(path.join(FEATURES, id, "manifest.json"));
      assert.equal(manifest.id, id, "manifest.id must equal the directory name");
      for (const dep of manifest.requires ?? []) {
        assert.ok(packIds.includes(dep), `requires unknown pack "${dep}"`);
      }
      const from = manifest.files?.from ?? "files";
      assert.ok(fs.existsSync(path.join(FEATURES, id, from)), `files dir "${from}" is missing`);
      for (const set of manifest.conditionalFiles ?? []) {
        assert.ok(fs.existsSync(path.join(FEATURES, id, set.from)), `conditional dir "${set.from}" is missing`);
      }
    });
  }

  it("validateManifest flags typos and bad ops (no silent half-installs)", () => {
    const problems = validateManifest({
      id: "x",
      version: "1.0.0",
      pacthes: [],
      patches: [{ file: "a.ts", ops: [{ type: "insertAfter", content: "x" }, { type: "replace", content: "y" }] }],
    });
    const joined = problems.join("\n");
    assert.match(joined, /unknown key "pacthes"/);
    assert.match(joined, /marker: required string/);
    assert.match(joined, /type: must be insertAfter/);
  });

  it("a manifest with a trailing comma is rejected with the file name", () => {
    const tmp = path.join(PKG_ROOT, "dist", "__bad_manifest.json");
    fs.writeFileSync(tmp, '{ "id": "x", "version": "1", }', "utf8");
    try {
      assert.throws(() => readManifestFileStrict(tmp), /Invalid manifest .*__bad_manifest\.json/);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
});

/** Codes that mean "this file is broken on its own", independent of the host project. */
const SELF_CONTAINED_SEMANTIC_CODES = new Set([
  2300, // Duplicate identifier
  2393, // Duplicate function implementation
  2451, // Cannot redeclare block-scoped variable
  2528, // A module cannot have multiple default exports
  2440, // Import declaration conflicts with local declaration
  2395, // Individual declarations in merged declaration must be all exported or all local
  2323, // Cannot redeclare exported variable
]);

describe("bundled feature packs: TypeScript sources parse and do not self-conflict (T-031)", () => {
  const tsFiles = walk(FEATURES).filter((f) => /\.tsx?$/.test(f));

  it("finds TypeScript files", () => {
    assert.ok(tsFiles.length > 20);
  });

  it("no syntax errors and no duplicate declarations", () => {
    const options: ts.CompilerOptions = {
      noResolve: true,
      noLib: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      allowJs: false,
      types: [],
    };
    const failures: string[] = [];
    for (const file of tsFiles) {
      // One program per file: non-module files share global scope and would report false duplicates.
      const program = ts.createProgram([file], options);
      const sf = program.getSourceFile(file);
      if (!sf) {
        failures.push(`${path.relative(PKG_ROOT, file)}: not loaded`);
        continue;
      }
      const diags = [
        ...program.getSyntacticDiagnostics(sf),
        ...program.getSemanticDiagnostics(sf).filter((d) => SELF_CONTAINED_SEMANTIC_CODES.has(d.code)),
      ];
      for (const d of diags) {
        const { line } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
        failures.push(
          `${path.relative(PKG_ROOT, sf.fileName)}:${line + 1} TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`,
        );
      }
    }
    assert.deepEqual(failures, []);
  });
});
