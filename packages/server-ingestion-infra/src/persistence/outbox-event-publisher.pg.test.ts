import type { Prisma } from "@repo/server-database";

import { Event } from "@repo/server-ingestion";
import { EntityMetadata, Tenant } from "@repo/server-kernel";
import { expect, mock, test } from "bun:test";

import { OutboxEventPublisher } from "./outbox-event-publisher.pg.ts";

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

test("OutboxEventPublisher.publish: given an event, it should write relay metadata without duplicating the body", async () => {
  // given
  const create = mock(() => Promise.resolve());
  const tx = { eventOutbox: { create } } as unknown as Prisma.TransactionClient;
  const publisher = new OutboxEventPublisher(tx);
  const event = buildEvent();

  // when
  await publisher.publish(event);

  // then
  expect(create).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledWith({
    data: {
      eventId: event.id.value,
      occurredAt,
      createdAt,
      tags: { source: "slack" },
    },
  });
});
