import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@db";
import path from "path";
import { getPackageRootSync } from "@configs/loadDotenv";

function resolveDatabaseUrl(): string {
  const raw = (process.env.DATABASE_URL || "file:./database/app.db").trim();
  if (raw.startsWith("file:")) {
    const rel = raw.replace(/^file:\.?\/?/, "");
    return path.join(getPackageRootSync(), rel);
  }
  return raw;
}

const adapter = new PrismaBetterSqlite3({ url: resolveDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

export default prisma;
