import { fixedClock } from "@repo/server-kernel";
import { test, expect } from "bun:test";

import type { Event } from "../../domain/event.aggregate.ts";
import type { EventLogRepository } from "../ports/outbound/event-log.repository.ts";
import type { EventPublisher } from "../ports/outbound/event-publisher.ts";
import type {
  IngestionContext,
  UnitOfWork,
} from "../ports/outbound/unit-of-work.ts";

import { IngestEventUseCase } from "./ingest-event.use-case.ts";

class FakeEventLogRepository implements EventLogRepository {
  readonly appended: Event[] = [];

  insert(event: Event): Promise<void> {
    this.appended.push(event);
    return Promise.resolve();
  }
}

class FakeEventPublisher implements EventPublisher {
  readonly published: Event[] = [];

  publish(event: Event): Promise<void> {
    this.published.push(event);
    return Promise.resolve();
  }
}

/** Records whether the work ran inside a transaction so tests can assert that the
 *  insert and the outbox write are enlisted together. */
class FakeUnitOfWork implements UnitOfWork {
  readonly events = new FakeEventLogRepository();
  readonly publisher = new FakeEventPublisher();
  ran = 0;

  transaction<T>(work: (ctx: IngestionContext) => Promise<T>): Promise<T> {
    this.ran += 1;
    return work({ events: this.events, publisher: this.publisher });
  }
}

const recordedAt = new Date("2026-01-02T00:00:00Z");

const validInput = {
  occurredAt: new Date("2026-01-01T00:00:00Z"),
  tags: { source: "slack" },
  body: { text: "hello" },
};

test("IngestEventUseCase.execute: given valid input, it should append the event and return its id", async () => {
  // GIVEN
  const uow = new FakeUnitOfWork();
  const useCase = new IngestEventUseCase(uow, fixedClock(recordedAt));

  // WHEN
  const result = await useCase.execute(validInput);

  // THEN
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(uow.events.appended.length).toBe(1);
  expect(result.value.eventId).toBe(uow.events.appended[0]!.id.value);
});

test("IngestEventUseCase.execute: given valid input, it should publish the same event through the outbox in one transaction", async () => {
  // GIVEN
  const uow = new FakeUnitOfWork();
  const useCase = new IngestEventUseCase(uow, fixedClock(recordedAt));

  // WHEN
  await useCase.execute(validInput);

  // THEN
  expect(uow.ran).toBe(1);
  expect(uow.publisher.published.length).toBe(1);
  expect(uow.publisher.published[0]!.id.value).toBe(
    uow.events.appended[0]!.id.value,
  );
});

test("IngestEventUseCase.execute: given valid input, it should stamp the clock's time as the event's recordedAt", async () => {
  // GIVEN
  const uow = new FakeUnitOfWork();
  const useCase = new IngestEventUseCase(uow, fixedClock(recordedAt));

  // WHEN
  await useCase.execute(validInput);

  // THEN
  expect(uow.events.appended[0]!.metadata.createdAt).toEqual(recordedAt);
});

test("IngestEventUseCase.execute: given an invalid event, it should return an InvalidEvent error without appending or publishing", async () => {
  // GIVEN
  const uow = new FakeUnitOfWork();
  const useCase = new IngestEventUseCase(uow, fixedClock(recordedAt));
  const future = new Date(recordedAt.getTime() + 1000);

  // WHEN
  const result = await useCase.execute({ ...validInput, occurredAt: future });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidEvent");
  expect(uow.ran).toBe(0);
  expect(uow.events.appended.length).toBe(0);
  expect(uow.publisher.published.length).toBe(0);
});
