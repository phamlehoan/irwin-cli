import fs from "fs";
import path from "path";

export type FeatureEntry = {
  id: string;
  version: string;
  addedAt: string;
};

export type IrwinRegistry = {
  irwinCliVersion: string;
  tsRails: string;
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
