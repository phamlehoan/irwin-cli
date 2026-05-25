import fs from "fs";
import path from "path";
import { getIrwinCliRoot } from "./packageRoot";
import type { FeatureManifest } from "./manifest";

export type FeatureSource = {
  kind: "bundled" | "npm";
  root: string;
  packageName?: string;
};

function manifestAt(root: string): string {
  return path.join(root, "manifest.json");
}

function readManifestFile(root: string): FeatureManifest {
  const file = manifestAt(root);
  if (!fs.existsSync(file)) {
    throw new Error(`No manifest.json in ${root}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as FeatureManifest;
}

export function bundledFeatureRoot(featureId: string): string | null {
  const root = path.join(getIrwinCliRoot(), "features", featureId);
  return fs.existsSync(manifestAt(root)) ? root : null;
}

/** Installed plugins under node_modules/@irwin/* with manifest.json. */
export function npmFeatureRoots(projectRoot: string): FeatureSource[] {
  const found: FeatureSource[] = [];
  const scopedDir = path.join(projectRoot, "node_modules", "@irwin");
  if (!fs.existsSync(scopedDir)) return found;

  for (const entry of fs.readdirSync(scopedDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const root = path.join(scopedDir, entry.name);
    if (!fs.existsSync(manifestAt(root))) continue;
    found.push({
      kind: "npm",
      root,
      packageName: `@irwin/${entry.name}`,
    });
  }

  return found;
}

export function resolveFeatureSource(
  featureId: string,
  projectRoot?: string,
): FeatureSource {
  const bundled = bundledFeatureRoot(featureId);
  if (bundled) {
    return { kind: "bundled", root: bundled };
  }

  if (projectRoot) {
    for (const src of npmFeatureRoots(projectRoot)) {
      const manifest = readManifestFile(src.root);
      if (manifest.id === featureId) return src;
    }
  }

  throw new Error(
    `Unknown feature "${featureId}". Built-in: irwin list. Plugins: npm i @irwin/feature-<id>`,
  );
}

export function listAllFeatureIds(projectRoot?: string): string[] {
  const ids = new Set<string>();

  const featuresDir = path.join(getIrwinCliRoot(), "features");
  if (fs.existsSync(featuresDir)) {
    for (const entry of fs.readdirSync(featuresDir, { withFileTypes: true })) {
      if (entry.isDirectory() && bundledFeatureRoot(entry.name)) {
        ids.add(entry.name);
      }
    }
  }

  if (projectRoot) {
    for (const src of npmFeatureRoots(projectRoot)) {
      try {
        ids.add(readManifestFile(src.root).id);
      } catch {
        /* skip */
      }
    }
  }

  return [...ids].sort();
}

export function featureFilesDir(
  source: FeatureSource,
  filesFrom = "files",
): string {
  return path.join(source.root, filesFrom);
}
