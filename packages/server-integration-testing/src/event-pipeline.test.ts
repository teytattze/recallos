import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  type SQSClient,
} from "@aws-sdk/client-sqs";
import { IngestEventUseCase } from "@repo/server-ingestion";
import {
  OutboxRelay,
  PrismaUnitOfWork,
  SqsOutboxBroker,
} from "@repo/server-ingestion-infra";
import { fixedClock } from "@repo/server-kernel";
import { beforeEach, expect, test } from "bun:test";

import { harness } from "./harness/index.ts";

const recordedAt = new Date("2026-05-30T12:00:00.000Z");
const occurredAt = new Date("2026-05-30T11:59:00.000Z");

const ingestInput = {
  occurredAt,
  tags: { source: "slack", type: "message" },
  body: { text: "hello from the integration suite", channel: "C123" },
};

// Each test starts from an empty cluster + queue so assertions about row counts
// and queue contents are deterministic regardless of order.
beforeEach(async () => {
  const { prisma, sqs, queueUrl } = harness();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "events", "event_outbox" RESTART IDENTITY CASCADE',
  );
  await drainQueue(sqs, queueUrl);
});

test("IngestEventUseCase over PrismaUnitOfWork: given a valid event, it should persist an events row and a pending outbox row in one transaction", async () => {
  // given
  const { prisma } = harness();
  const useCase = new IngestEventUseCase(
    new PrismaUnitOfWork(prisma),
    fixedClock(recordedAt),
  );

  // when
  const result = await useCase.execute(ingestInput);

  // then
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected ingest to succeed");
  const { eventId } = result.value;

  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
  });
  expect(event).toMatchObject({
    occurredAt,
    recordedAt,
    tags: ingestInput.tags,
    body: ingestInput.body,
  });

  const outbox = await prisma.eventOutbox.findMany();
  expect(outbox).toHaveLength(1);
  expect(outbox[0]).toMatchObject({
    eventId,
    occurredAt,
    recordedAt,
    tags: ingestInput.tags,
    status: "pending",
    sentAt: null,
  });
});

test("OutboxRelay over SqsOutboxBroker: given a pending outbox row, it should publish it to SQS and mark the row sent", async () => {
  // given
  const { prisma, sqs, queueUrl } = harness();
  const useCase = new IngestEventUseCase(
    new PrismaUnitOfWork(prisma),
    fixedClock(recordedAt),
  );
  const ingest = await useCase.execute(ingestInput);
  if (!ingest.ok) throw new Error("expected ingest to succeed");
  const { eventId } = ingest.value;

  const relay = new OutboxRelay(prisma, new SqsOutboxBroker(sqs, queueUrl), 10);

  // when
  const relayed = await relay.relayBatch();

  // then
  expect(relayed).toBe(1);

  const outbox = await prisma.eventOutbox.findFirstOrThrow();
  expect(outbox.status).toBe("sent");
  expect(outbox.sentAt).not.toBeNull();

  const message = await receiveOne(sqs, queueUrl, 5);
  expect(message).not.toBeNull();
  expect(JSON.parse(message ?? "")).toMatchObject({
    eventId,
    tags: ingestInput.tags,
    body: ingestInput.body,
    occurredAt: occurredAt.toISOString(),
    recordedAt: recordedAt.toISOString(),
  });
});

test("OutboxRelay: given rows it already marked sent, it should not republish them on the next pass", async () => {
  // given
  const { prisma, sqs, queueUrl } = harness();
  const useCase = new IngestEventUseCase(
    new PrismaUnitOfWork(prisma),
    fixedClock(recordedAt),
  );
  const ingest = await useCase.execute(ingestInput);
  if (!ingest.ok) throw new Error("expected ingest to succeed");
  const relay = new OutboxRelay(prisma, new SqsOutboxBroker(sqs, queueUrl), 10);

  // when
  const first = await relay.relayBatch();
  const second = await relay.relayBatch();

  // then
  expect(first).toBe(1);
  expect(second).toBe(0);
});

/** Long-polls one message and removes it, or returns null if the queue is empty. */
async function receiveOne(
  sqs: SQSClient,
  queueUrl: string,
  waitTimeSeconds: number,
): Promise<string | null> {
  const { Messages } = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: waitTimeSeconds,
    }),
  );
  const message = Messages?.[0];
  if (!message) return null;
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    }),
  );
  return message.Body ?? null;
}

async function drainQueue(sqs: SQSClient, queueUrl: string): Promise<void> {
  while ((await receiveOne(sqs, queueUrl, 1)) !== null) {
    // keep removing until the queue reports empty
  }
}
