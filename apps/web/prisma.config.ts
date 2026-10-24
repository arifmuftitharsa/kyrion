import { loadEnvConfig } from "@next/env";
import { defineConfig, env } from "prisma/config";

// Prisma CLI v7 tidak memuat file env sendiri; pakai loader Next.js agar
// urutan berkas (.env.local, .env, ...) sama dengan aplikasi.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
