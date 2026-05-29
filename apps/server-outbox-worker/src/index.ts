import { SQSClient } from "@aws-sdk/client-sqs";
import { createPrismaClient } from "@repo/server-database";
import { OutboxRelay, SqsOutboxBroker } from "@repo/server-ingestion-infra";
import { createLogger, loadConfig } from "@repo/server-platform";
import { z } from "zod";

const workerConfigSchema = z.object({
  AWS_REGION: z.string().min(1),
  SQS_QUEUE_URL: z.url(),
  OUTBOX_RELAY_BATCH_SIZE: z.coerce.number().int().positive().default(10),
  OUTBOX_RELAY_IDLE_DELAY_MS: z.coerce.number().int().positive().default(1000),
});

export type WorkerConfig = z.infer<typeof workerConfigSchema>;

/**
 * Worker-only env, kept out of the shared platform config so the HTTP service
 * needn't carry SQS settings. Throws on invalid config — fail-fast at boot.
 */
export function loadWorkerConfig(
  env: NodeJS.ProcessEnv = process.env,
): WorkerConfig {
  const result = workerConfigSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid worker configuration: ${result.error.message}`);
  }
  return result.data;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const config = loadConfig();
  const workerConfig = loadWorkerConfig();
  const logger = createLogger(config);
  const prisma = createPrismaClient(config);
  const sqs = new SQSClient({ region: workerConfig.AWS_REGION });
  const broker = new SqsOutboxBroker(sqs, workerConfig.SQS_QUEUE_URL);
  const relay = new OutboxRelay(
    prisma,
    broker,
    workerConfig.OUTBOX_RELAY_BATCH_SIZE,
  );

  let running = true;
  const stop = (signal: string): void => {
    logger.info({ signal }, "outbox relay received shutdown signal");
    running = false;
  };
  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));

  logger.info("outbox relay started");
  while (running) {
    try {
      const relayed = await relay.relayBatch();
      if (relayed > 0) logger.info({ relayed }, "relayed outbox messages");
      // A full batch likely means more is waiting, so loop straight back to drain
      // it; a short batch means the outbox is empty, so idle before polling again.
      if (relayed < workerConfig.OUTBOX_RELAY_BATCH_SIZE) {
        await sleep(workerConfig.OUTBOX_RELAY_IDLE_DELAY_MS);
      }
    } catch (error) {
      logger.error(
        { error },
        "outbox relay batch failed; retrying after delay",
      );
      await sleep(workerConfig.OUTBOX_RELAY_IDLE_DELAY_MS);
    }
  }

  await prisma.$disconnect();
  sqs.destroy();
  logger.info("outbox relay stopped");
}

if (import.meta.main) {
  await main();
}
