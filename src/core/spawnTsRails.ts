import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

export function resolveTsRailsCli(projectRoot: string): string {
  const req = createRequire(path.join(projectRoot, "package.json"));
  let pkgPath: string;
  try {
    pkgPath = req.resolve("ts-rails/package.json");
  } catch {
    throw new Error(
      "ts-rails is not installed. Run: pnpm install (or add ts-rails to package.json)",
    );
  }
  const cliPath = path.join(path.dirname(pkgPath), "dist", "cli.js");
  if (!fs.existsSync(cliPath)) {
    throw new Error(`ts-rails CLI not found at ${cliPath}. Reinstall ts-rails.`);
  }
  return cliPath;
}

export function spawnTsRails(
  projectRoot: string,
  args: string[],
): Promise<number> {
  const cliPath = resolveTsRailsCli(projectRoot);
  return new Promise((resolve, reject) => {
    const child = spawn("node", [cliPath, ...args], {
      stdio: "inherit",
      cwd: projectRoot,
      shell: false,
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
