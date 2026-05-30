import type { SQSClient } from "@aws-sdk/client-sqs";

import { createPrismaClient, type PrismaClient } from "@repo/server-database";

import { startFloci, type StartedFloci } from "./floci-container.ts";
import { startPostgres, type StartedPostgres } from "./postgres-container.ts";

/** Live connections every test drives — all backed by real containers, no fakes. */
export interface Harness {
  prisma: PrismaClient;
  sqs: SQSClient;
  queueUrl: string;
  databaseUrl: string;
  sqsEndpoint: string;
}

interface RunningHarness {
  harness: Harness;
  postgres: StartedPostgres;
  floci: StartedFloci;
}

// Module-scoped singleton: the preload starts it once and every test file imports
// this same module instance to reach the shared connections.
let running: RunningHarness | undefined;

export function harness(): Harness {
  if (!running) {
    throw new Error(
      "integration harness not started — is src/setup.ts preloaded (bunfig.toml)?",
    );
  }
  return running.harness;
}

export async function startHarness(): Promise<void> {
  if (running) return;

  // Postgres and floci are independent, so bring them up concurrently.
  const [postgres, floci] = await Promise.all([startPostgres(), startFloci()]);
  const prisma = createPrismaClient({ DATABASE_URL: postgres.databaseUrl });

  running = {
    postgres,
    floci,
    harness: {
      prisma,
      sqs: floci.sqs,
      queueUrl: floci.queueUrl,
      databaseUrl: postgres.databaseUrl,
      sqsEndpoint: floci.endpoint,
    },
  };
}

export async function stopHarness(): Promise<void> {
  if (!running) return;
  const { harness, postgres, floci } = running;
  running = undefined;

  await harness.prisma.$disconnect();
  harness.sqs.destroy();
  await Promise.all([postgres.container.stop(), floci.container.stop()]);
}
