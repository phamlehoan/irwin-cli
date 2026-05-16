import { listFeatureIds, loadManifest } from "../core/manifest";
import { resolveIrwinRoot } from "../core/projectRoot";
import { isFeatureEnabled, readRegistry } from "../core/registry";

export function runList(): void {
  const ids = listFeatureIds();
  let enabled = new Set<string>();

  try {
    const root = resolveIrwinRoot();
    const registry = readRegistry(root);
    enabled = new Set(registry.features.map((f) => f.id));
    console.log(`\nProject: ${root}`);
    console.log(`ts-rails: ${registry.tsRails}\n`);
  } catch {
    console.log("\n(No Irwin project in cwd — showing available features only)\n");
  }

  console.log("Feature packs:\n");
  for (const id of ids) {
    const manifest = loadManifest(id);
    const mark = enabled.has(id) ? "[x]" : "[ ]";
    const req =
      manifest.requires && manifest.requires.length > 0
        ? ` (requires: ${manifest.requires.join(", ")})`
        : "";
    console.log(`  ${mark} ${id}${req}`);
    if (manifest.description) {
      console.log(`      ${manifest.description}`);
    }
  }
  console.log("");
}
