import fs from "fs";
import path from "path";

/** Root of the irwin-cli package (contains templates/ and features/). */
export function getIrwinCliRoot(): string {
  let dir = path.resolve(__dirname, "..");
  for (let i = 0; i < 6; i++) {
    if (
      fs.existsSync(path.join(dir, "templates", "base")) &&
      fs.existsSync(path.join(dir, "package.json"))
    ) {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(dir, "package.json"), "utf8"),
      ) as { name?: string };
      if (pkg.name === "irwin-cli") return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not resolve irwin-cli package root");
}
