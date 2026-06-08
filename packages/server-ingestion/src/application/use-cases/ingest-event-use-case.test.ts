import type { JsonObject } from "type-fest";

import { createFixedClock, Tenant } from "@repo/server-kernel";
import { test, expect } from "bun:test";

import type { Event } from "../../domain/aggregates/event.ts";
import type { EventExternalPropsIn } from "../../domain/value-objects/event-external.ts";
import type { EventRepositoryPort } from "../ports/outbound/event-repository-port.ts";
import type {
  UnitOfWorkPortContext,
  UnitOfWorkPort,
} from "../ports/outbound/unit-of-work-port.ts";

import { IngestEventUseCase } from "./ingest-event-use-case.ts";

class FakeEventRepository implements EventRepositoryPort {
  readonly inserted: Event[] = [];

  insert(event: Event): Promise<void> {
    this.inserted.push(event);
    return Promise.resolve();
  }
}

class FakeUnitOfWork implements UnitOfWorkPort {
  readonly events = new FakeEventRepository();
  ran = 0;

  transaction<T>(work: (ctx: UnitOfWorkPortContext) => Promise<T>): Promise<T> {
    this.ran += 1;
    return work({ eventRepository: this.events });
  }
}

const createdAt = new Date("2026-01-02T00:00:00Z");
const tenant = Tenant.create("organization", "org1");
const graphId = "01952d3f-0000-7000-8000-000000000100";
const external = {
  id: "jira-123",
  provider: "jira",
} satisfies EventExternalPropsIn;
const raw = {
  issue: { key: "REC-123", summary: "hello" },
} satisfies JsonObject;

const validInput = {
  tenant,
  payload: {
    external,
    graphId,
    raw,
  },
};

test("IngestEventUseCase.execute: given valid input, it should insert the event in one transaction", async () => {
  // GIVEN
  const uow = new FakeUnitOfWork();
  const useCase = new IngestEventUseCase(uow, createFixedClock(createdAt));

  // WHEN
  const result = await useCase.execute(validInput);

  // THEN
  expect(uow.ran).toBe(1);
  expect(uow.events.inserted.length).toBe(1);
  expect(result.id).toBe(uow.events.inserted[0]!.id.value);
  expect(uow.events.inserted[0]!.metadata.createdAt).toEqual(createdAt);
  expect(uow.events.inserted[0]!.tenant).toBe(tenant);
  expect(String(uow.events.inserted[0]!.external.toJSON().id)).toBe(
    external.id,
  );
  expect(String(uow.events.inserted[0]!.external.toJSON().provider)).toBe(
    external.provider,
  );
  expect(uow.events.inserted[0]!.graphId.value).toBe(graphId);
  expect(uow.events.inserted[0]!.raw).toEqual(raw);
});

test("IngestEventUseCase.execute: given an invalid event, it should throw an InvalidEvent error without inserting", async () => {
  // GIVEN
  const uow = new FakeUnitOfWork();
  const useCase = new IngestEventUseCase(uow, createFixedClock(createdAt));
  let error: unknown;

  // WHEN
  try {
    await useCase.execute({
      ...validInput,
      payload: {
        ...validInput.payload,
        external: {
          id: "jira-123",
          provider: "github",
        } as unknown as EventExternalPropsIn,
      },
    });
  } catch (caught) {
    error = caught;
  }

  // THEN
  expect(error).toMatchObject({ kind: "InvalidEvent" });
  expect(uow.ran).toBe(0);
  expect(uow.events.inserted.length).toBe(0);
});
