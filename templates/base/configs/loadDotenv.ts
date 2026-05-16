import fs from "fs";
import path from "path";
import dotenv from "dotenv";

let didLoad = false;

export function getPackageRootSync(fromDir: string = __dirname): string {
  let dir = path.resolve(fromDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

export function loadDotenv(): void {
  if (didLoad) return;
  didLoad = true;

  const root = getPackageRootSync(path.join(__dirname));
  const envPath = path.join(root, ".env");
  const localPath = path.join(root, ".env.local");
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
  if (fs.existsSync(localPath)) dotenv.config({ path: localPath, override: true });

  const cwdEnv = path.join(process.cwd(), ".env");
  if (fs.existsSync(cwdEnv) && path.resolve(cwdEnv) !== path.resolve(envPath)) {
    dotenv.config({ path: cwdEnv, override: true });
  }
}
