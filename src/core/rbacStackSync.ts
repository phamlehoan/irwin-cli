import fs from "fs";
import path from "path";
import { getJobsInstallContext } from "./installContext";
import { getIrwinCliRoot } from "./packageRoot";
import { log } from "../utils/logger";
import { isFeatureEnabled, readRegistry } from "./registry";

export type RbacStackContext = {
  adminRbacEnabled: boolean;
  adminRbacApiEnabled: boolean;
  jobsEnabled: boolean;
};

const RBAC_FEATURE_IDS = new Set(["admin-rbac", "admin-rbac-api"]);

export function getRbacStackContext(projectRoot: string): RbacStackContext {
  const registry = readRegistry(projectRoot);
  const jobs = getJobsInstallContext(projectRoot);
  return {
    adminRbacEnabled: isFeatureEnabled(registry, "admin-rbac"),
    adminRbacApiEnabled: isFeatureEnabled(registry, "admin-rbac-api"),
    jobsEnabled: jobs.jobsEnabled,
  };
}

function rbacStackRoot(): string {
  return path.join(getIrwinCliRoot(), "features", "admin-rbac-stack");
}

function walkAllFiles(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name).replace(/\\/g, "/");
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkAllFiles(full, rel));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function copyTree(
  srcDir: string,
  projectRoot: string,
  relPaths: string[],
  dryRun: boolean,
): string[] {
  const copied: string[] = [];
  for (const rel of relPaths) {
    const src = path.join(srcDir, rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(projectRoot, rel);
    if (dryRun) {
      log.info(`  would sync  ${rel} (admin-rbac-stack)`);
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      log.success(`  sync  ${rel} (admin-rbac-stack)`);
    }
    copied.push(rel);
  }
  return copied;
}

/**
 * Ghi đè các file RBAC dùng chung admin-rbac / admin-rbac-api theo registry.
 */
export function syncRbacStackFiles(
  projectRoot: string,
  dryRun = false,
  installingFeatureId?: string,
): string[] {
  const ctx = getRbacStackContext(projectRoot);
  const installingRbac =
    installingFeatureId !== undefined &&
    RBAC_FEATURE_IDS.has(installingFeatureId);

  if (
    !ctx.adminRbacEnabled &&
    !ctx.adminRbacApiEnabled &&
    !installingRbac
  ) {
    return [];
  }

  const root = rbacStackRoot();
  const sharedDir = path.join(root, "files-shared");
  const sharedPaths = fs.existsSync(sharedDir) ? walkAllFiles(sharedDir) : [];
  const copied = copyTree(sharedDir, projectRoot, sharedPaths, dryRun);

  const jobsCtx = getJobsInstallContext(projectRoot);
  if (jobsCtx.jobsEnabled) {
    const jobsDir = path.join(root, "files-jobs");
    const jobsPaths = fs.existsSync(jobsDir) ? walkAllFiles(jobsDir) : [];
    copied.push(...copyTree(jobsDir, projectRoot, jobsPaths, dryRun));
  }

  return copied;
}

export function isRbacFeatureEnabled(projectRoot: string): boolean {
  const ctx = getRbacStackContext(projectRoot);
  return ctx.adminRbacEnabled || ctx.adminRbacApiEnabled;
}
