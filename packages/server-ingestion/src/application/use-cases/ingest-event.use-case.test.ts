import { fixedClock } from "@repo/server-kernel";
import { test, expect } from "bun:test";

import type { Event } from "../../domain/event.aggregate.ts";
import type { EventLogRepository } from "../ports/outbound/event-log.repository.ts";

import { IngestEventUseCase } from "./ingest-event.use-case.ts";

class FakeEventLogRepository implements EventLogRepository {
  readonly appended: Event[] = [];

  append(event: Event): Promise<void> {
    this.appended.push(event);
    return Promise.resolve();
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
  const repo = new FakeEventLogRepository();
  const useCase = new IngestEventUseCase(repo, fixedClock(recordedAt));

  // WHEN
  const result = await useCase.execute(validInput);

  // THEN
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(repo.appended.length).toBe(1);
  expect(result.value.eventId).toBe(repo.appended[0]!.id.value);
});

test("IngestEventUseCase.execute: given valid input, it should stamp the clock's time as the event's recordedAt", async () => {
  // GIVEN
  const repo = new FakeEventLogRepository();
  const useCase = new IngestEventUseCase(repo, fixedClock(recordedAt));

  // WHEN
  await useCase.execute(validInput);

  // THEN
  expect(repo.appended[0]!.metadata.createdAt).toEqual(recordedAt);
});

test("IngestEventUseCase.execute: given an invalid event, it should return an InvalidEvent error without appending", async () => {
  // GIVEN
  const repo = new FakeEventLogRepository();
  const useCase = new IngestEventUseCase(repo, fixedClock(recordedAt));
  const future = new Date(recordedAt.getTime() + 1000);

  // WHEN
  const result = await useCase.execute({ ...validInput, occurredAt: future });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidEvent");
  expect(repo.appended.length).toBe(0);
});
