import { PrismaPg } from "@prisma/adapter-pg";

import type { AppConfig } from "./config.ts";

import { PrismaClient } from "./generated/client.ts";

/**
 * The PrismaClient (over the `pg` adapter) is the cluster's connection pool and
 * unit-of-work in one — built once at the composition root, injected into the
 * *-infra repositories.
 */
export function createPrismaClient(
  config: Pick<AppConfig, "DATABASE_URL">,
): PrismaClient {
  const adapter = new PrismaPg({ connectionString: config.DATABASE_URL });
  return new PrismaClient({ adapter });
}
