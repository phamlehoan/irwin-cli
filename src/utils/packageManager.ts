import { spawn } from "child_process";

export type PackageManager = "pnpm" | "npm" | "yarn";

export const PACKAGE_MANAGERS: PackageManager[] = ["pnpm", "npm", "yarn"];

export function parsePackageManager(value: string): PackageManager {
  const pm = value.trim().toLowerCase() as PackageManager;
  if (!PACKAGE_MANAGERS.includes(pm)) {
    throw new Error(
      `Invalid package manager "${value}". Use one of: ${PACKAGE_MANAGERS.join(", ")}.`,
    );
  }
  return pm;
}

/** Prefer explicit flag; otherwise infer from npm user agent when running via npx/npm. */
export function defaultPackageManager(): PackageManager {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.includes("pnpm")) return "pnpm";
  if (ua.includes("yarn")) return "yarn";
  return "pnpm";
}

export function installCommand(pm: PackageManager): { cmd: string; args: string[] } {
  switch (pm) {
    case "npm":
      return { cmd: "npm", args: ["install"] };
    case "pnpm":
      return { cmd: "pnpm", args: ["install"] };
    case "yarn":
      return { cmd: "yarn", args: [] };
  }
}

export function devCommand(pm: PackageManager): { cmd: string; args: string[] } {
  switch (pm) {
    case "npm":
      return { cmd: "npm", args: ["run", "dev"] };
    case "pnpm":
      return { cmd: "pnpm", args: ["dev"] };
    case "yarn":
      return { cmd: "yarn", args: ["dev"] };
  }
}

export function installHint(pm: PackageManager): string {
  switch (pm) {
    case "npm":
      return "https://docs.npmjs.com/downloading-and-installing-node-js-and-npm";
    case "pnpm":
      return "https://pnpm.io/installation";
    case "yarn":
      return "https://yarnpkg.com/getting-started/install";
  }
}

export function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  stdio: "inherit" | "pipe" = "inherit",
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio,
      shell: process.platform === "win32",
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export async function getPackageManagerVersion(
  pm: PackageManager,
): Promise<string | null> {
  try {
    const { cmd, args } = { cmd: pm, args: ["--version"] };
    return await new Promise((resolve) => {
      const child = spawn(cmd, args, {
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      });
      let out = "";
      child.stdout?.on("data", (chunk) => {
        out += String(chunk);
      });
      child.on("error", () => resolve(null));
      child.on("close", (code) => {
        resolve(code === 0 ? out.trim().split("\n")[0] : null);
      });
    });
  } catch {
    return null;
  }
}

export async function assertPackageManagerInstalled(
  pm: PackageManager,
): Promise<string> {
  const version = await getPackageManagerVersion(pm);
  if (!version) {
    throw new Error(
      `${pm} is not installed or not on PATH.\nInstall: ${installHint(pm)}`,
    );
  }
  return version;
}
