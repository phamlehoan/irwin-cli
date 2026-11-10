import fs from "fs";
import path from "path";

/**
 * In-memory snapshot of a project's source files, used to roll an `irwin add/remove`
 * back to the exact previous state when something fails half-way (IRW-FIX-035).
 *
 * Only source-like files are captured: heavy/generated directories are skipped, and
 * so is any single file larger than MAX_FILE_BYTES.
 */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  "tmp",
  "log",
  "logs",
  "uploads",
]);
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

export type ProjectSnapshot = {
  root: string;
  files: Map<string, Buffer>;
  /** Directories that existed (relative paths) — never pruned on restore. */
  dirs: Set<string>;
  /** false when the project was too big to snapshot completely. */
  complete: boolean;
};

export function takeSnapshot(root: string): ProjectSnapshot {
  const files = new Map<string, Buffer>();
  const dirs = new Set<string>();
  let total = 0;
  let complete = true;

  const walk = (dir: string, rel: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (IGNORED_DIRS.has(e.name)) continue;
        dirs.add(relPath);
        walk(abs, relPath);
      } else if (e.isFile()) {
        const size = fs.statSync(abs).size;
        if (size > MAX_FILE_BYTES) continue;
        if (total + size > MAX_TOTAL_BYTES) {
          complete = false;
          continue;
        }
        total += size;
        files.set(relPath, fs.readFileSync(abs));
      }
    }
  };
  walk(root, "");
  return { root, files, dirs, complete };
}

export function snapshotText(snap: ProjectSnapshot, rel: string): string | null {
  const buf = snap.files.get(rel.replace(/\\/g, "/"));
  return buf ? buf.toString("utf8") : null;
}

/** Put the tree back: restore changed/deleted files and delete files created since the snapshot. */
export function restoreSnapshot(snap: ProjectSnapshot): { restored: number; removed: number } {
  let restored = 0;
  let removed = 0;

  const current = new Set<string>();
  const walk = (dir: string, rel: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (IGNORED_DIRS.has(e.name)) continue;
        walk(abs, relPath);
      } else if (e.isFile()) {
        current.add(relPath);
      }
    }
  };
  walk(snap.root, "");

  for (const rel of current) {
    if (!snap.files.has(rel)) {
      // Created after the snapshot (or too large to have been captured — never touch those).
      const abs = path.join(snap.root, rel);
      if (fs.statSync(abs).size > MAX_FILE_BYTES) continue;
      fs.unlinkSync(abs);
      removed++;
    }
  }

  for (const [rel, buf] of snap.files) {
    const abs = path.join(snap.root, rel);
    if (fs.existsSync(abs) && fs.readFileSync(abs).equals(buf)) continue;
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
    restored++;
  }

  // Drop directories that the failed run created and that are now empty.
  pruneEmptyDirs(snap, snap.root, "");
  return { restored, removed };
}

function pruneEmptyDirs(snap: ProjectSnapshot, dir: string, rel: string): boolean {
  let empty = true;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const relPath = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (IGNORED_DIRS.has(e.name)) {
        empty = false;
        continue;
      }
      if (!pruneEmptyDirs(snap, abs, relPath)) empty = false;
    } else {
      empty = false;
    }
  }
  // Only remove directories the failed run created; pre-existing (even empty) ones stay.
  if (empty && rel && !snap.dirs.has(rel)) {
    fs.rmdirSync(dir);
    return true;
  }
  return empty;
}