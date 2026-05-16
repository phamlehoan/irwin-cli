import { loadDotenv } from "./configs/loadDotenv";

loadDotenv();
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "configs/db/schema.prisma",
  migrations: {
    path: "configs/db/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "file:./database/app.db",
  },
});
