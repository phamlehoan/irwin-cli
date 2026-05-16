import fs from "fs";
import path from "path";

/** Irwin app root: has app/controllers and .irwin/features.json */
export function resolveIrwinRoot(startDir?: string): string {
  const candidates = new Set<string>();
  const tryAdd = (p: string | undefined) => {
    if (!p) return;
    try {
      candidates.add(path.resolve(p));
    } catch {
      /* ignore */
    }
  };
  tryAdd(startDir);
  tryAdd(process.env.INIT_CWD);
  tryAdd(process.env.PNPM_SCRIPT_SRC_DIR);
  tryAdd(process.env.npm_config_local_prefix);
  tryAdd(process.cwd());

  for (const start of candidates) {
    let dir = start;
    for (;;) {
      const hasControllers = fs.existsSync(
        path.join(dir, "app", "controllers"),
      );
      const hasRegistry = fs.existsSync(
        path.join(dir, ".irwin", "features.json"),
      );
      if (hasControllers && hasRegistry) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  throw new Error(
    "Not an Irwin project (expected app/controllers and .irwin/features.json). Run from your app directory or use `irwin new`.",
  );
}
