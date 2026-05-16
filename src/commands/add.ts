import { applyFeature } from "../core/applyFeature";
import { loadManifest } from "../core/manifest";
import { resolveIrwinRoot } from "../core/projectRoot";
import { log } from "../utils/logger";

export type AddOptions = {
  dryRun?: boolean;
  force?: boolean;
};

export async function runAdd(
  featureId: string,
  options: AddOptions = {},
): Promise<void> {
  const projectRoot = resolveIrwinRoot();
  const manifest = loadManifest(featureId);

  log.info(
    options.dryRun
      ? `[dry-run] Adding feature "${featureId}"...`
      : `Adding feature "${featureId}"...`,
  );
  if (manifest.description) {
    log.info(`  ${manifest.description}`);
  }

  const result = applyFeature(projectRoot, manifest, options);

  if (options.dryRun) {
    log.info("[dry-run] No files written.");
    return;
  }

  if (manifest.postInstall?.messages?.length) {
    console.log("\nPost-install:");
    for (const msg of manifest.postInstall.messages) {
      console.log(`  • ${msg}`);
    }
  }

  if (result.copied.length === 0 && result.patchResults.every((p) => p.applied === 0)) {
    log.warn("Nothing changed.");
  } else {
    log.success(`Feature "${featureId}" enabled.`);
  }
}
