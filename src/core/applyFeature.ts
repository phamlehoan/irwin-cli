import fs from "fs";
import path from "path";
import { log } from "../utils/logger";
import { getIrwinCliRoot } from "./packageRoot";
import type { FeatureManifest } from "./manifest";
import { applyPatches } from "./patchEngine";
import {
  isFeatureEnabled,
  readRegistry,
  writeRegistry,
  type FeatureEntry,
} from "./registry";
import { copyLocalesFromEnabledFeatures } from "./localeSync";
import { mergePackageJsonDeps } from "./template";

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
  const registry = readRegistry(projectRoot);

  if (isFeatureEnabled(registry, manifest.id) && !force) {
    log.warn(`Feature "${manifest.id}" is already enabled.`);
    return { copied: [], patchResults: [] };
  }

  validateFeatureRequirements(manifest, projectRoot);

  const cliRoot = getIrwinCliRoot();
  const filesFrom = manifest.files?.from ?? "files";
  const filesSrc = path.join(cliRoot, "features", manifest.id, filesFrom);
  const copied: string[] = [];

  if (fs.existsSync(filesSrc)) {
    copied.push(
      ...copyFeatureFiles(
        filesSrc,
        projectRoot,
        dryRun,
        force,
        manifest.files?.overwrite ?? [],
      ),
    );
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

  const patchResults =
    manifest.patches && manifest.patches.length > 0
      ? applyPatches(projectRoot, manifest.patches, dryRun)
      : [];

  for (const pr of patchResults) {
    if (pr.applied > 0) {
      log.success(`  patch   ${pr.file} (${pr.applied} op(s))`);
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

    if (!isFeatureEnabled(registry, manifest.id)) {
      const entry: FeatureEntry = {
        id: manifest.id,
        version: manifest.version,
        addedAt: new Date().toISOString(),
      };
      registry.features.push(entry);
      writeRegistry(projectRoot, registry);
    }
  }

  return { copied, patchResults };
}
