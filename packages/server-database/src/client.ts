import type { AppConfig } from "@repo/server-platform";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client.ts";

/**
 * The PrismaClient (over the `pg` driver adapter) is the cluster's connection
 * pool and unit-of-work in one — composition roots build it once and inject it
 * into the *-infra repositories.
 */
export function createPrismaClient(
  config: Pick<AppConfig, "DATABASE_URL">,
): PrismaClient {
  const adapter = new PrismaPg({ connectionString: config.DATABASE_URL });
  return new PrismaClient({ adapter });
}
