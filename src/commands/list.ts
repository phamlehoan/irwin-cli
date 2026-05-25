import { listFeatureIds, loadManifest } from "../core/manifest";
import { resolveFeatureSource } from "../core/featureSource";
import { resolveIrwinRoot } from "../core/projectRoot";
import { isFeatureEnabled, readRegistry } from "../core/registry";

export function runList(): void {
  let projectRoot: string | undefined;
  let enabled = new Set<string>();

  try {
    projectRoot = resolveIrwinRoot();
    const registry = readRegistry(projectRoot);
    enabled = new Set(registry.features.map((f) => f.id));
    console.log(`\nProject: ${projectRoot}`);
    console.log(`ts-rails: ${registry.tsRails}\n`);
  } catch {
    console.log("\n(No Irwin project in cwd — showing available features only)\n");
  }

  const ids = listFeatureIds(projectRoot);

  console.log("Feature packs:\n");
  for (const id of ids) {
    const manifest = loadManifest(id, projectRoot);
    const mark = enabled.has(id) ? "[x]" : "[ ]";
    const req =
      manifest.requires && manifest.requires.length > 0
        ? ` (requires: ${manifest.requires.join(", ")})`
        : "";
    let sourceTag = "";
    if (projectRoot) {
      try {
        const src = resolveFeatureSource(id, projectRoot);
        if (src.kind === "npm") sourceTag = " [npm]";
      } catch {
        /* bundled only when no project */
      }
    }
    console.log(`  ${mark} ${id}${sourceTag}${req}`);
    if (manifest.description) {
      console.log(`      ${manifest.description}`);
    }
  }
  console.log("");
}
