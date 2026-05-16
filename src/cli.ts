#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs";
import path from "path";
import { runAdd } from "./commands/add";
import { runGenerate } from "./commands/generate";
import { runList } from "./commands/list";
import { runNew } from "./commands/new";
import { log } from "./utils/logger";
import {
  defaultPackageManager,
  parsePackageManager,
} from "./utils/packageManager";

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
) as { version?: string; irwin?: { defaultTsRailsVersion?: string } };

const program = new Command();

program
  .name("irwin")
  .description("Irwin app scaffolder and feature packs")
  .version(pkg.version ?? "0.1.0");

program
  .command("new")
  .description("Create a new Irwin app (minimal HTTP, Rails-like)")
  .argument("<app-name>", "Directory name for the new app")
  .option(
    "-pm, --package-manager <pm>",
    "Package manager: pnpm | npm | yarn",
    defaultPackageManager(),
  )
  .option(
    "--ts-rails-version <version>",
    "ts-rails semver",
    pkg.irwin?.defaultTsRailsVersion ?? "1.1.0",
  )
  .option("--skip-install", "Do not install dependencies")
  .option("--skip-dev", "Install only; do not start the dev server")
  .option("--skip-db", "Omit Prisma / database files")
  .option("--api-only", "JSON responses only (no Pug views)")
  .action(async (appName, options) => {
    try {
      const packageManager = parsePackageManager(options.packageManager);
      await runNew(appName, {
        packageManager,
        tsRailsVersion: options.tsRailsVersion,
        skipInstall: options.skipInstall,
        skipDev: options.skipDev,
        skipDb: options.skipDb,
        apiOnly: options.apiOnly,
      });
    } catch (e) {
      log.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

program
  .command("add")
  .description("Enable a feature pack in the current project")
  .argument("<feature>", "Feature id (api, auth, admin, …)")
  .option("--dry-run", "Show what would change without writing")
  .option("--force", "Overwrite existing files")
  .action(async (feature, options) => {
    try {
      await runAdd(feature, {
        dryRun: options.dryRun,
        force: options.force,
      });
    } catch (e) {
      log.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

program
  .command("generate")
  .alias("g")
  .description("Run local ts-rails generators")
  .argument("<type>", "scaffold, resource, controller, service, …")
  .argument("<name>", "Resource or class name")
  .argument("[fields...]", "field:type pairs")
  .option("--api", "API-only scaffold/resource")
  .action(async (type, name, fields, options) => {
    try {
      await runGenerate(type, name, fields ?? [], options.api);
    } catch (e) {
      log.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

program.command("list").description("List feature packs and enabled state").action(() => {
  try {
    runList();
  } catch (e) {
    log.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
});

program.parse();
