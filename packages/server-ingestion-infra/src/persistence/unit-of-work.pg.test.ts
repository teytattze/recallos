import type { PrismaClient } from "@repo/server-database";

import { Event } from "@repo/server-ingestion";
import { EntityMetadata, Tenant } from "@repo/server-kernel";
import { expect, mock, test } from "bun:test";

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
  // given
  const eventCreate = mock(() => Promise.resolve());
  const outboxCreate = mock(() => Promise.resolve());
  const tx = {
    event: { create: eventCreate },
    eventOutbox: { create: outboxCreate },
  };
  const $transaction = mock((fn: (client: typeof tx) => Promise<unknown>) =>
    fn(tx),
  );
  const prisma = { $transaction } as unknown as PrismaClient;
  const uow = new PrismaUnitOfWork(prisma);
  const event = buildEvent();

  // when
  await uow.transaction(async ({ events, publisher }) => {
    await events.insert(event);
    await publisher.publish(event);
  });

  // then
  expect($transaction).toHaveBeenCalledTimes(1);
  expect(eventCreate).toHaveBeenCalledTimes(1);
  expect(outboxCreate).toHaveBeenCalledTimes(1);
});
