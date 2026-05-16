import { readRegistry } from "../core/registry";
import { resolveIrwinRoot } from "../core/projectRoot";
import { spawnTsRails } from "../core/spawnTsRails";
import { log } from "../utils/logger";

export async function runGenerate(
  type: string,
  name: string,
  fields: string[],
  apiOnly?: boolean,
): Promise<void> {
  const projectRoot = resolveIrwinRoot();

  try {
    const registry = readRegistry(projectRoot);
    const min = "1.0.11";
    if (registry.tsRails && registry.tsRails < min) {
      log.warn(
        `ts-rails ${registry.tsRails} may be incompatible (recommended >= ${min}).`,
      );
    }
  } catch {
    /* registry optional for g */
  }

  const args = ["g", type, name, ...fields];
  if (apiOnly) args.push("--api");

  const code = await spawnTsRails(projectRoot, args);
  process.exit(code);
}
