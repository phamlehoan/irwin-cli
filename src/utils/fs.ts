import { log } from "./logger";
import fs from "fs";
import path from "path";

export function copyDir(
  src: string,
  dest: string,
  filter?: (srcPath: string) => boolean,
): void {
  if (!fs.existsSync(src)) {
    throw new Error(`Source not found: ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (filter && !filter(srcPath)) continue;
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, filter);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function writeFileEnsured(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

/** Every file under `dir` as forward-slash paths relative to it (shared by the stack-sync helpers). */
export function walkAllFiles(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name).replace(/\\/g, "/");
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkAllFiles(full, rel));
    else out.push(rel);
  }
  return out;
}

/** Copy `relPaths` from `srcDir` into `projectRoot`, overwriting; `label` names the stack in log lines. */
export function copyTree(
  srcDir: string,
  projectRoot: string,
  relPaths: string[],
  dryRun: boolean,
  label: string,
): string[] {
  const copied: string[] = [];
  for (const rel of relPaths) {
    const src = path.join(srcDir, rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(projectRoot, rel);
    if (dryRun) {
      log.info(`  would sync  ${rel} (${label})`);
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      log.success(`  sync  ${rel} (${label})`);
    }
    copied.push(rel);
  }
  return copied;
}
