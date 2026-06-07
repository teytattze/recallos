import { createFixedClock, Tenant } from "@repo/server-kernel";
import { test, expect } from "bun:test";

import type { Event } from "../../domain/aggregates/event.ts";
import type { EventLogRepositoryPort } from "../ports/outbound/event-log-repository-port.ts";
import type { EventPublisherPort } from "../ports/outbound/event-publisher-port.ts";
import type {
  UnitOfWorkPortContext,
  UnitOfWorkPort,
} from "../ports/outbound/unit-of-work-port.ts";

import { IngestEventUseCase } from "./ingest-event-use-case.ts";

class FakeEventLogRepository implements EventLogRepositoryPort {
  readonly appended: Event[] = [];

  insert(event: Event): Promise<void> {
    this.appended.push(event);
    return Promise.resolve();
  }
}

class FakeEventPublisher implements EventPublisherPort {
  readonly published: Event[] = [];

  publish(event: Event): Promise<void> {
    this.published.push(event);
    return Promise.resolve();
  }
}

/** Records whether the work ran inside a transaction so tests can assert that the
 *  insert and the outbox write are enlisted together. */
class FakeUnitOfWork implements UnitOfWorkPort {
  readonly events = new FakeEventLogRepository();
  readonly publisher = new FakeEventPublisher();
  ran = 0;

  transaction<T>(work: (ctx: UnitOfWorkPortContext) => Promise<T>): Promise<T> {
    this.ran += 1;
    return work({ events: this.events, publisher: this.publisher });
  }
}

const createdAt = new Date("2026-01-02T00:00:00Z");
const tenant = Tenant.create("organization", "org1");
const graphId = "01952d3f-0000-7000-8000-000000000100";

const validInput = {
  tenant,
  payload: {
    occurredAt: new Date("2026-01-01T00:00:00Z"),
    tags: { source: "slack" },
    body: { text: "hello" },
    graphId,
  },
};

test("IngestEventUseCase.execute: given valid input, it should append and publish the event in one transaction", async () => {
  // GIVEN
  const uow = new FakeUnitOfWork();
  const useCase = new IngestEventUseCase(uow, createFixedClock(createdAt));

  // WHEN
  const result = await useCase.execute(validInput);

  // THEN
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(uow.ran).toBe(1);
  expect(uow.events.appended.length).toBe(1);
  expect(result.value.eventId).toBe(uow.events.appended[0]!.id.value);
  expect(uow.publisher.published.length).toBe(1);
  expect(uow.publisher.published[0]!.id.value).toBe(
    uow.events.appended[0]!.id.value,
  );
  expect(uow.events.appended[0]!.metadata.createdAt).toEqual(createdAt);
  expect(uow.events.appended[0]!.tenant).toBe(tenant);
  expect(uow.events.appended[0]!.graphId.value).toBe(graphId);
});

test("IngestEventUseCase.execute: given an invalid event, it should return an InvalidEvent error without appending or publishing", async () => {
  // GIVEN
  const uow = new FakeUnitOfWork();
  const useCase = new IngestEventUseCase(uow, createFixedClock(createdAt));
  const future = new Date(createdAt.getTime() + 1000);

  // WHEN
  const result = await useCase.execute({
    ...validInput,
    payload: { ...validInput.payload, occurredAt: future },
  });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidEvent");
  expect(uow.ran).toBe(0);
  expect(uow.events.appended.length).toBe(0);
  expect(uow.publisher.published.length).toBe(0);
});

test("IngestEventUseCase.execute: given an event too large for SQS publication, it should reject without appending or publishing", async () => {
  // GIVEN
  const uow = new FakeUnitOfWork();
  const useCase = new IngestEventUseCase(uow, createFixedClock(createdAt));

  // WHEN
  const result = await useCase.execute({
    ...validInput,
    payload: {
      ...validInput.payload,
      body: { text: "x".repeat(262_144) },
    },
  });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidEvent");
  expect(uow.ran).toBe(0);
  expect(uow.events.appended.length).toBe(0);
  expect(uow.publisher.published.length).toBe(0);
});
