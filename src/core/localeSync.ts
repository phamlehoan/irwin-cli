import fs from "fs";
import path from "path";
import { log } from "../utils/logger";
import { getIrwinCliRoot } from "./packageRoot";
import type { IrwinRegistry } from "./registry";

/**
 * When enabling i18n, copy locale JSON from other enabled feature packs only
 * (e.g. admin → vi/admin.json). Skips packs that ship no configs/locales.
 */
export function copyLocalesFromEnabledFeatures(
  projectRoot: string,
  registry: IrwinRegistry,
  dryRun: boolean,
  force: boolean,
): string[] {
  const cliRoot = getIrwinCliRoot();
  const copied: string[] = [];

  for (const feat of registry.features) {
    if (feat.id === "i18n") continue;

    const localesSrc = path.join(
      cliRoot,
      "features",
      feat.id,
      "files",
      "configs",
      "locales",
    );
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
