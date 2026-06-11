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
  patches?: ManifestPatch[];
  postInstall?: {
    messages?: string[];
    /** Run package manager install when manifest adds npm deps (default: true if deps present). */
    install?: boolean;
    /** package.json script names to run after install (e.g. db:generate). */
    scripts?: string[];
  };
};

export function loadManifest(
  featureId: string,
  projectRoot?: string,
): FeatureManifest {
  const { root } = resolveFeatureSource(featureId, projectRoot);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
  ) as FeatureManifest;
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
