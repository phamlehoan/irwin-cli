import fs from "fs";
import path from "path";
import { listAllFeatureIds, resolveFeatureSource } from "./featureSource";

export type PatchOp =
  | {
      type: "insertAfter";
      marker: string;
      content: string;
      /** Bỏ qua nếu file đã chứa chuỗi này (tránh patch trùng khi cài auth + auth-api). */
      skipIfContains?: string;
    }
  | {
      type: "insertBefore";
      marker: string;
      content: string;
      skipIfContains?: string;
    }
  | { type: "append"; content: string; skipIfContains?: string };

export type FeatureWhen = {
  jobsEnabled?: boolean;
  jobsUseRedis?: boolean;
  jobsUseDatabase?: boolean;
};

export type ManifestPatch = {
  file: string;
  ops: PatchOp[];
  when?: FeatureWhen;
};

export type ConditionalFileSet = {
  from: string;
  when: FeatureWhen;
  overwrite?: string[];
};

export type FeatureManifest = {
  id: string;
  version: string;
  description?: string;
  requires?: string[];
  npm?: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    pnpmOverrides?: Record<string, string>;
  };
  files?: {
    from?: string;
    /** Paths (relative to project root) copied even when the file already exists. */
    overwrite?: string[];
  };
  /** Extra file trees applied when `when` matches project env / registry. */
  conditionalFiles?: ConditionalFileSet[];
  /** Copy configs/locales from other enabled feature packs (e.g. admin → vi/admin.json). */
  syncLocalesFromEnabledFeatures?: boolean;
  /** Shared stack files to refresh after install (replaces id checks in applyFeature, IRW-FIX-045). */
  stackSync?: Array<"auth" | "rbac">;
  patches?: ManifestPatch[];
  postInstall?: {
    messages?: string[];
    /** Run package manager install when manifest adds npm deps (default: true if deps present). */
    install?: boolean;
    /** package.json script names to run after install (e.g. db:generate). */
    scripts?: string[];
    /** `.env` keys filled with a random secret when empty or absent (never overwrites a value). */
    generateSecrets?: string[];
    /** Create `.env` from `.env.example` when missing. */
    createEnvFile?: boolean;
  };
};

const MANIFEST_KEYS = new Set([
  "id",
  "version",
  "description",
  "requires",
  "npm",
  "files",
  "conditionalFiles",
  "syncLocalesFromEnabledFeatures",
  "stackSync",
  "patches",
  "postInstall",
]);
const NPM_KEYS = new Set(["dependencies", "devDependencies", "scripts", "pnpmOverrides"]);
const FILES_KEYS = new Set(["from", "overwrite"]);
const POST_INSTALL_KEYS = new Set(["messages", "install", "scripts", "generateSecrets", "createEnvFile"]);
const PATCH_KEYS = new Set(["file", "ops", "when"]);
const WHEN_KEYS = new Set(["jobsEnabled", "jobsUseRedis", "jobsUseDatabase"]);
const OP_KEYS = new Set(["type", "marker", "content", "skipIfContains"]);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function unknownKeys(obj: Record<string, unknown>, allowed: Set<string>, where: string, out: string[]): void {
  for (const k of Object.keys(obj)) {
    // A typo such as "pacthes" used to be ignored silently and the pack installed half-way.
    if (!allowed.has(k)) out.push(`${where}: unknown key "${k}"`);
  }
}

function checkStringArray(v: unknown, where: string, out: string[]): void {
  if (v === undefined) return;
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    out.push(`${where}: expected an array of strings`);
  }
}

function checkWhen(v: unknown, where: string, out: string[]): void {
  if (v === undefined) return;
  if (!isObj(v)) {
    out.push(`${where}: expected an object`);
    return;
  }
  unknownKeys(v, WHEN_KEYS, where, out);
  for (const [k, val] of Object.entries(v)) {
    if (typeof val !== "boolean") out.push(`${where}.${k}: expected a boolean`);
  }
}

/** Structural validation of a parsed manifest. Returns a list of problems (empty = valid). */
export function validateManifest(raw: unknown): string[] {
  const out: string[] = [];
  if (!isObj(raw)) return ["manifest must be a JSON object"];

  unknownKeys(raw, MANIFEST_KEYS, "manifest", out);
  if (typeof raw.id !== "string" || !raw.id) out.push('manifest.id: required string');
  if (typeof raw.version !== "string" || !raw.version) out.push("manifest.version: required string");
  if (raw.description !== undefined && typeof raw.description !== "string") {
    out.push("manifest.description: expected a string");
  }
  checkStringArray(raw.requires, "manifest.requires", out);
  if (
    raw.syncLocalesFromEnabledFeatures !== undefined &&
    typeof raw.syncLocalesFromEnabledFeatures !== "boolean"
  ) {
    out.push("manifest.syncLocalesFromEnabledFeatures: expected a boolean");
  }

  if (raw.stackSync !== undefined) {
    if (!Array.isArray(raw.stackSync) || raw.stackSync.some((x) => x !== "auth" && x !== "rbac")) {
      out.push('manifest.stackSync: expected an array of "auth" | "rbac"');
    }
  }

  if (raw.npm !== undefined) {
    if (!isObj(raw.npm)) out.push("manifest.npm: expected an object");
    else {
      unknownKeys(raw.npm, NPM_KEYS, "manifest.npm", out);
      for (const [k, v] of Object.entries(raw.npm)) {
        if (!isObj(v) || Object.values(v).some((x) => typeof x !== "string")) {
          out.push(`manifest.npm.${k}: expected an object of strings`);
        }
      }
    }
  }

  if (raw.files !== undefined) {
    if (!isObj(raw.files)) out.push("manifest.files: expected an object");
    else {
      unknownKeys(raw.files, FILES_KEYS, "manifest.files", out);
      if (raw.files.from !== undefined && typeof raw.files.from !== "string") {
        out.push("manifest.files.from: expected a string");
      }
      checkStringArray(raw.files.overwrite, "manifest.files.overwrite", out);
    }
  }

  if (raw.conditionalFiles !== undefined) {
    if (!Array.isArray(raw.conditionalFiles)) out.push("manifest.conditionalFiles: expected an array");
    else {
      raw.conditionalFiles.forEach((set, i) => {
        const where = `manifest.conditionalFiles[${i}]`;
        if (!isObj(set)) return out.push(`${where}: expected an object`);
        unknownKeys(set, new Set(["from", "when", "overwrite"]), where, out);
        if (typeof set.from !== "string") out.push(`${where}.from: required string`);
        if (set.when === undefined) out.push(`${where}.when: required`);
        checkWhen(set.when, `${where}.when`, out);
        checkStringArray(set.overwrite, `${where}.overwrite`, out);
      });
    }
  }

  if (raw.patches !== undefined) {
    if (!Array.isArray(raw.patches)) out.push("manifest.patches: expected an array");
    else {
      raw.patches.forEach((p, i) => {
        const where = `manifest.patches[${i}]`;
        if (!isObj(p)) return out.push(`${where}: expected an object`);
        unknownKeys(p, PATCH_KEYS, where, out);
        if (typeof p.file !== "string" || !p.file) out.push(`${where}.file: required string`);
        checkWhen(p.when, `${where}.when`, out);
        if (!Array.isArray(p.ops) || p.ops.length === 0) {
          out.push(`${where}.ops: required non-empty array`);
          return;
        }
        p.ops.forEach((op: unknown, j: number) => {
          const w = `${where}.ops[${j}]`;
          if (!isObj(op)) return out.push(`${w}: expected an object`);
          unknownKeys(op, OP_KEYS, w, out);
          if (op.type !== "insertAfter" && op.type !== "insertBefore" && op.type !== "append") {
            out.push(`${w}.type: must be insertAfter | insertBefore | append`);
          }
          if (typeof op.content !== "string") out.push(`${w}.content: required string`);
          if (op.type !== "append" && (typeof op.marker !== "string" || !op.marker)) {
            out.push(`${w}.marker: required string for ${String(op.type)}`);
          }
          if (op.skipIfContains !== undefined && typeof op.skipIfContains !== "string") {
            out.push(`${w}.skipIfContains: expected a string`);
          }
        });
      });
    }
  }

  if (raw.postInstall !== undefined) {
    if (!isObj(raw.postInstall)) out.push("manifest.postInstall: expected an object");
    else {
      unknownKeys(raw.postInstall, POST_INSTALL_KEYS, "manifest.postInstall", out);
      checkStringArray(raw.postInstall.messages, "manifest.postInstall.messages", out);
      checkStringArray(raw.postInstall.scripts, "manifest.postInstall.scripts", out);
      checkStringArray(raw.postInstall.generateSecrets, "manifest.postInstall.generateSecrets", out);
      if (raw.postInstall.createEnvFile !== undefined && typeof raw.postInstall.createEnvFile !== "boolean") {
        out.push("manifest.postInstall.createEnvFile: expected a boolean");
      }
      if (raw.postInstall.install !== undefined && typeof raw.postInstall.install !== "boolean") {
        out.push("manifest.postInstall.install: expected a boolean");
      }
    }
  }

  return out;
}

/** Parse + validate a manifest file; the error names the file and every problem found. */
export function readManifestFileStrict(file: string): FeatureManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`Invalid manifest ${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const problems = validateManifest(raw);
  if (problems.length > 0) {
    throw new Error(`Invalid manifest ${file}:\n  - ${problems.join("\n  - ")}`);
  }
  return raw as FeatureManifest;
}

export function loadManifest(
  featureId: string,
  projectRoot?: string,
): FeatureManifest {
  const { root } = resolveFeatureSource(featureId, projectRoot);
  const manifest = readManifestFileStrict(path.join(root, "manifest.json"));
  if (manifest.id !== featureId) {
    throw new Error(
      `Feature manifest id mismatch: requested "${featureId}" vs manifest.id "${manifest.id}"`,
    );
  }
  return manifest;
}

export function listFeatureIds(projectRoot?: string): string[] {
  return listAllFeatureIds(projectRoot);
}
