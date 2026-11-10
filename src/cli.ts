#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs";
import path from "path";
import { runAdd } from "./commands/add";
import { runDoctor } from "./commands/doctor";
import { runGenerate } from "./commands/generate";
import { runList } from "./commands/list";
import { runNew } from "./commands/new";
import { runRemove } from "./commands/remove";
import { runUpgrade } from "./commands/upgrade";
import { log } from "./utils/logger";

const IRWIN_COMMANDS = new Set([
  "new",
  "add",
  "g",
  "generate",
  "list",
  "doctor",
  "remove",
  "upgrade",
]);

/** npm create irwin my-app → create-irwin bin → irwin new my-app */
function normalizeCreateArgv(): void {
  const bin = path.basename(process.argv[1] ?? "");
  if (!bin.includes("create-irwin")) return;
  const args = process.argv.slice(2);
  if (args.length === 0) return;
  const first = args[0];
  if (first.startsWith("-") || IRWIN_COMMANDS.has(first)) return;
  process.argv.splice(2, 0, "new");
}
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
  .argument("<dir>", "Directory for the new app (a path such as services/inv is fine)")
  .option("--name <package-name>", "package.json name, may be scoped (@scope/x); default: directory name")
  .option(
    "-pm, --package-manager <pm>",
    "Package manager: pnpm | npm | yarn",
    defaultPackageManager(),
  )
  .option(
    "--ts-rails-version <version>",
    "ts-rails semver",
    pkg.irwin?.defaultTsRailsVersion ?? "1.1.3",
  )
  .option("--skip-install", "Do not install dependencies")
  .option("--skip-dev", "Install only; do not start the dev server")
  .option("--no-start", "Do not start the dev server (default inside a workspace)")
  .option("--with-home", "Generate the optional feature-store home page")
  .option("--api-only", "JSON responses only (no Pug views)")
  .action(async (appName, options) => {
    try {
      const packageManager = parsePackageManager(options.packageManager);
      await runNew(appName, {
        packageManager,
        tsRailsVersion: options.tsRailsVersion,
        skipInstall: options.skipInstall,
        skipDev: options.skipDev,
        noStart: options.start === false,
        name: options.name,
        withHome: options.withHome,
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
  .option("--skip-install", "Do not install npm deps or run post-install scripts")
  .action(async (feature, options) => {
    try {
      await runAdd(feature, {
        dryRun: options.dryRun,
        force: options.force,
        skipInstall: options.skipInstall,
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
  .option("--force", "Overwrite files that already exist")
  .option("--skip", "Keep files that already exist and exit 0")
  .option("--dry-run", "Show what would be written, write nothing")
  .action(async (type, name, fields, options) => {
    try {
      await runGenerate(type, name, fields ?? [], {
        api: options.api,
        force: options.force,
        skip: options.skip,
        dryRun: options.dryRun,
      });
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

program
  .command("doctor")
  .description("Check Irwin project setup (deps, env, features, markers). Read-only unless --fix")
  .option("--fix", "Repair what can be repaired (e.g. regenerate the home feature catalog)")
  .action((options) => {
    try {
      runDoctor({ fix: options.fix });
    } catch (e) {
      log.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

program
  .command("remove")
  .description(
    "Disable a feature: revert patches, delete copied files, update registry",
  )
  .argument("<feature>", "Feature id to remove")
  .option("--dry-run", "Show what would change")
  .option("--force", "Remove even if other enabled features depend on it")
  .option(
    "--keep-files",
    "Registry only — do not delete copied files or revert patches",
  )
  .action((feature, options) => {
    try {
      runRemove(feature, {
        dryRun: options.dryRun,
        force: options.force,
        keepFiles: options.keepFiles,
      });
    } catch (e) {
      log.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

program
  .command("upgrade")
  .description("Bump ts-rails version in package.json and .irwin/features.json")
  .option("--version <semver>", "Target ts-rails version (default: irwin-cli pin)")
  .option("--skip-install", "Only update package.json and registry")
  .action(async (options) => {
    try {
      await runUpgrade({
        version: options.version,
        skipInstall: options.skipInstall,
      });
    } catch (e) {
      log.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

normalizeCreateArgv();
program.parse();
