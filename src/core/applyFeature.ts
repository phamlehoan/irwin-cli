import fs from "fs";
import path from "path";
import { log } from "../utils/logger";
import type { FeatureManifest } from "./manifest";
import { featureFilesDir, resolveFeatureSource } from "./featureSource";
import { applyPatches } from "./patchEngine";
import {
  getJobsInstallContext,
  matchesWhen,
  resolveFeatureManifest,
} from "./installContext";
import {
  isFeatureEnabled,
  readRegistry,
  writeRegistry,
  type FeatureEntry,
} from "./registry";
import { copyLocalesFromEnabledFeatures } from "./localeSync";
import { collectPatchBackups } from "./removeFeature";
import { mergePackageJsonDeps } from "./template";
import { syncAuthStackFiles } from "./authStackSync";
import { syncHomeFeatures } from "./syncHomeFeatures";

export type ApplyFeatureOptions = {
  dryRun?: boolean;
  force?: boolean;
};

export type ApplyFeatureResult = {
  copied: string[];
  patchResults: ReturnType<typeof applyPatches>;
};

export function validateFeatureRequirements(
  manifest: FeatureManifest,
  projectRoot: string,
): void {
  const registry = readRegistry(projectRoot);
  for (const req of manifest.requires ?? []) {
    if (!isFeatureEnabled(registry, req)) {
      throw new Error(
        `Feature "${manifest.id}" requires "${req}". Run: irwin add ${req}`,
      );
    }
  }
}

function copyFeatureFiles(
  filesSrc: string,
  projectRoot: string,
  dryRun: boolean,
  force: boolean,
  overwrite: string[] = [],
): string[] {
  const copied: string[] = [];
  const overwriteSet = new Set(overwrite.map((p) => p.replace(/\\/g, "/")));

  const walk = (dir: string, base: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const srcPath = path.join(dir, entry.name);
      const rel = path.join(base, entry.name).replace(/\\/g, "/");
      const destPath = path.join(projectRoot, rel);
      if (entry.isDirectory()) {
        if (!dryRun) fs.mkdirSync(destPath, { recursive: true });
        walk(srcPath, rel);
      } else {
        const shouldOverwrite = force || overwriteSet.has(rel);
        if (fs.existsSync(destPath) && !shouldOverwrite) {
          log.warn(`Skip existing: ${rel}`);
          continue;
        }
        if (fs.existsSync(destPath) && shouldOverwrite && !force) {
          log.info(`  overwrite  ${rel}`);
        }
        if (dryRun) {
          log.info(`  would create  ${rel}`);
        } else {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(srcPath, destPath);
          log.success(`  create  ${rel}`);
        }
        copied.push(rel);
      }
    }
  };

  walk(filesSrc, "");
  return copied;
}

export function applyFeature(
  projectRoot: string,
  manifest: FeatureManifest,
  options: ApplyFeatureOptions = {},
): ApplyFeatureResult {
  const { dryRun = false, force = false } = options;
  const resolved = resolveFeatureManifest(manifest, projectRoot);
  const { installContext } = resolved;
  const registry = readRegistry(projectRoot);

  if (isFeatureEnabled(registry, manifest.id) && !force) {
    log.warn(`Feature "${manifest.id}" is already enabled.`);
    return { copied: [], patchResults: [] };
  }

  validateFeatureRequirements(resolved, projectRoot);

  if (manifest.id === "admin-rbac") {
    if (installContext.jobsEnabled) {
      const mode =
        installContext.jobsQueueMode === "redis"
          ? "BullMQ + Redis (JOBS_USE_REDIS=true)"
          : "database queue (JOBS_USE_REDIS=false or unset)";
      log.info(`  jobs detected — admin UI will include /admin/jobs (${mode})`);
    } else {
      log.warn(
        "  jobs not detected — skipping /admin/jobs UI. Run `irwin add jobs` first, then `irwin add admin-rbac --force`.",
      );
    }
  }

  const source = resolveFeatureSource(manifest.id, projectRoot);
  const copied: string[] = [];

  const copyFrom = (
    from: string,
    overwrite: string[] = [],
  ) => {
    const filesSrc = featureFilesDir(source, from);
    if (fs.existsSync(filesSrc)) {
      copied.push(
        ...copyFeatureFiles(filesSrc, projectRoot, dryRun, force, overwrite),
      );
    }
  };

  if (resolved.files?.from) {
    copyFrom(resolved.files.from, resolved.files.overwrite ?? []);
  }

  for (const set of resolved.conditionalFiles ?? []) {
    if (!matchesWhen(set.when, installContext)) continue;
    log.info(`  conditional files: ${set.from}`);
    copyFrom(set.from, set.overwrite ?? []);
  }

  if (manifest.syncLocalesFromEnabledFeatures) {
    copied.push(
      ...copyLocalesFromEnabledFeatures(
        projectRoot,
        registry,
        dryRun,
        force,
      ),
    );
  }

  if (["auth", "auth-api", "admin-rbac"].includes(manifest.id)) {
    copied.push(...syncAuthStackFiles(projectRoot, dryRun, manifest.id));
  }

  const patchBackups =
    resolved.patches && resolved.patches.length > 0
      ? collectPatchBackups(projectRoot, resolved.patches)
      : [];

  const patchResults =
    resolved.patches && resolved.patches.length > 0
      ? applyPatches(projectRoot, resolved.patches, dryRun)
      : [];

  for (const pr of patchResults) {
    if (pr.created) {
      const msg = `  ${dryRun ? "would create" : "create"}  ${pr.file} (patch bootstrap)`;
      dryRun ? log.info(msg) : log.success(msg);
    }
    if (pr.applied > 0) {
      const msg = `  ${dryRun ? "would patch" : "patch"}   ${pr.file} (${pr.applied} op(s))`;
      dryRun ? log.info(msg) : log.success(msg);
    }
    if (pr.skipped > 0) {
      log.warn(`  patch   ${pr.file} (${pr.skipped} marker(s) missing)`);
    }
  }

  if (!dryRun) {
    if (manifest.npm) {
      mergePackageJsonDeps(
        path.join(projectRoot, "package.json"),
        manifest.npm.dependencies,
        manifest.npm.devDependencies,
      );
    }

    const artifacts = {
      copiedFiles: copied,
      patchBackups,
    };

    const existingIdx = registry.features.findIndex((f) => f.id === manifest.id);
    if (existingIdx >= 0) {
      registry.features[existingIdx] = {
        ...registry.features[existingIdx],
        version: manifest.version,
        artifacts,
      };
    } else {
      registry.features.push({
        id: manifest.id,
        version: manifest.version,
        addedAt: new Date().toISOString(),
        artifacts,
      });
    }
    writeRegistry(projectRoot, registry);
    const synced = syncHomeFeatures(projectRoot);
    log.info(`  sync home catalog (${synced.featureCount} packs)`);
  }

  return { copied, patchResults };
}
