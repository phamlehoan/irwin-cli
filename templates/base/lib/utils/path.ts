import { join } from "path";
import { getPackageRootSync } from "@configs/loadDotenv";

const packageRoot = getPackageRootSync(
  typeof __dirname !== "undefined" ? __dirname : process.cwd(),
);

export const rootPath = (...paths: string[]) => join(packageRoot, ...paths);
export const appPath = (...paths: string[]) => join(packageRoot, "app", ...paths);
/** Dynamic requires (concerns): `app/` under tsx; `dist/app/` when running compiled output. */
export const appCodePath = (...paths: string[]) => {
  const fromDist =
    typeof __filename !== "undefined" &&
    __filename.replace(/\\/g, "/").includes("/dist/");
  return fromDist
    ? join(packageRoot, "dist", "app", ...paths)
    : appPath(...paths);
};
