import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * IRW-FIX-047: secrets are generated into the project's `.env`, never shipped as a default in code.
 * An existing non-empty value is never touched; `.env` is created from `.env.example` when missing.
 * Returns the keys that were generated.
 */
export function ensureGeneratedSecrets(projectRoot: string, keys: string[]): string[] {
  if (keys.length === 0) return [];
  const envPath = path.join(projectRoot, ".env");
  const examplePath = path.join(projectRoot, ".env.example");
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(examplePath)) fs.copyFileSync(examplePath, envPath);
    else fs.writeFileSync(envPath, "", "utf8");
  }
  let text = fs.readFileSync(envPath, "utf8");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const generated: string[] = [];
  for (const key of keys) {
    const value = crypto.randomBytes(32).toString("base64url");
    const line = new RegExp(`^${key}=[ \t]*$`, "m");
    if (line.test(text)) {
      text = text.replace(line, `${key}=${value}`);
      generated.push(key);
    } else if (!new RegExp(`^${key}=`, "m").test(text)) {
      text += `${text.endsWith("\n") || text === "" ? "" : eol}${key}=${value}${eol}`;
      generated.push(key);
    }
  }
  if (generated.length > 0) fs.writeFileSync(envPath, text, "utf8");
  return generated;
}
