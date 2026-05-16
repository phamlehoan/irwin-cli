import fs from "fs";
import path from "path";
import { copyDir } from "../utils/fs";

export type TemplateVars = Record<string, string>;

/** Replace `{{key}}` in file contents and paths. */
export function renderString(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in vars)) {
      throw new Error(`Missing template variable: {{${key}}}`);
    }
    return vars[key];
  });
}

function shouldSkip(name: string): boolean {
  return name === "node_modules" || name === ".git";
}

function copyWithRender(
  src: string,
  dest: string,
  vars: TemplateVars,
): void {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (shouldSkip(entry)) continue;
      const srcChild = path.join(src, entry);
      const destName = renderString(entry, vars);
      copyWithRender(srcChild, path.join(dest, destName), vars);
    }
    return;
  }

  const ext = path.extname(src);
  const textExtensions = new Set([
    ".ts",
    ".js",
    ".json",
    ".md",
    ".env",
    ".example",
    ".gitignore",
    ".prisma",
    ".pug",
  ]);
  const isText =
    textExtensions.has(ext) || path.basename(src).startsWith(".env");

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (isText) {
    const raw = fs.readFileSync(src, "utf8");
    fs.writeFileSync(dest, renderString(raw, vars), "utf8");
  } else {
    fs.copyFileSync(src, dest);
  }
}

export function copyTemplate(
  templateDir: string,
  targetDir: string,
  vars: TemplateVars,
): void {
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template not found: ${templateDir}`);
  }
  copyWithRender(templateDir, targetDir, vars);
}

/** Shallow merge npm deps into project package.json */
export function mergePackageJsonDeps(
  packageJsonPath: string,
  deps?: Record<string, string>,
  devDeps?: Record<string, string>,
): void {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  if (deps) {
    pkg.dependencies = { ...pkg.dependencies, ...deps };
  }
  if (devDeps) {
    pkg.devDependencies = { ...pkg.devDependencies, ...devDeps };
  }
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}
