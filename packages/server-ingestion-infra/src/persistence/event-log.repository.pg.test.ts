import type { PrismaClient } from "@repo/server-database";

import { Event } from "@repo/server-ingestion";
import { EntityMetadata, Tenant } from "@repo/server-kernel";
import { expect, test } from "bun:test";

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
  // GIVEN
  const createCalls: unknown[] = [];
  const create = (args: unknown): Promise<void> => {
    createCalls.push(args);
    return Promise.resolve();
  };
  const prisma = { event: { create } } as unknown as PrismaClient;
  const repo = new EventLogPostgresqlRepository(prisma);
  const event = buildEvent();

  // WHEN
  await repo.insert(event);

  // THEN
  expect(createCalls).toHaveLength(1);
  expect(createCalls[0]).toEqual({
    data: {
      id: event.id.value,
      occurredAt,
      createdAt,
      tags: { source: "slack" },
      body: { text: "hello" },
    },
  });
});
