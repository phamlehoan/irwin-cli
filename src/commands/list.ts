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
  const broken: Array<{ id: string; error: string }> = [];
  for (const id of ids) {
    let manifest;
    try {
      manifest = loadManifest(id, projectRoot);
    } catch (e) {
      // IRW-FIX-030: one broken pack must not take `irwin list` down.
      broken.push({ id, error: e instanceof Error ? e.message : String(e) });
      console.log(`  [!] ${id}  (invalid manifest — see below)`);
      continue;
    }
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
  if (broken.length > 0) {
    console.error(`${broken.length} feature pack(s) have an invalid manifest:`);
    for (const b of broken) console.error(`\n[${b.id}] ${b.error}`);
    console.error("");
    process.exitCode = 1;
  }
}
