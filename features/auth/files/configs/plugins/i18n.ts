import fs from "fs";
import { NextFunction, Request, Response } from "express";
import i18next from "i18next";
import path from "path";
import { rootPath } from "@lib/utils/path";

const SUPPORTED_LOCALES = ["en", "vi"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

let initialized = false;

function loadLocaleTree(lng: string): Record<string, unknown> {
  const dir = rootPath("configs", "locales", lng);
  const merged: Record<string, unknown> = {};
  if (!fs.existsSync(dir)) return merged;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    Object.assign(merged, JSON.parse(raw) as Record<string, unknown>);
  }
  return merged;
}

function parseLocale(value: unknown): SupportedLocale | null {
  if (typeof value !== "string") return null;
  return SUPPORTED_LOCALES.includes(value as SupportedLocale)
    ? (value as SupportedLocale)
    : null;
}

export async function initI18n(): Promise<void> {
  if (initialized) return;
  await i18next.init({
    lng: "en",
    fallbackLng: "en",
    preload: [...SUPPORTED_LOCALES],
    resources: {
      en: { common: loadLocaleTree("en") },
      vi: { common: loadLocaleTree("vi") },
    },
    ns: ["common"],
    defaultNS: "common",
  });
  initialized = true;
}

function switchLocaleUrl(req: Request, lng: SupportedLocale): string {
  const pathOnly = req.originalUrl.split("?")[0] || "/";
  const params = new URLSearchParams(req.originalUrl.split("?")[1] || "");
  params.set("locale", lng);
  const qs = params.toString();
  return qs ? `${pathOnly}?${qs}` : `${pathOnly}?locale=${lng}`;
}

export function i18nMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const fromQuery = parseLocale(req.query.locale);
  if (fromQuery) {
    res.cookie("locale", fromQuery, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: "lax",
    });
  }

  const locale =
    fromQuery ||
    parseLocale(req.cookies?.locale) ||
    "en";

  (req as Request & { locale?: string }).locale = locale;
  res.locals.t = (key: string, options?: Record<string, unknown>) =>
    i18next.t(key, { ...options, lng: locale });
  res.locals.locale = locale;
  const messages = i18next.getResourceBundle(locale, "common") as
    | Record<string, unknown>
    | undefined;
  res.locals.i18nMessages = messages || {};
  res.locals.withLocale = (href: string) => {
    if (!href || href.startsWith("#")) return href;
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}locale=${encodeURIComponent(locale)}`;
  };
  res.locals.switchLocaleUrl = (lng: string) => {
    const parsed = parseLocale(lng);
    return parsed ? switchLocaleUrl(req, parsed) : switchLocaleUrl(req, "en");
  };
  next();
}
