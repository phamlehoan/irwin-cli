import fs from "fs";
import path from "path";
import { getIrwinCliRoot } from "../core/packageRoot";
import { loadManifest, listFeatureIds } from "../core/manifest";
import { isFeatureEnabled, readRegistry } from "../core/registry";
import { resolveIrwinRoot } from "../core/projectRoot";
import {
  homeFeaturesNeedSync,
  syncHomeFeatures,
} from "../core/syncHomeFeatures";

type Level = "ok" | "warn" | "fail";

type Check = { level: Level; message: string };

function parseSemver(v: string): [number, number, number] | null {
  const m = v.trim().replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function semverGte(a: string, b: string): boolean {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return true;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return true;
}

function readInstalledVersion(
  projectRoot: string,
  packageName: string,
): string | null {
  const pkgPath = path.join(
    projectRoot,
    "node_modules",
    packageName,
    "package.json",
  );
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      version?: string;
    };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

function envHasKey(projectRoot: string, key: string): boolean {
  for (const file of [".env", ".env.local"]) {
    const p = path.join(projectRoot, file);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    if (new RegExp(`^${key}=`, "m").test(text)) return true;
  }
  return false;
}

function markerPresent(projectRoot: string, relFile: string, marker: string): boolean {
  const file = path.join(projectRoot, relFile);
  if (!fs.existsSync(file)) return false;
  return fs.readFileSync(file, "utf8").includes(marker);
}

export function runDoctor(): void {
  const checks: Check[] = [];
  const cliPkg = JSON.parse(
    fs.readFileSync(path.join(getIrwinCliRoot(), "package.json"), "utf8"),
  ) as {
    irwin?: { minTsRailsVersion?: string; defaultTsRailsVersion?: string };
  };
  const minTsRails =
    cliPkg.irwin?.minTsRailsVersion ??
    cliPkg.irwin?.defaultTsRailsVersion ??
    "1.0.11";

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor >= 20) {
    checks.push({ level: "ok", message: `Node ${process.versions.node}` });
  } else {
    checks.push({
      level: "fail",
      message: `Node ${process.versions.node} (need >= 20)`,
    });
  }

  let projectRoot: string;
  try {
    projectRoot = resolveIrwinRoot();
    checks.push({ level: "ok", message: `Irwin project: ${projectRoot}` });
  } catch (e) {
    checks.push({
      level: "fail",
      message: e instanceof Error ? e.message : String(e),
    });
    printReport(checks);
    process.exit(1);
    return;
  }

  let registry;
  try {
    registry = readRegistry(projectRoot);
    checks.push({
      level: "ok",
      message: `Registry: ts-rails ${registry.tsRails}, ${registry.features.length} feature(s)`,
    });
  } catch (e) {
    checks.push({
      level: "fail",
      message: e instanceof Error ? e.message : String(e),
    });
    printReport(checks);
    process.exit(1);
    return;
  }

  const tsRailsInstalled = readInstalledVersion(projectRoot, "ts-rails");
  if (!tsRailsInstalled) {
    checks.push({
      level: "fail",
      message: "ts-rails not in node_modules — run pnpm install",
    });
  } else if (!semverGte(tsRailsInstalled, minTsRails)) {
    checks.push({
      level: "warn",
      message: `ts-rails ${tsRailsInstalled} < recommended ${minTsRails}`,
    });
  } else {
    checks.push({
      level: "ok",
      message: `ts-rails ${tsRailsInstalled} (registry: ${registry.tsRails})`,
    });
  }

  if (!fs.existsSync(path.join(projectRoot, "node_modules", "tsx"))) {
    checks.push({
      level: "warn",
      message: "tsx not found — dev script may fail (pnpm add -D tsx)",
    });
  } else {
    checks.push({ level: "ok", message: "tsx available" });
  }

  const markers: Array<[string, string]> = [
    ["configs/routes/index.ts", "// @irwin:routes-draw"],
    ["configs/application.ts", "// @irwin:setup-app-middlewares"],
  ];
  for (const [file, marker] of markers) {
    if (markerPresent(projectRoot, file, marker)) {
      checks.push({ level: "ok", message: `Marker ${marker}` });
    } else {
      checks.push({
        level: "warn",
        message: `Missing marker ${marker} in ${file}`,
      });
    }
  }

  for (const feat of registry.features) {
    if (!listFeatureIds(projectRoot).includes(feat.id)) {
      checks.push({
        level: "warn",
        message: `Unknown feature in registry: ${feat.id}`,
      });
      continue;
    }
    try {
      const manifest = loadManifest(feat.id, projectRoot);
      for (const req of manifest.requires ?? []) {
        if (!isFeatureEnabled(registry, req)) {
          checks.push({
            level: "fail",
            message: `Feature "${feat.id}" requires "${req}" (not enabled)`,
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (isFeatureEnabled(registry, "database")) {
    const schema = path.join(projectRoot, "configs", "db", "schema.prisma");
    if (fs.existsSync(schema)) {
      checks.push({ level: "ok", message: "Prisma schema present" });
    } else {
      checks.push({ level: "fail", message: "Missing configs/db/schema.prisma" });
    }

    const clientDir = path.join(
      projectRoot,
      "app",
      "models",
      "generated",
      "prisma",
      "client",
    );
    if (fs.existsSync(path.join(clientDir, "index.js"))) {
      checks.push({ level: "ok", message: "Prisma client generated" });
    } else {
      checks.push({
        level: "warn",
        message: "Prisma client missing — run pnpm db:generate",
      });
    }

    if (envHasKey(projectRoot, "DATABASE_URL")) {
      checks.push({ level: "ok", message: "DATABASE_URL in .env" });
    } else {
      checks.push({
        level: "warn",
        message: "DATABASE_URL not set — copy .env.example to .env",
      });
    }
  }

  if (isFeatureEnabled(registry, "session")) {
    if (envHasKey(projectRoot, "SESSION_SECRET")) {
      checks.push({ level: "ok", message: "SESSION_SECRET in .env" });
    } else {
      checks.push({
        level: "warn",
        message: "SESSION_SECRET not set — copy .env.example to .env",
      });
    }
  }

  if (homeFeaturesNeedSync(projectRoot)) {
    const { featureCount } = syncHomeFeatures(projectRoot);
    checks.push({
      level: "ok",
      message: `Home feature catalog synced (${featureCount} packs)`,
    });
  }

  printReport(checks);

  const failed = checks.some((c) => c.level === "fail");
  if (failed) process.exit(1);
}

function printReport(checks: Check[]): void {
  console.log("\nIrwin doctor\n");
  for (const c of checks) {
    const icon = c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✗";
    console.log(`  ${icon}  ${c.message}`);
  }
  console.log("");
}
