import fs from "fs";
import path from "path";
import type { PatchOp } from "./manifest";

export type PatchResult = {
  file: string;
  applied: number;
  skipped: number;
  /** Target file was created because it did not exist (legacy app bootstrap). */
  created?: boolean;
};

const KNOWN_BOOTSTRAP_FILES: Record<string, string> = {
  "lib/index.ts": "// @irwin:lib-exports\n",
};

/**
 * When patching a project created before a template file existed, seed minimal
 * content so insertAfter @irwin markers can apply.
 */
export function bootstrapPatchTargetContent(
  relFile: string,
  ops: PatchOp[],
): string | null {
  const normalized = relFile.replace(/\\/g, "/");
  if (KNOWN_BOOTSTRAP_FILES[normalized]) {
    return KNOWN_BOOTSTRAP_FILES[normalized];
  }

  for (const op of ops) {
    if (op.type === "insertAfter" && op.marker.includes("@irwin:")) {
      const line = op.marker.trim();
      return line.endsWith("\n") ? line : `${line}\n`;
    }
  }

  return null;
}

/** Ensure @irwin marker lines exist before insertAfter/insertBefore ops run. */
export function ensurePatchTargetContent(
  relFile: string,
  content: string,
  ops: PatchOp[],
): string {
  const bootstrap = bootstrapPatchTargetContent(relFile, ops);
  if (!bootstrap) return content;

  let out = content;
  for (const op of ops) {
    if (op.type !== "insertAfter" && op.type !== "insertBefore") continue;
    if (out.includes(op.marker)) continue;

    if (!out.trim()) {
      out = bootstrap;
      continue;
    }

    if (bootstrap.includes(op.marker)) {
      const sep = out.startsWith("\n") ? "" : "\n";
      out = bootstrap.trimEnd() + sep + out;
    }
  }

  return out;
}

function shouldSkipOp(content: string, op: PatchOp): boolean {
  const needle = "skipIfContains" in op ? op.skipIfContains : undefined;
  return Boolean(needle && content.includes(needle));
}

export function applyOp(
  content: string,
  op: PatchOp,
): { content: string; applied: boolean } {
  if (shouldSkipOp(content, op)) {
    return { content, applied: false };
  }

  if (op.type === "append") {
    const suffix = content.endsWith("\n") ? "" : "\n";
    return { content: content + suffix + op.content, applied: true };
  }

  const markerIndex = content.indexOf(op.marker);
  if (markerIndex === -1) {
    return { content, applied: false };
  }

  if (op.type === "insertAfter") {
    const insertAt = markerIndex + op.marker.length;
    const before = content.slice(0, insertAt);
    const after = content.slice(insertAt);
    const needsNl = !before.endsWith("\n") && !op.content.startsWith("\n");
    const insert = (needsNl ? "\n" : "") + op.content;
    return { content: before + insert + after, applied: true };
  }

  if (op.type === "insertBefore") {
    const before = content.slice(0, markerIndex);
    const after = content.slice(markerIndex);
    return { content: before + op.content + after, applied: true };
  }

  return { content, applied: false };
}

export function applyPatches(
  projectRoot: string,
  patches: Array<{ file: string; ops: PatchOp[] }>,
  dryRun: boolean,
): PatchResult[] {
  const results: PatchResult[] = [];

  for (const patch of patches) {
    const filePath = path.join(projectRoot, patch.file);
    let created = false;
    let content: string;

    if (!fs.existsSync(filePath)) {
      const bootstrap = bootstrapPatchTargetContent(patch.file, patch.ops);
      if (bootstrap === null) {
        throw new Error(
          `Patch target missing: ${patch.file}. Cannot infer bootstrap content — update the file manually or recreate the app with a newer irwin new.`,
        );
      }
      content = bootstrap;
      created = true;
      if (!dryRun) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }
    } else {
      content = fs.readFileSync(filePath, "utf8");
    }

    const beforeEnsure = content;
    content = ensurePatchTargetContent(patch.file, content, patch.ops);
    if (!created && content !== beforeEnsure) {
      created = true;
    }

    let applied = 0;
    let skipped = 0;

    for (const op of patch.ops) {
      const next = applyOp(content, op);
      if (next.applied) {
        content = next.content;
        applied++;
      } else {
        skipped++;
      }
    }

    if (!dryRun && (applied > 0 || created)) {
      fs.writeFileSync(filePath, content, "utf8");
    }

    results.push({ file: patch.file, applied, skipped, created });
  }

  return results;
}
