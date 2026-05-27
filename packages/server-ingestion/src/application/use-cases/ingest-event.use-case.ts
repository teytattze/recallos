import { type Clock, Result } from "@repo/server-kernel";

import type {
  IngestEvent,
  IngestEventInput,
  IngestEventOutput,
} from "../ports/inbound/ingest-event.use-case.ts";
import type { EventLogRepository } from "../ports/outbound/event-log.repository.ts";

import { Event } from "../../domain/event.aggregate.ts";

export class IngestEventUseCase implements IngestEvent {
  constructor(
    private readonly events: EventLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: IngestEventInput): Promise<Result<IngestEventOutput>> {
    const eventResult = Event.create({
      recordedAt: this.clock.now(),
      occurredAt: input.occurredAt,
      tags: input.tags,
      body: input.body,
    });
    if (!eventResult.ok) return eventResult;

    const event = eventResult.value;
    await this.events.insert(event);
    return Result.ok({ eventId: event.id.value });
  }
}
