import fs from "fs";
import path from "path";
import type { FeatureManifest } from "./manifest";
import { envFlag, readProjectEnv } from "./projectEnv";
import { isFeatureEnabled, readRegistry } from "./registry";

export type FeatureWhen = {
  /** `jobs` feature enabled in registry or `initializeJobs()` wired in application. */
  jobsEnabled?: boolean;
  /** `JOBS_USE_REDIS=true` in project env. */
  jobsUseRedis?: boolean;
  /** Jobs enabled and not using Redis (database queue). */
  jobsUseDatabase?: boolean;
};

export type JobsInstallContext = {
  jobsEnabled: boolean;
  jobsUseRedis: boolean;
  jobsQueueMode: "none" | "redis" | "database";
};

export type ConditionalFileSet = {
  from: string;
  when: FeatureWhen;
  overwrite?: string[];
};

/** Remove `// line` and block comments so a commented-out call is not mistaken for wiring (IRW-FIX-038). */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

function applicationHasJobsInitializer(projectRoot: string): boolean {
  const appFile = path.join(projectRoot, "configs", "application.ts");
  if (!fs.existsSync(appFile)) return false;
  const src = stripComments(fs.readFileSync(appFile, "utf8"));
  return (
    src.includes("initializeJobs()") || src.includes("setupJobWorkers()")
  );
}

/** Detect whether background jobs are active and which queue backend env selects. */
export function getJobsInstallContext(projectRoot: string): JobsInstallContext {
  const registry = readRegistry(projectRoot);
  const env = readProjectEnv(projectRoot);

  const jobsInRegistry = isFeatureEnabled(registry, "jobs");
  const jobsWired = applicationHasJobsInitializer(projectRoot);
  const jobsEnabled = jobsInRegistry || jobsWired;

  const jobsUseRedis = jobsEnabled && envFlag(env.JOBS_USE_REDIS);

  const jobsQueueMode: JobsInstallContext["jobsQueueMode"] = !jobsEnabled
    ? "none"
    : jobsUseRedis
      ? "redis"
      : "database";

  return { jobsEnabled, jobsUseRedis, jobsQueueMode };
}

export function matchesWhen(
  when: FeatureWhen | undefined,
  ctx: JobsInstallContext,
): boolean {
  if (!when) return true;

  if (when.jobsEnabled === true && !ctx.jobsEnabled) return false;
  if (when.jobsEnabled === false && ctx.jobsEnabled) return false;

  if (when.jobsUseRedis === true && !ctx.jobsUseRedis) return false;
  if (when.jobsUseRedis === false && ctx.jobsUseRedis) return false;

  if (when.jobsUseDatabase === true) {
    if (!ctx.jobsEnabled || ctx.jobsUseRedis) return false;
  }
  if (when.jobsUseDatabase === false && ctx.jobsEnabled && !ctx.jobsUseRedis) {
    return false;
  }

  return true;
}

export type ResolvedFeatureManifest = FeatureManifest & {
  installContext: JobsInstallContext;
};

export function resolveFeatureManifest(
  manifest: FeatureManifest,
  projectRoot: string,
): ResolvedFeatureManifest {
  const installContext = getJobsInstallContext(projectRoot);

  const patches = (manifest.patches ?? []).filter((p) =>
    matchesWhen(p.when, installContext),
  );

  return {
    ...manifest,
    patches,
    installContext,
  };
}
