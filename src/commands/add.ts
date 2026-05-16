import { applyFeature } from "../core/applyFeature";
import { loadManifest } from "../core/manifest";
import { runFeaturePostInstall } from "../core/postInstall";
import { resolveIrwinRoot } from "../core/projectRoot";
import { log } from "../utils/logger";

export type AddOptions = {
  dryRun?: boolean;
  force?: boolean;
  skipInstall?: boolean;
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

  const hadChanges =
    result.copied.length > 0 ||
    result.patchResults.some((p) => p.applied > 0);

  if (hadChanges) {
    await runFeaturePostInstall(projectRoot, manifest, {
      skipInstall: options.skipInstall,
    });
  }

  if (manifest.postInstall?.messages?.length) {
    console.log("\nNext steps:");
    for (const msg of manifest.postInstall.messages) {
      console.log(`  • ${msg}`);
    }
  }

  if (!hadChanges) {
    log.warn("Nothing changed.");
  } else {
    log.success(`Feature "${featureId}" enabled.`);
  }
}
