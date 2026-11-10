import fs from "fs";
import path from "path";

function isIrwinRoot(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, "app", "controllers")) &&
    fs.existsSync(path.join(dir, ".irwin", "features.json"))
  );
}

/** Walk up from `start` and return the first directory that is an Irwin app root. */
function findUp(start: string): string | null {
  let dir = start;
  for (;;) {
    if (isIrwinRoot(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Irwin app root: has app/controllers and .irwin/features.json.
 *
 * Lookup order (IRW-FIX-040): explicit `startDir` (`--cwd`) > `process.cwd()` > `INIT_CWD`
 * > `PNPM_SCRIPT_SRC_DIR` > `npm_config_local_prefix`. The package-manager variables are
 * only a fallback: in a monorepo `INIT_CWD` points at the directory where `pnpm` was
 * started, which is often a *different* app than the one the user is standing in.
 */
export function resolveIrwinRoot(startDir?: string): string {
  const ordered: Array<{ source: string; dir: string | undefined }> = [
    { source: "--cwd", dir: startDir },
    { source: "cwd", dir: process.cwd() },
    { source: "INIT_CWD", dir: process.env.INIT_CWD },
    { source: "PNPM_SCRIPT_SRC_DIR", dir: process.env.PNPM_SCRIPT_SRC_DIR },
    { source: "npm_config_local_prefix", dir: process.env.npm_config_local_prefix },
  ];

  const tried = new Set<string>();
  for (const { source, dir } of ordered) {
    if (!dir) continue;
    const abs = path.resolve(dir);
    if (tried.has(abs)) continue;
    tried.add(abs);
    const found = findUp(abs);
    if (found) {
      if (source !== "--cwd" && source !== "cwd") {
        console.warn(
          `[irwin] Using project root from ${source}: ${found} (not found from the current directory).`,
        );
      }
      return found;
    }
    // An explicit --cwd that is not an Irwin project must not silently fall back elsewhere.
    if (source === "--cwd") break;
  }

  throw new Error(
    "Not an Irwin project (expected app/controllers and .irwin/features.json). Run from your app directory or use `irwin new`.",
  );
}
