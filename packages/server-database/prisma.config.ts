import { defineConfig } from "prisma/config";

// One schema = one migration history for the consolidated Aurora cluster.
// Prisma 7 keeps the Migrate URL here, not in schema.prisma; read process.env
// directly (not prisma's `env()`, which throws when unset) so `generate`/`build`
// — which never connect — don't require DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
