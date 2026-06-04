import type { PrismaClient } from "@repo/server-database";

import { expect, mock, test } from "bun:test";

import type { OutboxBroker } from "./outbox-broker.ts";

import { OutboxRelay } from "./outbox-relay.ts";

const occurredAt = new Date("2026-01-01T00:00:00Z");
const recordedAt = new Date("2026-01-02T00:00:00Z");

function buildRow(id: string) {
  return {
    id,
    event_id: `event-${id}`,
    occurred_at: occurredAt,
    recorded_at: recordedAt,
    tags: { source: "slack" },
    body: { text: `hello ${id}` },
  };
}

/** A Prisma stub whose `$transaction` runs the work against a tx that returns
 *  `rows` from the claim query — so the relay can be driven without a database. */
function buildPrisma(
  rows: ReturnType<typeof buildRow>[],
  updateMany: (args: unknown) => Promise<unknown>,
) {
  const tx = {
    $queryRaw: mock(() => Promise.resolve(rows)),
    eventOutbox: { updateMany },
  };
  return {
    $transaction: (work: (tx: unknown) => Promise<unknown>) => work(tx),
  } as unknown as PrismaClient;
}

test("OutboxRelay.relayBatch: given pending rows, it should publish each to the broker and mark them sent", async () => {
  // given
  const rows = [buildRow("1"), buildRow("2")];
  const updateMany = mock((_args: unknown) => Promise.resolve({ count: 2 }));
  const prisma = buildPrisma(rows, updateMany);
  const publish = mock((_message: unknown) => Promise.resolve());
  const broker = { publish } as OutboxBroker;
  const relay = new OutboxRelay(prisma, broker, 10);

  // when
  const relayed = await relay.relayBatch();

  // then
  expect(relayed).toBe(2);
  expect(publish).toHaveBeenCalledTimes(2);
  expect(publish).toHaveBeenNthCalledWith(1, {
    eventId: "event-1",
    occurredAt,
    recordedAt,
    tags: { source: "slack" },
    body: { text: "hello 1" },
  });
  expect(updateMany).toHaveBeenCalledTimes(1);
  expect(updateMany.mock.calls[0]?.[0]).toEqual({
    where: { id: { in: ["1", "2"] } },
    data: { status: "sent", sentAt: expect.any(Date) },
  });
});

test("OutboxRelay.relayBatch: given no pending rows, it should publish nothing and return 0", async () => {
  // given
  const updateMany = mock((_args: unknown) => Promise.resolve({ count: 0 }));
  const prisma = buildPrisma([], updateMany);
  const publish = mock((_message: unknown) => Promise.resolve());
  const broker = { publish } as OutboxBroker;
  const relay = new OutboxRelay(prisma, broker, 10);

  // when
  const relayed = await relay.relayBatch();

  // then
  expect(relayed).toBe(0);
  expect(publish).not.toHaveBeenCalled();
  expect(updateMany).not.toHaveBeenCalled();
});

test("OutboxRelay.relayBatch: given the broker rejects, it should propagate and not mark any row sent", async () => {
  // given — a publish failure must abort before mark-sent so the row stays pending
  const updateMany = mock((_args: unknown) => Promise.resolve({ count: 0 }));
  const prisma = buildPrisma([buildRow("1")], updateMany);
  const publish = mock((_message: unknown) =>
    Promise.reject(new Error("sqs down")),
  );
  const broker = { publish } as OutboxBroker;
  const relay = new OutboxRelay(prisma, broker, 10);

  // when
  let caught: unknown;
  try {
    await relay.relayBatch();
  } catch (error) {
    caught = error;
  }

  // then
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).message).toBe("sqs down");
  expect(updateMany).not.toHaveBeenCalled();
});
