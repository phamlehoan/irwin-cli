import fs from "fs";
import { NextFunction, Request, Response } from "express";
import i18next from "i18next";
import path from "path";

let initialized = false;

/** Merge all `configs/locales/<lng>/*.json` (same as locale-fallback). */
function loadLocaleTree(lng: string): Record<string, unknown> {
  const dir = path.join(process.cwd(), "configs", "locales", lng);
  const merged: Record<string, unknown> = {};
  if (!fs.existsSync(dir)) return merged;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    Object.assign(merged, JSON.parse(raw) as Record<string, unknown>);
  }
  return merged;
}

export async function initI18n(): Promise<void> {
  if (initialized) return;
  await i18next.init({
    lng: "en",
    fallbackLng: "en",
    preload: ["en", "vi"],
    resources: {
      en: { common: loadLocaleTree("en") },
      vi: { common: loadLocaleTree("vi") },
    },
    ns: ["common"],
    defaultNS: "common",
  });
  initialized = true;
}

export function i18nMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const locale =
    (req.query.locale as string) ||
    (req.cookies?.locale as string) ||
    "en";

  (req as Request & { locale?: string }).locale = locale;
  res.locals.t = (key: string, options?: Record<string, unknown>) =>
    i18next.t(key, { ...options, lng: locale });
  res.locals.locale = locale;
  res.locals.withLocale = (href: string) => {
    if (!href || href.startsWith("#")) return href;
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}locale=${encodeURIComponent(locale)}`;
  };
  next();
}
