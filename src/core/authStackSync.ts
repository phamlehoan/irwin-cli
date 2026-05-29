import fs from "fs";
import path from "path";
import { getIrwinCliRoot } from "./packageRoot";
import { log } from "../utils/logger";
import { isFeatureEnabled, readRegistry } from "./registry";

export type AuthStackContext = {
  authEnabled: boolean;
  authApiEnabled: boolean;
  adminRbacEnabled: boolean;
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
  };
}

function authStackRoot(): string {
  return path.join(getIrwinCliRoot(), "features", "auth-stack");
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
      log.info(`  would sync  ${rel} (auth-stack)`);
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      log.success(`  sync  ${rel} (auth-stack)`);
    }
    copied.push(rel);
  }
  return copied;
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
  const installingRbac = installingFeatureId === "admin-rbac";

  if (!ctx.authEnabled && !ctx.authApiEnabled && !installingAuthStack) {
    return [];
  }

  const root = authStackRoot();
  const sharedDir = path.join(root, "files-shared");
  const variantDir =
    ctx.adminRbacEnabled || installingRbac
      ? path.join(root, "files-rbac")
      : path.join(root, "files-default");

  const sharedPaths = fs.existsSync(sharedDir)
    ? walkAllFiles(sharedDir)
    : STACK_SHARED;

  const copied = copyTree(sharedDir, projectRoot, sharedPaths, dryRun);

  if (fs.existsSync(path.join(variantDir, STACK_CURRENT_USER))) {
    copied.push(
      ...copyTree(variantDir, projectRoot, [STACK_CURRENT_USER], dryRun),
    );
  }

  return copied;
}
