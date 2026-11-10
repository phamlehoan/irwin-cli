import fs from "fs";
import path from "path";
import { log } from "../utils/logger";
import {
  assertPackageManagerInstalled,
  detectPackageManager,
  runCommand,
  runScriptCommand,
  type PackageManager,
} from "../utils/packageManager";
import type { FeatureManifest } from "./manifest";
import { readRegistry } from "./registry";
import { ensureGeneratedSecrets } from "./secrets";
import { mergePackageJsonDeps } from "./template";
import { mergeNpmIntoProject, planInstall } from "./workspace";

/** vue@3.5.36 on npm ships broken workspace:* deps — pin before install. */
function ensureVuePin(projectRoot: string): void {
  mergeNpmIntoProject(
    projectRoot,
    { dependencies: { vue: "3.5.35" }, pnpmOverrides: { vue: "3.5.35" } },
    mergePackageJsonDeps,
  );
}

export type PostInstallOptions = {
  skipInstall?: boolean;
};

function hasNpmDeps(manifest: FeatureManifest): boolean {
  const deps = manifest.npm?.dependencies ?? {};
  const devDeps = manifest.npm?.devDependencies ?? {};
  return Object.keys(deps).length > 0 || Object.keys(devDeps).length > 0;
}

function resolvePackageManager(
  projectRoot: string,
): PackageManager {
  const registry = readRegistry(projectRoot);
  return registry.packageManager ?? detectPackageManager(projectRoot);
}

/** Copy `.env.example` → `.env` when missing (database needs DATABASE_URL). */
function ensureDotEnv(projectRoot: string): void {
  const envPath = path.join(projectRoot, ".env");
  if (fs.existsSync(envPath)) return;
  const examplePath = path.join(projectRoot, ".env.example");
  if (!fs.existsSync(examplePath)) return;
  fs.copyFileSync(examplePath, envPath);
  log.info("  created  .env from .env.example");
}

export async function runFeaturePostInstall(
  projectRoot: string,
  manifest: FeatureManifest,
  options: PostInstallOptions = {},
): Promise<void> {
  const pm = resolvePackageManager(projectRoot);
  const post = manifest.postInstall;
  const secrets = ensureGeneratedSecrets(projectRoot, post?.generateSecrets ?? []);
  if (secrets.length > 0) log.info(`  generated  ${secrets.join(", ")} in .env`);
  const npmDeps = hasNpmDeps(manifest);
  const shouldInstall =
    !options.skipInstall && npmDeps && (post?.install ?? true);

  if (shouldInstall) {
    if (manifest.id === "vue" || manifest.npm?.dependencies?.vue) {
      ensureVuePin(projectRoot);
    }
    const version = await assertPackageManagerInstalled(pm);
    log.info(`Using ${pm} ${version}`);
    // IRW-FIX-042: inside a workspace only this package (and what it depends on) is installed.
    const install = planInstall(pm, projectRoot);
    log.info(
      `Installing dependencies (${install.cmd} ${install.args.join(" ") || ""}) in ${install.cwd}...`,
    );
    const code = await runCommand(install.cmd, install.args, install.cwd);
    if (code !== 0) {
      throw new Error(
        `${install.cmd} install failed (exit ${code}). Fix errors, then run \`${pm} install\` in the project.`,
      );
    }
    log.success("Dependencies installed.");
  }

  if (post?.createEnvFile) {
    ensureDotEnv(projectRoot);
  }

  if (options.skipInstall && (post?.scripts?.length ?? 0) > 0) {
    // IRW-FIX-037: --skip-install means no install AND no post-install scripts.
    log.info(
      `Skipping post-install scripts (${post!.scripts!.join(", ")}) because of --skip-install. Run them manually.`,
    );
    return;
  }

  for (const script of post?.scripts ?? []) {
    const run = runScriptCommand(pm, script);
    log.info(`Running ${script} (${run.cmd} ${run.args.join(" ")})...`);
    const code = await runCommand(run.cmd, run.args, projectRoot);
    if (code !== 0) {
      log.warn(
        `${script} failed (exit ${code}). Run manually: ${pm} run ${script}`,
      );
    } else {
      log.success(`${script} completed.`);
    }
  }
}
