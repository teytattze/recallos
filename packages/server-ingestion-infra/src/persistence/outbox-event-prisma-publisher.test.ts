import type { Prisma } from "@repo/server-database";

import { Event } from "@repo/server-ingestion";
import { EntityMetadata, Tenant } from "@repo/server-kernel";
import { expect, test } from "bun:test";

import { OutboxEventPrismaPublisher } from "./outbox-event-prisma-publisher.ts";

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

test("OutboxEventPrismaPublisher.publish: given an event, it should write relay metadata without duplicating the body", async () => {
  // GIVEN
  const createCalls: unknown[] = [];
  const create = (args: unknown): Promise<void> => {
    createCalls.push(args);
    return Promise.resolve();
  };
  const tx = { eventOutbox: { create } } as unknown as Prisma.TransactionClient;
  const publisher = new OutboxEventPrismaPublisher(tx);
  const event = buildEvent();

  // WHEN
  await publisher.publish(event);

  // THEN
  expect(createCalls).toHaveLength(1);
  expect(createCalls[0]).toEqual({
    data: {
      eventId: event.id.value,
      occurredAt,
      createdAt,
      tags: { source: "slack" },
    },
  });
});
