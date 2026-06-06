import type { PrismaClient } from "@repo/server-database";

import { Event } from "@repo/server-ingestion";
import { EntityMetadata, Tenant } from "@repo/server-kernel";
import { expect, test } from "bun:test";

import { PrismaUnitOfWork } from "./unit-of-work.pg.ts";

const createdAt = new Date("2026-01-02T00:00:00Z");
const occurredAt = new Date("2026-01-01T00:00:00Z");

function buildEvent(): Event {
  return Event.restore({
    tenant: Tenant.create("organization", "org1"),
    metadata: EntityMetadata.restore(createdAt, createdAt),
    payload: {
      id: "01952d3f-0000-7000-8000-000000000000",
      occurredAt,
      tags: { source: "slack" },
      body: { text: "hello" },
    },
  });
}

test("PrismaUnitOfWork.transaction: given work that uses both ports, it should run it against the same transaction client", async () => {
  // GIVEN
  const eventCreateCalls: unknown[] = [];
  const outboxCreateCalls: unknown[] = [];
  const eventCreate = (args: unknown): Promise<void> => {
    eventCreateCalls.push(args);
    return Promise.resolve();
  };
  const outboxCreate = (args: unknown): Promise<void> => {
    outboxCreateCalls.push(args);
    return Promise.resolve();
  };
  const tx = {
    event: { create: eventCreate },
    eventOutbox: { create: outboxCreate },
  };
  let transactionCount = 0;
  const $transaction = (fn: (client: typeof tx) => Promise<unknown>) => {
    transactionCount += 1;
    return fn(tx);
  };
  const prisma = { $transaction } as unknown as PrismaClient;
  const uow = new PrismaUnitOfWork(prisma);
  const event = buildEvent();

  // WHEN
  await uow.transaction(async ({ events, publisher }) => {
    await events.insert(event);
    await publisher.publish(event);
  });

  // THEN
  expect(transactionCount).toBe(1);
  expect(eventCreateCalls).toHaveLength(1);
  expect(outboxCreateCalls).toHaveLength(1);
});
