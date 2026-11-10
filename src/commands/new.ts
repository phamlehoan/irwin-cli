import fs from "fs";
import path from "path";
import { getIrwinCliRoot } from "../core/packageRoot";
import { copyTemplate, type TemplateVars } from "../core/template";
import { syncHomeFeatures } from "../core/syncHomeFeatures";
import { readRegistry, writeRegistry } from "../core/registry";
import { ensureGeneratedSecrets } from "../core/secrets";
import { findWorkspaceRoot, planInstall } from "../core/workspace";
import { log } from "../utils/logger";
import {
  assertPackageManagerInstalled,
  devCommand,
  type PackageManager,
  runCommand,
} from "../utils/packageManager";

export type NewOptions = {
  packageManager?: PackageManager;
  tsRailsVersion?: string;
  skipInstall?: boolean;
  /** Do not start the dev server after install (alias: noStart). */
  skipDev?: boolean;
  noStart?: boolean;
  /** package.json name, may be scoped (`@scope/x`). Default: the last segment of the directory. */
  name?: string;
  /** Generate the "feature store" home page (off by default, IRW-FIX-039). */
  withHome?: boolean;
  apiOnly?: boolean;
  cwd?: string;
};

const DIR_NAME = /^[a-z0-9][a-z0-9-_.]*$/i;
const PACKAGE_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/**
 * IRW-FIX-041: `<dir>` may be a path (`services/inv`); the package name is separate and may be scoped
 * (`--name @erp/inv`). Returns the validated package name.
 */
export function resolveNewTarget(
  dirArg: string,
  nameOpt?: string,
): { dirSegments: string[]; packageName: string } {
  const dirSegments = dirArg.split(/[\\/]+/).filter(Boolean);
  if (dirSegments.length === 0 || dirSegments.some((s) => s === ".." || s === ".")) {
    throw new Error(`Invalid directory "${dirArg}".`);
  }
  const last = dirSegments[dirSegments.length - 1];
  const packageName = nameOpt ?? last;
  if (!nameOpt && !DIR_NAME.test(last)) {
    throw new Error(
      `Invalid app name "${last}". Use letters, numbers, hyphens, underscores (or pass --name for the package name).`,
    );
  }
  if (!PACKAGE_NAME.test(packageName)) {
    throw new Error(`Invalid package name "${packageName}". Example: my-app or @scope/my-app.`);
  }
  return { dirSegments, packageName };
}

/** Home page without the feature store (the default). */
const PLAIN_HOME_CONTROLLER = `import { ApplicationController } from "./application.controller";

export class HomeController extends ApplicationController {
  async index() {
    this.render("home.view/index", { title: "{{appTitle}}" });
  }
}
`;

const PLAIN_HOME_VIEW = `extends ../layouts/main/layout

block content
  section.hero
    h1= t('home.welcome')
    p= t('home.intro')
`;

function useHomeWithoutStore(targetDir: string, appTitle: string): void {
  fs.writeFileSync(
    path.join(targetDir, "app", "controllers", "home.controller.ts"),
    PLAIN_HOME_CONTROLLER.replace("{{appTitle}}", appTitle),
    "utf8",
  );
  const viewDir = path.join(targetDir, "app", "views", "home.view");
  fs.writeFileSync(path.join(viewDir, "index.pug"), PLAIN_HOME_VIEW, "utf8");
  fs.rmSync(path.join(viewDir, "_features.pug"), { force: true });
  fs.rmSync(
    path.join(targetDir, "app", "assets", "javascripts", "mainLayout", "featureCopy.js"),
    { force: true },
  );
}

export async function runNew(
  appName: string,
  options: NewOptions = {},
): Promise<void> {
  const { dirSegments, packageName } = resolveNewTarget(appName, options.name);

  const parentDir = path.resolve(options.cwd ?? process.cwd());
  const targetDir = path.join(parentDir, ...dirSegments);
  const unscoped = packageName.replace(/^@[^/]+\//, "");

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
    "1.1.3";

  const pm = options.packageManager ?? "pnpm";

  const vars: TemplateVars = {
    appName: packageName,
    appTitle: unscoped
      .split(/[-_.]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    tsRailsVersion,
    irwinCliVersion: cliPkg.version ?? "0.1.0",
    apiOnly: options.apiOnly ? "true" : "false",
    packageManager: pm,
  };

  const templateDir = path.join(cliRoot, "templates", "base");
  log.info(`Creating ${packageName} at ${targetDir}...`);
  copyTemplate(templateDir, targetDir, vars);
  // IRW-FIX-047: the session secret is generated per project instead of shipping a public default.
  ensureGeneratedSecrets(targetDir, ["SESSION_SECRET"]);
  const withHome = !!options.withHome && !options.apiOnly;
  if (options.withHome && options.apiOnly) {
    log.warn("--with-home ignored: --api-only has no views.");
  }
  if (withHome) {
    const registry = readRegistry(targetDir);
    writeRegistry(targetDir, { ...registry, withHome: true });
    syncHomeFeatures(targetDir);
  } else if (!options.apiOnly) {
    useHomeWithoutStore(targetDir, vars.appTitle);
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
      app: "${packageName}",
      message: "Welcome to ${vars.appTitle}",
    });
  }
}
`,
      "utf8",
    );
  }

  log.success(`\nCreated ${packageName} at ${targetDir}`);
  const cdPath = path.relative(parentDir, targetDir) || ".";
  const noStart = options.noStart || options.skipDev || findWorkspaceRoot(targetDir) !== null;

  if (options.skipInstall) {
    console.log(`
Next steps:
  cd ${cdPath}
  ${pm} install
  ${pm} dev

  pnpm exec irwin add database   # optional: Prisma SQLite
  pnpm exec irwin add api
`);
    return;
  }

  const version = await assertPackageManagerInstalled(pm);
  log.info(`Using ${pm} ${version}`);

  // IRW-FIX-042: inside a workspace only this app (and its dependencies) is installed.
  const install = planInstall(pm, targetDir);
  log.info(`Installing dependencies (${install.cmd} ${install.args.join(" ") || ""}) in ${install.cwd}...`);
  const installCode = await runCommand(install.cmd, install.args, install.cwd);
  if (installCode !== 0) {
    throw new Error(
      `${install.cmd} install failed (exit ${installCode}).\nFix errors, then:\n  cd ${cdPath}\n  ${pm} install`,
    );
  }
  log.success("Dependencies installed.");

  if (noStart) {
    console.log(`
Ready:
  cd ${cdPath}
  ${pm} dev
`);
    return;
  }

  const dev = devCommand(pm);
  log.info(`Starting dev server (${dev.cmd} ${dev.args.join(" ")})...\n`);
  console.log(`  cd ${cdPath}`);
  console.log(`  Press Ctrl+C to stop\n`);

  const devCode = await runCommand(dev.cmd, dev.args, targetDir);
  if (devCode !== 0 && devCode !== null) {
    log.warn(`Dev server exited with code ${devCode}.`);
  }
}
