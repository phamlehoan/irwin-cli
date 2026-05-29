import fs from "fs";
import path from "path";

const ENV_FILES = [".env", ".env.local", ".env.development"];

/** Parse KEY=VALUE lines from project env files (later files do not override earlier). */
export function readProjectEnv(projectRoot: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const name of ENV_FILES) {
    const file = path.join(projectRoot, name);
    if (!fs.existsSync(file)) continue;

    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  }

  return out;
}

export function envFlag(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "true";
}
