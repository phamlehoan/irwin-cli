import fs from "fs";
import path from "path";
import type { IrwinRegistry } from "./registry";

export type CheckLevel = "ok" | "warn" | "fail";
export type Check = { level: CheckLevel; message: string };

/**
 * Locate `<name>/package.json` the way Node would: `require.resolve` from the project first, then every
 * ancestor `node_modules` (IRW-FIX-044). A hoisted pnpm/npm workspace keeps dependencies in the workspace
 * root, so looking only in `<project>/node_modules` reported healthy projects as broken.
 */
export function resolveInstalledPackageJson(projectRoot: string, name: string): string | null {
  try {
    return require.resolve(`${name}/package.json`, { paths: [projectRoot] });
  } catch {
    /* package may not export ./package.json: fall through to a directory walk */
  }
  let dir = path.resolve(projectRoot);
  for (;;) {
    const candidate = path.join(dir, "node_modules", name, "package.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function readInstalledVersion(projectRoot: string, name: string): string | null {
  const file = resolveInstalledPackageJson(projectRoot, name);
  if (!file) return null;
  try {
    return (JSON.parse(fs.readFileSync(file, "utf8")) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

function toLf(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

/**
 * Verify, for every enabled pack, that what the registry says it installed is still there:
 * created files exist, and every block it inserted into a shared file is still present.
 * Read-only. Packs installed by irwin-cli <= 0.0.4 have no artifacts and are reported once as unverifiable.
 */
export function checkPackBlocks(projectRoot: string, registry: IrwinRegistry): Check[] {
  const out: Check[] = [];
  for (const feat of registry.features) {
    const a = feat.artifacts;
    if (!a || !a.createdFiles) {
      out.push({ level: "warn", message: `Pack "${feat.id}": installed by an older irwin-cli, blocks cannot be verified` });
      continue;
    }
    let problems = 0;
    for (const rel of a.createdFiles) {
      if (!fs.existsSync(path.join(projectRoot, rel))) {
        out.push({ level: "warn", message: `Pack "${feat.id}": file missing: ${rel}` });
        problems++;
      }
    }
    for (const pf of a.patchedFiles ?? []) {
      // package.json is re-serialized on merge: its blocks are not text-searchable.
      if (pf.file === "package.json") continue;
      const abs = path.join(projectRoot, pf.file);
      if (!fs.existsSync(abs)) {
        out.push({ level: "warn", message: `Pack "${feat.id}": patched file missing: ${pf.file}` });
        problems++;
        continue;
      }
      const text = toLf(fs.readFileSync(abs, "utf8"));
      pf.inserted.forEach((ins, i) => {
        if (!text.includes(toLf(ins.text))) {
          out.push({ level: "warn", message: `Pack "${feat.id}": block ${i + 1} missing in ${pf.file} (edited or removed by hand)` });
          problems++;
        }
      });
    }
    if (problems === 0) out.push({ level: "ok", message: `Pack "${feat.id}": all blocks present` });
  }
  return out;
}
