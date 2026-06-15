import type { Event } from "../../../domain/aggregates/event.ts";

type EventRepositoryPortInsertInput = {
  data: Event;
};
type EventRepositoryPortInsertOutput = Promise<void>;

interface EventRepositoryPort {
  insert(input: EventRepositoryPortInsertInput): EventRepositoryPortInsertOutput;
}

export type {
  EventRepositoryPort,
  EventRepositoryPortInsertInput,
  EventRepositoryPortInsertOutput,
};
