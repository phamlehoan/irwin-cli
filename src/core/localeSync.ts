import fs from "fs";
import path from "path";
import { log } from "../utils/logger";
import { featureFilesDir, resolveFeatureSource } from "./featureSource";
import type { IrwinRegistry } from "./registry";

/**
 * When enabling auth/admin, copy locale JSON from other enabled feature packs
 * (e.g. admin → vi/admin.json). Skips packs that ship no configs/locales.
 */
export function copyLocalesFromEnabledFeatures(
  projectRoot: string,
  registry: IrwinRegistry,
  dryRun: boolean,
  force: boolean,
): string[] {
  const copied: string[] = [];

  for (const feat of registry.features) {
    if (feat.id === "auth") continue;

    let localesSrc: string;
    try {
      const source = resolveFeatureSource(feat.id, projectRoot);
      localesSrc = path.join(
        featureFilesDir(source, "files"),
        "configs",
        "locales",
      );
    } catch {
      continue;
    }
    if (!fs.existsSync(localesSrc)) continue;

    const walk = (dir: string, relBase: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const srcPath = path.join(dir, entry.name);
        const rel = path.join(relBase, entry.name).replace(/\\/g, "/");
        if (entry.isDirectory()) {
          walk(srcPath, rel);
          continue;
        }
        if (!entry.name.endsWith(".json")) continue;

        const destRel = path
          .join("configs", "locales", rel)
          .replace(/\\/g, "/");
        const destPath = path.join(projectRoot, destRel);

        if (fs.existsSync(destPath) && !force) {
          log.warn(`Skip existing locale (${feat.id}): ${destRel}`);
          continue;
        }

        if (dryRun) {
          log.info(`  would create locale (${feat.id})  ${destRel}`);
        } else {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(srcPath, destPath);
          log.success(`  locale (${feat.id})  ${destRel}`);
        }
        copied.push(destRel);
      }
    };

    walk(localesSrc, "");
  }

  return copied;
}
