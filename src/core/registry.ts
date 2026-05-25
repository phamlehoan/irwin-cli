import fs from "fs";
import path from "path";
import type { PackageManager } from "../utils/packageManager";

export type PatchBackup = {
  file: string;
  /** `null` when the file did not exist before patches were applied. */
  content: string | null;
};

export type FeatureArtifacts = {
  copiedFiles: string[];
  patchBackups: PatchBackup[];
};

export type FeatureEntry = {
  id: string;
  version: string;
  addedAt: string;
  artifacts?: FeatureArtifacts;
};

export type IrwinRegistry = {
  irwinCliVersion: string;
  tsRails: string;
  packageManager?: PackageManager;
  features: FeatureEntry[];
};

const REGISTRY_REL = ".irwin/features.json";

export function registryPath(projectRoot: string): string {
  return path.join(projectRoot, REGISTRY_REL);
}

export function readRegistry(projectRoot: string): IrwinRegistry {
  const file = registryPath(projectRoot);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${REGISTRY_REL}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as IrwinRegistry;
}

export function writeRegistry(
  projectRoot: string,
  registry: IrwinRegistry,
): void {
  const file = registryPath(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(registry, null, 2) + "\n", "utf8");
}

export function isFeatureEnabled(
  registry: IrwinRegistry,
  featureId: string,
): boolean {
  return registry.features.some((f) => f.id === featureId);
}
