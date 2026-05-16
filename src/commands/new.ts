import fs from "fs";
import path from "path";
import { getIrwinCliRoot } from "../core/packageRoot";
import { copyTemplate, type TemplateVars } from "../core/template";
import { log } from "../utils/logger";
import {
  assertPackageManagerInstalled,
  devCommand,
  installCommand,
  type PackageManager,
  runCommand,
} from "../utils/packageManager";

export type NewOptions = {
  packageManager?: PackageManager;
  tsRailsVersion?: string;
  skipInstall?: boolean;
  skipDev?: boolean;
  skipDb?: boolean;
  apiOnly?: boolean;
  cwd?: string;
};

function validateAppName(name: string): void {
  if (!/^[a-z0-9][a-z0-9-_]*$/i.test(name)) {
    throw new Error(
      `Invalid app name "${name}". Use letters, numbers, hyphens, underscores.`,
    );
  }
}

export async function runNew(
  appName: string,
  options: NewOptions = {},
): Promise<void> {
  validateAppName(appName);

  const parentDir = path.resolve(options.cwd ?? process.cwd());
  const targetDir = path.join(parentDir, appName);

  if (fs.existsSync(targetDir)) {
    throw new Error(`Directory already exists: ${targetDir}`);
  }

  const cliRoot = getIrwinCliRoot();
  const cliPkg = JSON.parse(
    fs.readFileSync(path.join(cliRoot, "package.json"), "utf8"),
  ) as {
    version?: string;
    irwin?: { defaultTsRailsVersion?: string };
  };

  const tsRailsVersion =
    options.tsRailsVersion ??
    cliPkg.irwin?.defaultTsRailsVersion ??
    "1.1.0";

  const pm = options.packageManager ?? "pnpm";

  const vars: TemplateVars = {
    appName,
    appTitle: appName
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    tsRailsVersion,
    irwinCliVersion: cliPkg.version ?? "0.1.0",
    skipDb: options.skipDb ? "true" : "false",
    apiOnly: options.apiOnly ? "true" : "false",
    packageManager: pm,
  };

  const templateDir = path.join(cliRoot, "templates", "base");
  log.info(`Creating ${appName} at ${targetDir}...`);
  copyTemplate(templateDir, targetDir, vars);

  if (options.skipDb) {
    const prismaDir = path.join(targetDir, "configs", "db");
    if (fs.existsSync(prismaDir)) {
      fs.rmSync(prismaDir, { recursive: true, force: true });
    }
  }

  if (options.apiOnly) {
    const viewsDir = path.join(targetDir, "app", "views");
    if (fs.existsSync(viewsDir)) {
      fs.rmSync(viewsDir, { recursive: true, force: true });
    }
    const homePath = path.join(
      targetDir,
      "app",
      "controllers",
      "home.controller.ts",
    );
    fs.writeFileSync(
      homePath,
      `import { ApplicationController } from "./application.controller";

export class HomeController extends ApplicationController {
  async index() {
    this.renderJson({
      app: "${appName}",
      message: "Welcome to ${vars.appTitle}",
    });
  }
}
`,
      "utf8",
    );
  }

  log.success(`\nCreated ${appName} at ${targetDir}`);

  if (options.skipInstall) {
    console.log(`
Next steps:
  cd ${appName}
  ${pm} install
  ${pm} dev
`);
    return;
  }

  const version = await assertPackageManagerInstalled(pm);
  log.info(`Using ${pm} ${version}`);

  const install = installCommand(pm);
  log.info(`Installing dependencies (${install.cmd} ${install.args.join(" ") || ""})...`);
  const installCode = await runCommand(install.cmd, install.args, targetDir);
  if (installCode !== 0) {
    throw new Error(
      `${install.cmd} install failed (exit ${installCode}).\nFix errors, then:\n  cd ${appName}\n  ${pm} install`,
    );
  }
  log.success("Dependencies installed.");

  if (options.skipDev) {
    console.log(`
Ready:
  cd ${appName}
  ${pm} dev
`);
    return;
  }

  const dev = devCommand(pm);
  log.info(`Starting dev server (${dev.cmd} ${dev.args.join(" ")})...\n`);
  console.log(`  cd ${appName}`);
  console.log(`  Press Ctrl+C to stop\n`);

  const devCode = await runCommand(dev.cmd, dev.args, targetDir);
  if (devCode !== 0 && devCode !== null) {
    log.warn(`Dev server exited with code ${devCode}.`);
  }
}
