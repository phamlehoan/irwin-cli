import { readRegistry } from "../core/registry";
import { semverGte } from "../core/semver";
import { resolveIrwinRoot } from "../core/projectRoot";
import { spawnTsRails } from "../core/spawnTsRails";
import { log } from "../utils/logger";

export type GenerateOptions = {
  api?: boolean;
  force?: boolean;
  skip?: boolean;
  dryRun?: boolean;
};

/** Flags forwarded to the local `ts-rails` generator (IRW-FIX-021 / IRW-FIX-024). */
export function buildGenerateArgs(
  type: string,
  name: string,
  fields: string[],
  options: GenerateOptions = {},
): string[] {
  const args = ["g", type, name, ...fields];
  if (options.api) args.push("--api");
  if (options.force) args.push("--force");
  if (options.skip) args.push("--skip");
  if (options.dryRun) args.push("--dry-run");
  return args;
}

export async function runGenerate(
  type: string,
  name: string,
  fields: string[],
  options: GenerateOptions | boolean = {},
): Promise<void> {
  const opts: GenerateOptions = typeof options === "boolean" ? { api: options } : options;
  const projectRoot = resolveIrwinRoot();

  try {
    const registry = readRegistry(projectRoot);
    const min = "1.0.11";
    if (registry.tsRails && !semverGte(registry.tsRails, min)) {
      log.warn(
        `ts-rails ${registry.tsRails} may be incompatible (recommended >= ${min}).`,
      );
    }
  } catch {
    /* registry optional for g */
  }

  const code = await spawnTsRails(projectRoot, buildGenerateArgs(type, name, fields, opts));
  process.exit(code);
}
