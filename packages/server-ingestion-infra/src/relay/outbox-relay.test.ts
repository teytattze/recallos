import type { PrismaClient } from "@repo/server-database";

import { expect, test } from "bun:test";

import type { OutboxBroker } from "./outbox-broker.ts";

import { OutboxRelay } from "./outbox-relay.ts";

const occurredAt = new Date("2026-01-01T00:00:00Z");
const createdAt = new Date("2026-01-02T00:00:00Z");

function buildRow(id: string) {
  return {
    id,
    event_id: `event-${id}`,
    occurred_at: occurredAt,
    created_at: createdAt,
    tags: { source: "slack" },
    body: { text: `hello ${id}` },
  };
}

function buildPrisma(
  rows: ReturnType<typeof buildRow>[],
  updateMany: (args: unknown) => Promise<unknown>,
) {
  const tx = {
    $queryRaw: () => Promise.resolve(rows),
    eventOutbox: { updateMany },
  };
  return {
    $transaction: (work: (tx: unknown) => Promise<unknown>) => work(tx),
  } as unknown as PrismaClient;
}

test("OutboxRelay.relayBatch: given pending rows, it should publish each to the broker and mark them sent", async () => {
  // GIVEN
  const rows = [buildRow("1"), buildRow("2")];
  const updateManyCalls: unknown[] = [];
  const updateMany = (args: unknown): Promise<{ count: number }> => {
    updateManyCalls.push(args);
    return Promise.resolve({ count: 2 });
  };
  const prisma = buildPrisma(rows, updateMany);
  const publishedMessages: unknown[] = [];
  const publish = (message: unknown): Promise<void> => {
    publishedMessages.push(message);
    return Promise.resolve();
  };
  const broker = { publish } as OutboxBroker;
  const relay = new OutboxRelay(prisma, broker, 10);

  // WHEN
  const relayed = await relay.relayBatch();

  // THEN
  expect(relayed).toBe(2);
  expect(publishedMessages).toHaveLength(2);
  expect(publishedMessages[0]).toEqual({
    eventId: "event-1",
    occurredAt,
    createdAt,
    tags: { source: "slack" },
    body: { text: "hello 1" },
  });
  expect(updateManyCalls).toHaveLength(1);
  expect(updateManyCalls[0]).toEqual({
    where: { id: { in: ["1", "2"] } },
    data: { status: "sent", sentAt: expect.any(Date) },
  });
});

test("OutboxRelay.relayBatch: given no pending rows, it should publish nothing and return 0", async () => {
  // GIVEN
  const updateManyCalls: unknown[] = [];
  const updateMany = (args: unknown): Promise<{ count: number }> => {
    updateManyCalls.push(args);
    return Promise.resolve({ count: 0 });
  };
  const prisma = buildPrisma([], updateMany);
  const publishedMessages: unknown[] = [];
  const publish = (message: unknown): Promise<void> => {
    publishedMessages.push(message);
    return Promise.resolve();
  };
  const broker = { publish } as OutboxBroker;
  const relay = new OutboxRelay(prisma, broker, 10);

  // WHEN
  const relayed = await relay.relayBatch();

  // THEN
  expect(relayed).toBe(0);
  expect(publishedMessages).toHaveLength(0);
  expect(updateManyCalls).toHaveLength(0);
});

test("OutboxRelay.relayBatch: given the broker rejects, it should propagate and not mark any row sent", async () => {
  // GIVEN
  const updateManyCalls: unknown[] = [];
  const updateMany = (args: unknown): Promise<{ count: number }> => {
    updateManyCalls.push(args);
    return Promise.resolve({ count: 0 });
  };
  const prisma = buildPrisma([buildRow("1")], updateMany);
  const publish = (): Promise<void> => Promise.reject(new Error("sqs down"));
  const broker = { publish } as OutboxBroker;
  const relay = new OutboxRelay(prisma, broker, 10);

  // WHEN
  let caught: unknown;
  try {
    await relay.relayBatch();
  } catch (error) {
    caught = error;
  }

  // THEN
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).message).toBe("sqs down");
  expect(updateManyCalls).toHaveLength(0);
});
