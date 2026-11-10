import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { PatchResult } from "./patchEngine";
import type { FeatureArtifacts, OverwrittenFile, PatchedFile } from "./registry";
import type { ProjectSnapshot } from "./snapshot";

export function sha256(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function sha256File(abs: string): string | null {
  return fs.existsSync(abs) ? sha256(fs.readFileSync(abs)) : null;
}

/** Keep an overwritten original beside the registry (not inside it) so features.json stays small. */
function backupOriginal(projectRoot: string, featureId: string, rel: string, content: Buffer): OverwrittenFile {
  const backup = `.irwin/backups/${featureId}/${rel}`;
  const abs = path.join(projectRoot, backup);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return { file: rel, backup, originalSha256: sha256(content) };
}

/**
 * Build the registry record for an install (IRW-FIX-036).
 *
 * `snap` is the project state BEFORE the install, so we can tell files the pack created
 * from files it overwrote (and keep the originals so remove can put them back).
 */
export function buildArtifacts(opts: {
  projectRoot: string;
  snap: ProjectSnapshot;
  copied: string[];
  patchResults: PatchResult[];
  previous?: FeatureArtifacts;
  /** Pack id; names the backup directory for overwritten originals. */
  featureId?: string;
}): FeatureArtifacts {
  const { projectRoot, snap, patchResults } = opts;
  const previous = opts.previous;

  // Re-install over an install made by an older irwin-cli: we cannot classify files
  // reliably, so keep the legacy record (union) instead of guessing.
  if (previous && !previous.createdFiles) {
    return {
      copiedFiles: [...new Set([...previous.copiedFiles, ...opts.copied])],
      patchBackups: previous.patchBackups,
    };
  }

  const prevCreated = new Set(previous?.createdFiles ?? []);
  const prevOverwritten = new Map<string, OverwrittenFile>(
    (previous?.overwrittenFiles ?? []).map((o) => [o.file, o]),
  );

  const created = new Set(prevCreated);
  const overwritten = new Map(prevOverwritten);

  for (const rel of opts.copied) {
    if (prevCreated.has(rel) || prevOverwritten.has(rel)) continue; // already classified by the first install
    const before = snap.files.get(rel);
    if (before === undefined) {
      created.add(rel);
    } else {
      overwritten.set(rel, backupOriginal(projectRoot, opts.featureId ?? "pack", rel, before));
    }
  }

  const allWritten = [...new Set([...created, ...overwritten.keys()])];
  const checksums: Record<string, string> = {};
  for (const rel of allWritten) {
    const h = sha256File(path.join(projectRoot, rel));
    if (h) checksums[rel] = h;
  }

  const patched = new Map<string, PatchedFile>(
    (previous?.patchedFiles ?? []).map((p) => [p.file, { ...p, inserted: [...p.inserted] }]),
  );
  for (const pr of patchResults) {
    const file = pr.file.replace(/\\/g, "/");
    const existing = patched.get(file);
    if (existing) {
      existing.inserted.push(...pr.inserted);
    } else if (pr.applied > 0 || pr.created) {
      patched.set(file, {
        file,
        createdByPatch: !snap.files.has(file),
        inserted: [...pr.inserted],
      });
    }
  }

  return {
    copiedFiles: allWritten,
    patchBackups: [],
    createdFiles: [...created],
    overwrittenFiles: [...overwritten.values()],
    checksums,
    patchedFiles: [...patched.values()],
  };
}
