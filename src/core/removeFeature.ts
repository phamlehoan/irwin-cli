import fs from "fs";
import path from "path";
import { log } from "../utils/logger";
import type { PatchOp } from "./manifest";
import type { FeatureArtifacts } from "./registry";

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
};

export function revertFeatureArtifacts(
  projectRoot: string,
  artifacts: FeatureArtifacts | undefined,
  dryRun: boolean,
): RevertArtifactsResult {
  const result: RevertArtifactsResult = {
    deletedFiles: [],
    restoredFiles: [],
    removedBootstrapFiles: [],
  };

  if (!artifacts) return result;

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

  return result;
}
