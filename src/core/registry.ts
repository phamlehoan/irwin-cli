import fs from "fs";
import path from "path";
import type { PackageManager } from "../utils/packageManager";

export type PatchBackup = {
  file: string;
  /** `null` when the file did not exist before patches were applied. */
  content: string | null;
};

export type PatchedFile = {
  file: string;
  /** The patch bootstrapped this file (it did not exist before). */
  createdByPatch: boolean;
  /** Exact text inserted by the pack, so `irwin remove` can take it out again. */
  inserted: Array<{ kind: "insertAfter" | "insertBefore" | "append"; text: string }>;
};

export type OverwrittenFile = {
  file: string;
  /**
   * Registry v2 (IRW-FIX-045): the original lives in `.irwin/backups/<feature>/<file>`, not in this
   * JSON, so features.json stays small and diff-able. `backup` is that path relative to the project root.
   */
  backup?: string;
  /** sha256 of the original, to detect a damaged backup before restoring it. */
  originalSha256?: string;
  /** Legacy (registry v1): original content inline as base64. Still read; no longer written. */
  originalBase64?: string;
};

export type FeatureArtifacts = {
  /** Every file the pack wrote (created + overwritten). Kept for older irwin-cli versions. */
  copiedFiles: string[];
  /** Legacy whole-file snapshots (irwin-cli <= 0.0.4). Not written by newer versions. */
  patchBackups: PatchBackup[];

  /** v2 (IRW-FIX-036) — present only when written by a version that tracks them. */
  createdFiles?: string[];
  overwrittenFiles?: OverwrittenFile[];
  /** sha256 of each written file right after install: a different hash later means the user edited it. */
  checksums?: Record<string, string>;
  patchedFiles?: PatchedFile[];
};

export type FeatureEntry = {
  id: string;
  version: string;
  addedAt: string;
  artifacts?: FeatureArtifacts;
  /** npm entries the pack merged into package.json (informational: remove does not prune them). */
  addedDeps?: {
    dependencies?: string[];
    devDependencies?: string[];
    scripts?: string[];
  };
};

/** Current on-disk schema. A file without `schemaVersion` is v1 and is upgraded on the next write. */
export const REGISTRY_SCHEMA_VERSION = 2;

export type IrwinRegistry = {
  schemaVersion?: number;
  /** Opt-in "feature store" home page (IRW-FIX-039). Absent/false = no `lib/irwin/homeFeatures.ts`. */
  withHome?: boolean;
  irwinCliVersion: string;
  tsRails: string;
  packageManager?: PackageManager;
  features: FeatureEntry[];
};

const REGISTRY_REL = ".irwin/features.json";

export function registryPath(projectRoot: string): string {
  return path.join(projectRoot, REGISTRY_REL);
}

/** Structural check of a parsed registry. Returns problems (empty = valid). Extra keys are allowed (forward compatible). */
export function validateRegistry(raw: unknown): string[] {
  const out: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return ["registry must be a JSON object"];
  }
  const r = raw as Record<string, unknown>;
  if (r.schemaVersion !== undefined && typeof r.schemaVersion !== "number") {
    out.push("schemaVersion: expected a number");
  }
  if (typeof r.schemaVersion === "number" && r.schemaVersion > REGISTRY_SCHEMA_VERSION) {
    out.push(
      `schemaVersion ${r.schemaVersion} is newer than this irwin-cli understands (${REGISTRY_SCHEMA_VERSION}); upgrade irwin-cli`,
    );
  }
  if (!Array.isArray(r.features)) {
    out.push("features: expected an array");
    return out;
  }
  r.features.forEach((f, i) => {
    const where = `features[${i}]`;
    if (typeof f !== "object" || f === null) {
      out.push(`${where}: expected an object`);
      return;
    }
    const e = f as Record<string, unknown>;
    if (typeof e.id !== "string" || !e.id) out.push(`${where}.id: required string`);
    if (typeof e.version !== "string") out.push(`${where}.version: required string`);
    if (e.artifacts !== undefined && (typeof e.artifacts !== "object" || e.artifacts === null)) {
      out.push(`${where}.artifacts: expected an object`);
    }
  });
  return out;
}

export function readRegistry(projectRoot: string): IrwinRegistry {
  const file = registryPath(projectRoot);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${REGISTRY_REL}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(
      `${REGISTRY_REL} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const problems = validateRegistry(raw);
  if (problems.length > 0) {
    throw new Error(`Invalid ${REGISTRY_REL}:\n  - ${problems.join("\n  - ")}`);
  }
  return raw as IrwinRegistry;
}

/** Write via a temp file + rename so a crash can never leave a half-written (unparseable) registry. */
export function writeRegistry(
  projectRoot: string,
  registry: IrwinRegistry,
): void {
  const file = registryPath(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data =
    JSON.stringify({ ...registry, schemaVersion: REGISTRY_SCHEMA_VERSION }, null, 2) + "\n";
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, "utf8");
  fs.renameSync(tmp, file);
}

const LOCK_REL = ".irwin/features.lock";
const STALE_LOCK_MS = 10 * 60 * 1000;

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Exclusive lock for commands that mutate the project (add/remove). A second concurrent
 * command fails fast with a clear message instead of interleaving writes (IRW-FIX-045).
 * A lock whose owner process is gone (or older than 10 minutes) is treated as stale.
 */
function acquireLock(projectRoot: string): () => void {
  const lockFile = path.join(projectRoot, LOCK_REL);
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const acquire = (): boolean => {
    try {
      fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid, at: Date.now() }), {
        flag: "wx",
      });
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw e;
    }
  };
  if (!acquire()) {
    let stale = false;
    try {
      const info = JSON.parse(fs.readFileSync(lockFile, "utf8")) as { pid?: number; at?: number };
      stale = !pidAlive(info.pid ?? -1) || Date.now() - (info.at ?? 0) > STALE_LOCK_MS;
    } catch {
      stale = true;
    }
    if (stale) fs.rmSync(lockFile, { force: true });
    if (!stale || !acquire()) {
      throw new Error(
        `Another irwin command is changing this project (lock: ${LOCK_REL}). Wait for it to finish, or delete the lock file if no irwin process is running.`,
      );
    }
  }
  return () => fs.rmSync(lockFile, { force: true });
}

export async function withRegistryLock<T>(
  projectRoot: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  const release = acquireLock(projectRoot);
  try {
    return await fn();
  } finally {
    release();
  }
}

export function withRegistryLockSync<T>(projectRoot: string, fn: () => T): T {
  const release = acquireLock(projectRoot);
  try {
    return fn();
  } finally {
    release();
  }
}

export function isFeatureEnabled(
  registry: IrwinRegistry,
  featureId: string,
): boolean {
  return registry.features.some((f) => f.id === featureId);
}
