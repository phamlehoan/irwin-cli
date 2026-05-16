import fs from "fs";
import path from "path";
import { getIrwinCliRoot } from "./packageRoot";

export type PatchOp =
  | { type: "insertAfter"; marker: string; content: string }
  | { type: "insertBefore"; marker: string; content: string }
  | { type: "append"; content: string };

export type FeatureManifest = {
  id: string;
  version: string;
  description?: string;
  requires?: string[];
  npm?: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  files?: {
    from?: string;
  };
  patches?: Array<{
    file: string;
    ops: PatchOp[];
  }>;
  postInstall?: {
    messages?: string[];
  };
};

export function loadManifest(featureId: string): FeatureManifest {
  const root = getIrwinCliRoot();
  const manifestPath = path.join(
    root,
    "features",
    featureId,
    "manifest.json",
  );
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Unknown feature "${featureId}" (no manifest.json)`);
  }
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8"),
  ) as FeatureManifest;
  if (manifest.id !== featureId) {
    throw new Error(
      `Feature manifest id mismatch: folder "${featureId}" vs manifest.id "${manifest.id}"`,
    );
  }
  return manifest;
}

export function listFeatureIds(): string[] {
  const root = getIrwinCliRoot();
  const featuresDir = path.join(root, "features");
  if (!fs.existsSync(featuresDir)) return [];
  return fs
    .readdirSync(featuresDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) =>
      fs.existsSync(path.join(featuresDir, d.name, "manifest.json")),
    )
    .map((d) => d.name)
    .sort();
}
