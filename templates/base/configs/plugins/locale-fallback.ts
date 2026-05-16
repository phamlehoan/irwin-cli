import fs from "fs";
import { NextFunction, Request, Response } from "express";
import path from "path";

type LocaleTree = Record<string, unknown>;

let catalog: LocaleTree | null = null;

function loadEnglishCatalog(): LocaleTree {
  if (catalog) return catalog;
  const dir = path.join(process.cwd(), "configs", "locales", "en");
  const merged: LocaleTree = {};
  if (!fs.existsSync(dir)) {
    catalog = merged;
    return merged;
  }
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    Object.assign(merged, JSON.parse(raw) as LocaleTree);
  }
  catalog = merged;
  return merged;
}

function lookup(tree: LocaleTree, key: string): string {
  const parts = key.split(".");
  let node: unknown = tree;
  for (const part of parts) {
    if (!node || typeof node !== "object" || !(part in node)) return key;
    node = (node as LocaleTree)[part];
  }
  return typeof node === "string" ? node : key;
}

/** English-only `t()` when the i18n feature pack is not enabled. */
export function englishLocaleMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  const tree = loadEnglishCatalog();
  res.locals.locale = "en";
  res.locals.t = (key: string) => lookup(tree, key);
  res.locals.withLocale = (href: string) => href;
  next();
}
