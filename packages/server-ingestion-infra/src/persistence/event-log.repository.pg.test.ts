import type { PrismaClient } from "@repo/server-database";

import { Event } from "@repo/server-ingestion";
import { EntityMetadata, Tenant } from "@repo/server-kernel";
import { expect, mock, test } from "bun:test";

import { EventLogPostgresqlRepository } from "./event-log.repository.pg.ts";

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

test("EventLogPostgresqlRepository.insert: given an event, it should create a row mapping the aggregate's fields", async () => {
  // given
  const create = mock(() => Promise.resolve());
  const prisma = { event: { create } } as unknown as PrismaClient;
  const repo = new EventLogPostgresqlRepository(prisma);
  const event = buildEvent();

  // when
  await repo.insert(event);

  // then
  expect(create).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledWith({
    data: {
      id: event.id.value,
      occurredAt,
      createdAt,
      tags: { source: "slack" },
      body: { text: "hello" },
    },
  });
});
