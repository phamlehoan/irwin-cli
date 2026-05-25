import fs from "fs";
import path from "path";
import { getIrwinCliRoot } from "../core/packageRoot";
import { readRegistry, writeRegistry } from "../core/registry";
import { resolveIrwinRoot } from "../core/projectRoot";
import {
  detectPackageManager,
  installCommand,
  runCommand,
} from "../utils/packageManager";
import { log } from "../utils/logger";

export type UpgradeOptions = {
  version?: string;
  skipInstall?: boolean;
};

function readDefaultTsRailsVersion(): string {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(getIrwinCliRoot(), "package.json"), "utf8"),
  ) as { irwin?: { defaultTsRailsVersion?: string } };
  return pkg.irwin?.defaultTsRailsVersion ?? "1.1.0";
}

export async function runUpgrade(options: UpgradeOptions = {}): Promise<void> {
  const projectRoot = resolveIrwinRoot();
  const registry = readRegistry(projectRoot);
  const target = options.version?.trim() || readDefaultTsRailsVersion();
  const pkgPath = path.join(projectRoot, "package.json");

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const prev = pkg.dependencies?.["ts-rails"] ?? registry.tsRails;

  if (!pkg.dependencies) pkg.dependencies = {};
  const current = pkg.dependencies["ts-rails"];
  if (current?.startsWith("file:")) {
    log.warn(
      `ts-rails is linked (${current}); bump irwin-rails locally, then pnpm install.`,
    );
  } else {
    pkg.dependencies["ts-rails"] = `^${target}`;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    log.success(`package.json: ts-rails ^${target} (was ${prev})`);
  }

  registry.tsRails = target;
  writeRegistry(projectRoot, registry);
  log.success(`Registry: ts-rails ${target}`);

  if (options.skipInstall) {
    log.info("Skipped install. Run your package manager install manually.");
    return;
  }

  const pm = registry.packageManager ?? detectPackageManager(projectRoot);
  const { cmd, args } = installCommand(pm);
  log.info(`Installing (${pm})…`);
  await runCommand(cmd, args, projectRoot);
  log.success("Done. Run: pnpm exec irwin doctor");
}
