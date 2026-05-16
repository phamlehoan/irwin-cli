import fs from "fs";
import path from "path";
import type { PatchOp } from "./manifest";

export type PatchResult = {
  file: string;
  applied: number;
  skipped: number;
};

export function applyOp(
  content: string,
  op: PatchOp,
): { content: string; applied: boolean } {
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
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Patch target missing: ${patch.file} (is the base template up to date?)`,
      );
    }

    let content = fs.readFileSync(filePath, "utf8");
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

    if (!dryRun && applied > 0) {
      fs.writeFileSync(filePath, content, "utf8");
    }

    results.push({ file: patch.file, applied, skipped });
  }

  return results;
}
