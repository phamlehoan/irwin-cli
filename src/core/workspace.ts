import fs from "fs";
import path from "path";
import type { PackageManager } from "../utils/packageManager";

/**
 * Monorepo support (IRW-FIX-042). An app inside a workspace must not run a bare `pnpm install`
 * (it installs the WHOLE workspace) and its `pnpm.overrides` are ignored by pnpm: overrides only
 * count when declared at the workspace root.
 */
export type WorkspaceInfo = {
  /** Directory that owns the lockfile / workspace definition. */
  root: string;
  kind: "pnpm" | "npm" | "yarn";
};

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Nearest ancestor (strictly above `projectRoot`) that declares a workspace.
 * The project's own directory never counts: a lone app with its own `pnpm-workspace.yaml`
 * (only used for build-script allow-lists) is not a monorepo.
 */
export function findWorkspaceRoot(projectRoot: string): WorkspaceInfo | null {
  let dir = path.dirname(path.resolve(projectRoot));
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return { root: dir, kind: "pnpm" };
    const pkg = readJson(path.join(dir, "package.json"));
    if (pkg && pkg.workspaces) {
      return { root: dir, kind: fs.existsSync(path.join(dir, "yarn.lock")) ? "yarn" : "npm" };
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function readPackageName(projectRoot: string): string | null {
  const name = readJson(path.join(projectRoot, "package.json"))?.name;
  return typeof name === "string" && name ? name : null;
}

export type InstallPlan = { cmd: string; args: string[]; cwd: string; scope: "project" | "workspace-filtered" };

function isCi(env: NodeJS.ProcessEnv): boolean {
  return !!env.CI && env.CI !== "false" && env.CI !== "0";
}

/**
 * Command that installs ONLY what this project needs.
 * `--no-frozen-lockfile` is added under CI because `irwin add` just changed package.json, and pnpm's
 * CI default (`--frozen-lockfile`) would reject the install the CLI itself caused.
 */
export function planInstall(
  pm: PackageManager,
  projectRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): InstallPlan {
  const ws = findWorkspaceRoot(projectRoot);
  const ci = isCi(env);
  if (ws && pm === "pnpm") {
    const name = readPackageName(projectRoot);
    const rel = path.relative(ws.root, projectRoot).replace(/\\/g, "/");
    // `<name>...` also installs the workspace packages this app depends on; the path form works for unnamed packages.
    const selector = name ? `${name}...` : `./${rel}...`;
    return {
      cmd: "pnpm",
      args: ["install", "--filter", selector, ...(ci ? ["--no-frozen-lockfile"] : [])],
      cwd: ws.root,
      scope: "workspace-filtered",
    };
  }
  if (ws && pm === "npm") {
    const rel = path.relative(ws.root, projectRoot).replace(/\\/g, "/");
    return { cmd: "npm", args: ["install", "--workspace", rel], cwd: ws.root, scope: "workspace-filtered" };
  }
  if (ws && pm === "yarn") {
    return { cmd: "yarn", args: [], cwd: ws.root, scope: "workspace-filtered" };
  }
  if (pm === "pnpm") {
    return { cmd: "pnpm", args: ["install", ...(ci ? ["--no-frozen-lockfile"] : [])], cwd: projectRoot, scope: "project" };
  }
  if (pm === "npm") return { cmd: "npm", args: ["install"], cwd: projectRoot, scope: "project" };
  return { cmd: "yarn", args: [], cwd: projectRoot, scope: "project" };
}

/**
 * Merge `overrides:` into the workspace's pnpm-workspace.yaml (supported by pnpm >= 9.5).
 * Text-level on purpose: we must not reformat a file the team owns. Existing entries win.
 * Returns the keys that were added.
 */
export function addWorkspaceOverrides(workspaceRoot: string, overrides: Record<string, string>): string[] {
  const file = path.join(workspaceRoot, "pnpm-workspace.yaml");
  const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);
  const q = (k: string) => (/^[A-Za-z0-9_.-]+$/.test(k) ? k : JSON.stringify(k));
  const idx = lines.findIndex((l) => /^overrides:\s*$/.test(l));
  const have = new Set<string>();
  if (idx >= 0) {
    for (let i = idx + 1; i < lines.length && /^\s+\S/.test(lines[i]); i++) {
      const m = /^\s+["']?([^"':]+(?:@[^"':]+)?)["']?\s*:/.exec(lines[i]);
      if (m) have.add(m[1]);
    }
  }
  const added = Object.entries(overrides).filter(([k]) => !have.has(k));
  if (added.length === 0) return [];
  const block = added.map(([k, v]) => `  ${q(k)}: ${JSON.stringify(v)}`);
  if (idx >= 0) {
    lines.splice(idx + 1, 0, ...block);
  } else {
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    lines.push("overrides:", ...block, "");
  }
  fs.writeFileSync(file, lines.join(eol), "utf8");
  return added.map(([k]) => k);
}

/**
 * Merge npm entries into the project's package.json; `pnpm.overrides` go to the workspace root
 * when the project lives in a pnpm workspace (a package-level override would be silently ignored).
 */
export function mergeNpmIntoProject(
  projectRoot: string,
  npm: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    pnpmOverrides?: Record<string, string>;
  },
  mergePackageJson: (
    file: string,
    deps?: Record<string, string>,
    devDeps?: Record<string, string>,
    scripts?: Record<string, string>,
    overrides?: Record<string, string>,
  ) => void,
): void {
  const ws = findWorkspaceRoot(projectRoot);
  const toRoot = ws?.kind === "pnpm" && npm.pnpmOverrides;
  mergePackageJson(
    path.join(projectRoot, "package.json"),
    npm.dependencies,
    npm.devDependencies,
    npm.scripts,
    toRoot ? undefined : npm.pnpmOverrides,
  );
  if (toRoot && ws && npm.pnpmOverrides) addWorkspaceOverrides(ws.root, npm.pnpmOverrides);
}
