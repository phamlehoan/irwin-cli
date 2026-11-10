import fs from "fs";
import path from "path";
import type { PatchOp } from "./manifest";

export type PatchResult = {
  file: string;
  applied: number;
  skipped: number;
  /** Ops whose content was already present (re-running `irwin add` is a no-op). */
  alreadyPresent: number;
  /** Target file was created because it did not exist (legacy app bootstrap). */
  created?: boolean;
  /** Exact text inserted by this run, in order — lets `irwin remove` reverse the patch precisely. */
  inserted: Array<{ kind: PatchOp["type"]; text: string }>;
};

export type MissingMarker = { file: string; marker: string };

/** Thrown before ANY file is written when one or more `@irwin:` markers cannot be found. */
export class PatchPreflightError extends Error {
  constructor(public readonly missing: MissingMarker[]) {
    super(
      `Cannot apply patches — ${missing.length} marker(s) not found:\n` +
        missing.map((m) => `  - ${m.file}: ${JSON.stringify(m.marker)}`).join("\n") +
        "\nNo files were changed. Restore the marker line(s) (see the pack's manifest.json) or apply the edit by hand, then re-run.",
    );
    this.name = "PatchPreflightError";
  }
}

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

/**
 * Idempotency (IRW-FIX-034): without an explicit `skipIfContains`, an op whose (trimmed)
 * content is already in the file is treated as applied. Very short snippets are never
 * de-duplicated this way — they would match unrelated code.
 */
const MIN_IDEMPOTENT_LENGTH = 3;

function alreadyPresent(content: string, op: PatchOp): boolean {
  const needle = op.content.trim();
  return needle.length >= MIN_IDEMPOTENT_LENGTH && content.includes(needle);
}

export type OpStatus = "applied" | "skipped" | "present" | "missing-marker";

export function applyOp(
  content: string,
  op: PatchOp,
): { content: string; applied: boolean; status: OpStatus; inserted?: string } {
  if (shouldSkipOp(content, op)) {
    return { content, applied: false, status: "skipped" };
  }
  if (alreadyPresent(content, op)) {
    return { content, applied: false, status: "present" };
  }

  if (op.type === "append") {
    const suffix = content.endsWith("\n") ? "" : "\n";
    const inserted = suffix + op.content;
    return { content: content + inserted, applied: true, status: "applied", inserted };
  }

  const markerIndex = content.indexOf(op.marker);
  if (markerIndex === -1) {
    return { content, applied: false, status: "missing-marker" };
  }

  if (op.type === "insertAfter") {
    const insertAt = markerIndex + op.marker.length;
    const before = content.slice(0, insertAt);
    const after = content.slice(insertAt);
    const needsNl = !before.endsWith("\n") && !op.content.startsWith("\n");
    const insert = (needsNl ? "\n" : "") + op.content;
    return { content: before + insert + after, applied: true, status: "applied", inserted: insert };
  }

  if (op.type === "insertBefore") {
    const before = content.slice(0, markerIndex);
    const after = content.slice(markerIndex);
    return {
      content: before + op.content + after,
      applied: true,
      status: "applied",
      inserted: op.content,
    };
  }

  return { content, applied: false, status: "skipped" };
}

/**
 * Remove a block previously inserted by `applyOp`. Returns the new content, or `null`
 * when the block is no longer there (user edited it) so the caller can warn instead of guessing.
 */
export function removeInsertedBlock(
  content: string,
  kind: PatchOp["type"],
  text: string,
): string | null {
  if (!text) return content;
  const idx = kind === "append" ? content.lastIndexOf(text) : content.indexOf(text);
  if (idx === -1) return null;
  return content.slice(0, idx) + content.slice(idx + text.length);
}

type PendingFile = {
  filePath: string;
  /** Always LF while patching; converted back to `eol` on write. */
  content: string;
  eol: "\n" | "\r\n";
  created: boolean;
  changed: boolean;
};

/**
 * Markers and op contents in manifests use LF. On Windows (git autocrlf) project files are
 * CRLF, so every multi-line marker used to fail with "marker missing". We therefore match in
 * LF space and write back in the file's own line-ending style.
 */
export function detectEol(content: string): "\n" | "\r\n" {
  return content.includes("\r\n") ? "\r\n" : "\n";
}
export function toLf(content: string): string {
  return content.replace(/\r\n/g, "\n");
}
export function fromLf(content: string, eol: "\n" | "\r\n"): string {
  return eol === "\r\n" ? content.replace(/\n/g, "\r\n") : content;
}

function normalizeOp(op: PatchOp): PatchOp {
  const out = { ...op, content: toLf(op.content) } as PatchOp;
  if (out.type !== "append") out.marker = toLf(out.marker);
  if ("skipIfContains" in out && out.skipIfContains) out.skipIfContains = toLf(out.skipIfContains);
  return out;
}

/**
 * Two phases (IRW-FIX-035):
 *  1. compute every patch in memory; collect missing markers;
 *  2. only if nothing is missing, write the files.
 * A missing marker therefore throws `PatchPreflightError` with the tree untouched.
 */
export function applyPatches(
  projectRoot: string,
  patches: Array<{ file: string; ops: PatchOp[] }>,
  dryRun: boolean,
): PatchResult[] {
  const results: PatchResult[] = [];
  const pending = new Map<string, PendingFile>();
  const missing: MissingMarker[] = [];

  for (const rawPatch of patches) {
    const patch = { ...rawPatch, ops: rawPatch.ops.map(normalizeOp) };
    const filePath = path.join(projectRoot, patch.file);
    const key = path.resolve(filePath);
    let entry = pending.get(key);
    let created = false;

    if (!entry) {
      let content: string;
      let fileCreated = false;
      let eol: "\n" | "\r\n" = "\n";
      if (!fs.existsSync(filePath)) {
        const bootstrap = bootstrapPatchTargetContent(patch.file, patch.ops);
        if (bootstrap === null) {
          throw new Error(
            `Patch target missing: ${patch.file}. Cannot infer bootstrap content — update the file manually or recreate the app with a newer irwin new.`,
          );
        }
        content = bootstrap;
        fileCreated = true;
      } else {
        const raw = fs.readFileSync(filePath, "utf8");
        eol = detectEol(raw);
        content = toLf(raw);
      }
      entry = { filePath, content, eol, created: fileCreated, changed: fileCreated };
      pending.set(key, entry);
      created = fileCreated;
    }

    const beforeEnsure = entry.content;
    entry.content = ensurePatchTargetContent(patch.file, entry.content, patch.ops);
    if (!created && entry.content !== beforeEnsure) {
      created = true;
      entry.changed = true;
    }

    let applied = 0;
    let skipped = 0;
    let present = 0;
    const inserted: PatchResult["inserted"] = [];

    for (const op of patch.ops) {
      const next = applyOp(entry.content, op);
      if (next.status === "applied") {
        entry.content = next.content;
        entry.changed = true;
        applied++;
        inserted.push({ kind: op.type, text: next.inserted ?? "" });
      } else if (next.status === "present") {
        present++;
      } else if (next.status === "missing-marker") {
        skipped++;
        missing.push({
          file: patch.file,
          marker: op.type === "append" ? "(append)" : op.marker,
        });
      } else {
        skipped++;
      }
    }

    results.push({
      file: patch.file,
      applied,
      skipped,
      alreadyPresent: present,
      created,
      inserted,
    });
  }

  if (missing.length > 0) {
    throw new PatchPreflightError(missing);
  }

  if (!dryRun) {
    for (const entry of pending.values()) {
      if (!entry.changed) continue;
      fs.mkdirSync(path.dirname(entry.filePath), { recursive: true });
      fs.writeFileSync(entry.filePath, fromLf(entry.content, entry.eol), "utf8");
    }
  }

  return results;
}
