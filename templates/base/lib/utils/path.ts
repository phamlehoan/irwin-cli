import { join } from "path";
import { getPackageRootSync } from "@configs/loadDotenv";

const packageRoot = getPackageRootSync(
  typeof __dirname !== "undefined" ? __dirname : process.cwd(),
);

export const rootPath = (...paths: string[]) => join(packageRoot, ...paths);
export const appPath = (...paths: string[]) => join(packageRoot, "app", ...paths);
