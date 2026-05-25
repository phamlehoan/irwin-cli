import { getPackageRootSync } from "@configs/loadDotenv";
import { PrismaClient } from "@db";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import fs from "node:fs";
import path from "node:path";

function strip(s: string | undefined): string {
  return (s ?? "").trim().replace(/^['"]|['"]$/g, "");
}

function tursoUrl(): string {
  return strip(process.env.TURSO_DATABASE_URL) || strip(process.env.DATABASE_URL);
}

function useTurso(): boolean {
  return tursoUrl().startsWith("libsql:");
}

function sqlitePath(): string {
  const raw = strip(process.env.DATABASE_URL) || "file:./database/app.db";
  const rel = raw.replace(/^file:\.?\/?/, "");
  return path.join(getPackageRootSync(), rel);
}

function prismaClientSingleton() {
  if (useTurso()) {
    const url = tursoUrl();
    const authToken = strip(process.env.TURSO_AUTH_TOKEN);
    if (!authToken) {
      throw new Error(
        "[prisma] Turso: set TURSO_DATABASE_URL=libsql://... and TURSO_AUTH_TOKEN",
      );
    }
    const adapter = new PrismaLibSql({ url, authToken });
    return new PrismaClient({ adapter });
  }

  const dbPath = sqlitePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

const models = prismaClientSingleton();
export default models;
