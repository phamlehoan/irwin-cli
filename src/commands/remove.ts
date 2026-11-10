import fs from "fs";
import path from "path";
import { loadManifest } from "../core/manifest";
import { resolveIrwinRoot } from "../core/projectRoot";
import { revertFeatureArtifacts } from "../core/removeFeature";
import {
  isFeatureEnabled,
  readRegistry,
  withRegistryLockSync,
  writeRegistry,
  type FeatureEntry,
} from "../core/registry";
import { log } from "../utils/logger";
import { restoreSnapshot, takeSnapshot } from "../core/snapshot";
import { syncHomeFeaturesIfEnabled } from "../core/syncHomeFeatures";

export type RemoveOptions = {
  dryRun?: boolean;
  force?: boolean;
  /** Registry only — do not delete copied files or revert patches. */
  keepFiles?: boolean;
};

function findDependents(
  featureId: string,
  projectRoot: string,
  enabledIds: Set<string>,
): string[] {
  const dependents: string[] = [];
  for (const id of enabledIds) {
    if (id === featureId) continue;
    try {
      const manifest = loadManifest(id, projectRoot);
      if (manifest.requires?.includes(featureId)) {
        dependents.push(id);
      }
    } catch {
      /* ignore unknown */
    }
  }
  return dependents;
}

function findEntry(
  registry: ReturnType<typeof readRegistry>,
  featureId: string,
): FeatureEntry | undefined {
  return registry.features.find((f) => f.id === featureId);
}

export function runRemove(
  featureId: string,
  options: RemoveOptions = {},
): void {
  const projectRoot = resolveIrwinRoot();
  if (options.dryRun) return removeLocked(projectRoot, featureId, options);
  withRegistryLockSync(projectRoot, () => removeLocked(projectRoot, featureId, options));
}

function removeLocked(projectRoot: string, featureId: string, options: RemoveOptions): void {
  const registry = readRegistry(projectRoot);

  if (!isFeatureEnabled(registry, featureId)) {
    log.warn(`Feature "${featureId}" is not enabled.`);
    return;
  }

  loadManifest(featureId, projectRoot);
  const entry = findEntry(registry, featureId);
  const others = registry.features.filter((f) => f.id !== featureId);

  const enabledIds = new Set(registry.features.map((f) => f.id));
  const dependents = findDependents(featureId, projectRoot, enabledIds);

  if (dependents.length > 0 && !options.force) {
    throw new Error(
      `Cannot remove "${featureId}": required by ${dependents.join(", ")}. ` +
        `Remove those first, or use --force (registry only).`,
    );
  }

  if (dependents.length > 0 && options.force) {
    log.warn(
      `Removing "${featureId}"; still required by: ${dependents.join(", ")}`,
    );
  }

  if (options.dryRun) {
    log.info(`[dry-run] Would remove "${featureId}" from .irwin/features.json`);
    if (!options.keepFiles) {
      revertFeatureArtifacts(projectRoot, entry?.artifacts, true, { others });
    } else {
      log.info("  (--keep-files) Copied files and patches would be left as-is.");
    }
    return;
  }

  if (!options.keepFiles) {
    if (!entry?.artifacts) {
      log.warn(
        `No install artifacts for "${featureId}" (added before irwin-cli tracked files). ` +
          "Remove copied files and patch edits manually, or use --keep-files.",
      );
    } else {
      const snap = takeSnapshot(projectRoot);
      try {
        const res = revertFeatureArtifacts(projectRoot, entry.artifacts, false, { others });
        if (res.unreversedBlocks.length > 0 || res.keptFiles.length > 0) {
          console.log(
            "\nSome files were left in place on purpose (see warnings above). Review them before committing.",
          );
        }
      } catch (e) {
        restoreSnapshot(snap);
        throw e;
      }
    }
  }

  registry.features = registry.features.filter((f) => f.id !== featureId);
  writeRegistry(projectRoot, registry);
  if (!options.keepFiles) {
    // Backups of overwritten originals have served their purpose once the pack is reverted.
    fs.rmSync(path.join(projectRoot, ".irwin", "backups", featureId), { recursive: true, force: true });
    try {
      fs.rmdirSync(path.join(projectRoot, ".irwin", "backups"));
    } catch {
      /* other packs still have backups */
    }
  }
  syncHomeFeaturesIfEnabled(projectRoot);

  log.success(`Removed "${featureId}" from registry.`);
  if (options.keepFiles) {
    console.log("\nNote: --keep-files — project files and patches were not reverted.");
  } else if (!entry?.artifacts) {
    console.log("\nNote: prune npm deps in package.json manually if needed.");
  } else {
    console.log("\nNote: optional — prune unused npm deps in package.json");
  }
}
