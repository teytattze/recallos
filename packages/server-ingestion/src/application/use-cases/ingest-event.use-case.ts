import { type Clock, Result } from "@repo/server-kernel";

import type {
  IngestEvent,
  IngestEventInput,
  IngestEventOutput,
} from "../ports/inbound/ingest-event.use-case.ts";
import type { UnitOfWork } from "../ports/outbound/unit-of-work.ts";

import { Event } from "../../domain/event.aggregate.ts";

export class IngestEventUseCase implements IngestEvent {
  constructor(
    private readonly uow: UnitOfWork,
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
    // Insert and outbox-write must commit together, or a crash between them
    // would lose the notification or leave a phantom (see outbox decision record).
    await this.uow.transaction(async ({ events, publisher }) => {
      await events.insert(event);
      await publisher.publish(event);
    });
    return Result.ok({ eventId: event.id.value });
  }
}
