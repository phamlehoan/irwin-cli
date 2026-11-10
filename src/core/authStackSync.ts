import fs from "fs";
import path from "path";
import { getIrwinCliRoot } from "./packageRoot";
import { log } from "../utils/logger";
import { copyTree, walkAllFiles } from "../utils/fs";
import { isFeatureEnabled, readRegistry } from "./registry";

export type AuthStackContext = {
  authEnabled: boolean;
  authApiEnabled: boolean;
  adminRbacEnabled: boolean;
  adminRbacApiEnabled: boolean;
};

const STACK_SHARED = [
  "lib/utils/jwt.ts",
  "app/middlewares/validateUserLogin.middleware.ts",
  "app/validators/auth.validator.ts",
];

const STACK_CURRENT_USER = "app/middlewares/currentUser.middleware.ts";

export function getAuthStackContext(projectRoot: string): AuthStackContext {
  const registry = readRegistry(projectRoot);
  return {
    authEnabled: isFeatureEnabled(registry, "auth"),
    authApiEnabled: isFeatureEnabled(registry, "auth-api"),
    adminRbacEnabled: isFeatureEnabled(registry, "admin-rbac"),
    adminRbacApiEnabled: isFeatureEnabled(registry, "admin-rbac-api"),
  };
}

function authStackRoot(): string {
  return path.join(getIrwinCliRoot(), "features", "auth-stack");
}

/**
 * Ghi đè các file dùng chung auth / auth-api theo registry (thứ tự cài không quan trọng).
 */
export function syncAuthStackFiles(
  projectRoot: string,
  dryRun = false,
  /** Feature đang cài (registry chưa ghi — cần để sync lần đầu `auth-api`). */
  installingFeatureId?: string,
): string[] {
  const ctx = getAuthStackContext(projectRoot);
  const installingAuthStack =
    installingFeatureId === "auth" || installingFeatureId === "auth-api";
  const installingRbac =
    installingFeatureId === "admin-rbac" ||
    installingFeatureId === "admin-rbac-api";

  if (!ctx.authEnabled && !ctx.authApiEnabled && !installingAuthStack) {
    return [];
  }

  const root = authStackRoot();
  const sharedDir = path.join(root, "files-shared");
  const variantDir =
    ctx.adminRbacEnabled || ctx.adminRbacApiEnabled || installingRbac
      ? path.join(root, "files-rbac")
      : path.join(root, "files-default");

  const sharedPaths = fs.existsSync(sharedDir)
    ? walkAllFiles(sharedDir)
    : STACK_SHARED;

  const copied = copyTree(sharedDir, projectRoot, sharedPaths, dryRun, "auth-stack");

  if (fs.existsSync(path.join(variantDir, STACK_CURRENT_USER))) {
    copied.push(
      ...copyTree(variantDir, projectRoot, [STACK_CURRENT_USER], dryRun, "auth-stack"),
    );
  }

  return copied;
}
