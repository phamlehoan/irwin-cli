import fs from "fs";
import path from "path";
import { getJobsInstallContext } from "./installContext";
import { getIrwinCliRoot } from "./packageRoot";
import { log } from "../utils/logger";
import { copyTree, walkAllFiles } from "../utils/fs";
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
  const copied = copyTree(sharedDir, projectRoot, sharedPaths, dryRun, "admin-rbac-stack");

  const jobsCtx = getJobsInstallContext(projectRoot);
  if (jobsCtx.jobsEnabled) {
    const jobsDir = path.join(root, "files-jobs");
    const jobsPaths = fs.existsSync(jobsDir) ? walkAllFiles(jobsDir) : [];
    copied.push(...copyTree(jobsDir, projectRoot, jobsPaths, dryRun, "admin-rbac-stack"));
  }

  return copied;
}

export function isRbacFeatureEnabled(projectRoot: string): boolean {
  const ctx = getRbacStackContext(projectRoot);
  return ctx.adminRbacEnabled || ctx.adminRbacApiEnabled;
}
