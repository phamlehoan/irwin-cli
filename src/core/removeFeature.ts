import fs from "fs";
import path from "path";
import { log } from "../utils/logger";
import type { PatchOp } from "./manifest";
import { detectEol, fromLf, removeInsertedBlock, toLf } from "./patchEngine";
import { sha256, sha256File } from "./artifacts";
import type { FeatureArtifacts, FeatureEntry, OverwrittenFile } from "./registry";

/** Original of an overwritten file: v2 backup file (checked against its hash) or the legacy inline base64. */
export function readOriginal(projectRoot: string, o: OverwrittenFile): Buffer | null {
  if (o.backup) {
    const abs = path.join(projectRoot, o.backup);
    if (!fs.existsSync(abs)) return null;
    const data = fs.readFileSync(abs);
    return o.originalSha256 && sha256(data) !== o.originalSha256 ? null : data;
  }
  return o.originalBase64 !== undefined ? Buffer.from(o.originalBase64, "base64") : null;
}

/** Legacy (irwin-cli <= 0.0.4): whole-file snapshot taken before patching. */
export function collectPatchBackups(
  projectRoot: string,
  patches: Array<{ file: string; ops: PatchOp[] }>,
): FeatureArtifacts["patchBackups"] {
  const backups: FeatureArtifacts["patchBackups"] = [];
  const seen = new Set<string>();

  for (const patch of patches) {
    const file = patch.file.replace(/\\/g, "/");
    if (seen.has(file)) continue;
    seen.add(file);

    const filePath = path.join(projectRoot, file);
    backups.push({
      file,
      content: fs.existsSync(filePath)
        ? fs.readFileSync(filePath, "utf8")
        : null,
    });
  }

  return backups;
}

export type RevertArtifactsResult = {
  deletedFiles: string[];
  restoredFiles: string[];
  removedBootstrapFiles: string[];
  /** Files deliberately left in place, with the reason. */
  keptFiles: Array<{ file: string; reason: string }>;
  /** Patch blocks that could not be found any more (edited by hand) — need manual cleanup. */
  unreversedBlocks: Array<{ file: string; preview: string }>;
};

export type RevertOptions = {
  /** Other enabled features: files they also own must not be deleted. */
  others?: FeatureEntry[];
};

function emptyResult(): RevertArtifactsResult {
  return {
    deletedFiles: [],
    restoredFiles: [],
    removedBootstrapFiles: [],
    keptFiles: [],
    unreversedBlocks: [],
  };
}

export function revertFeatureArtifacts(
  projectRoot: string,
  artifacts: FeatureArtifacts | undefined,
  dryRun: boolean,
  options: RevertOptions = {},
): RevertArtifactsResult {
  const result = emptyResult();
  if (!artifacts) return result;

  if (artifacts.createdFiles) {
    revertV2(projectRoot, artifacts, dryRun, options, result);
  } else {
    revertLegacy(projectRoot, artifacts, dryRun, result);
  }
  return result;
}

function ownedByOthers(rel: string, others: FeatureEntry[]): string | null {
  for (const o of others) {
    const a = o.artifacts;
    if (!a) continue;
    const owns =
      a.createdFiles?.includes(rel) ||
      a.overwrittenFiles?.some((f) => f.file === rel) ||
      (!a.createdFiles && a.copiedFiles.includes(rel));
    if (owns) return o.id;
  }
  return null;
}

function isCommentOnly(content: string): boolean {
  return content
    .split(/\r?\n/)
    .every((l) => l.trim() === "" || l.trim().startsWith("//"));
}

function revertV2(
  projectRoot: string,
  artifacts: FeatureArtifacts,
  dryRun: boolean,
  options: RevertOptions,
  result: RevertArtifactsResult,
): void {
  const checksums = artifacts.checksums ?? {};
  const others = options.others ?? [];

  // 1. Files the pack created.
  for (const rel of [...(artifacts.createdFiles ?? [])].reverse()) {
    const abs = path.join(projectRoot, rel);
    if (!fs.existsSync(abs)) continue;

    const owner = ownedByOthers(rel, others);
    if (owner) {
      result.keptFiles.push({ file: rel, reason: `also used by "${owner}"` });
      log.warn(`  keep    ${rel} (also used by "${owner}")`);
      continue;
    }
    const expected = checksums[rel];
    if (expected && sha256File(abs) !== expected) {
      result.keptFiles.push({ file: rel, reason: "modified since install" });
      log.warn(`  keep    ${rel} (you modified it since install)`);
      continue;
    }

    if (dryRun) log.info(`  would delete  ${rel}`);
    else {
      fs.unlinkSync(abs);
      log.success(`  delete  ${rel}`);
    }
    result.deletedFiles.push(rel);
  }

  // 2. Files the pack overwrote: put the originals back (unless the user changed them since).
  for (const o of artifacts.overwrittenFiles ?? []) {
    const abs = path.join(projectRoot, o.file);
    if (!fs.existsSync(abs)) continue;
    const expected = checksums[o.file];
    if (expected && sha256File(abs) !== expected) {
      result.keptFiles.push({ file: o.file, reason: "modified since install (original not restored)" });
      log.warn(`  keep    ${o.file} (modified since install — original not restored)`);
      continue;
    }
    if (dryRun) log.info(`  would restore  ${o.file}`);
    else {
      const original = readOriginal(projectRoot, o);
      if (!original) {
        result.keptFiles.push({ file: o.file, reason: "original backup missing or damaged" });
        log.warn(`  keep    ${o.file} (original backup missing or damaged)`);
        continue;
      }
      fs.writeFileSync(abs, original);
      log.success(`  restore  ${o.file}`);
    }
    result.restoredFiles.push(o.file);
  }

  // 3. Patches: take out exactly the text the pack inserted.
  for (const pf of artifacts.patchedFiles ?? []) {
    // package.json is re-serialized by the npm merge step, so text blocks cannot be found again.
    // Scripts/dependencies are never pruned automatically (the CLI prints a reminder).
    if (pf.file === "package.json") continue;
    const abs = path.join(projectRoot, pf.file);
    if (!fs.existsSync(abs)) continue;

    const raw = fs.readFileSync(abs, "utf8");
    const eol = detectEol(raw);
    let content = toLf(raw);
    let changed = false;
    for (const block of [...pf.inserted].reverse()) {
      const next = removeInsertedBlock(content, block.kind, toLf(block.text));
      if (next === null) {
        const preview = block.text.trim().split(/\r?\n/)[0]?.slice(0, 80) ?? "";
        result.unreversedBlocks.push({ file: pf.file, preview });
        log.warn(`  manual  ${pf.file}: could not find inserted block "${preview}" — remove it by hand`);
        continue;
      }
      content = next;
      changed = true;
    }

    if (pf.createdByPatch && isCommentOnly(content)) {
      if (dryRun) log.info(`  would remove  ${pf.file} (created by patch)`);
      else {
        fs.unlinkSync(abs);
        log.success(`  remove  ${pf.file} (created by patch)`);
      }
      result.removedBootstrapFiles.push(pf.file);
      continue;
    }

    if (changed) {
      if (dryRun) log.info(`  would unpatch  ${pf.file}`);
      else {
        fs.writeFileSync(abs, fromLf(content, eol), "utf8");
        log.success(`  unpatch  ${pf.file}`);
      }
      result.restoredFiles.push(pf.file);
    }
  }
}

function revertLegacy(
  projectRoot: string,
  artifacts: FeatureArtifacts,
  dryRun: boolean,
  result: RevertArtifactsResult,
): void {
  for (const rel of [...artifacts.copiedFiles].reverse()) {
    const filePath = path.join(projectRoot, rel);
    if (!fs.existsSync(filePath)) continue;
    if (dryRun) {
      log.info(`  would delete  ${rel}`);
    } else {
      fs.unlinkSync(filePath);
      log.success(`  delete  ${rel}`);
    }
    result.deletedFiles.push(rel);
  }

  for (const backup of artifacts.patchBackups) {
    const filePath = path.join(projectRoot, backup.file);
    if (backup.content === null) {
      if (!fs.existsSync(filePath)) continue;
      if (dryRun) {
        log.info(`  would remove  ${backup.file} (created by patch)`);
      } else {
        fs.unlinkSync(filePath);
        log.success(`  remove  ${backup.file} (created by patch)`);
      }
      result.removedBootstrapFiles.push(backup.file);
      continue;
    }

    if (dryRun) {
      log.info(`  would restore  ${backup.file}`);
    } else {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, backup.content, "utf8");
      log.success(`  restore  ${backup.file}`);
    }
    result.restoredFiles.push(backup.file);
  }
}
