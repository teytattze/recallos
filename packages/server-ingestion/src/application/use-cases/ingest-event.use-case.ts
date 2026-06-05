import { type Clock, Result } from "@repo/server-kernel";

import type {
  IngestEvent,
  IngestEventInput,
  IngestEventOutput,
} from "../ports/inbound/ingest-event.use-case.ts";
import type { UnitOfWork } from "../ports/outbound/unit-of-work.ts";

import { Event } from "../../domain/event.aggregate.ts";
import { InvalidEvent } from "../../domain/invalid-event.error.ts";

const SQS_MAX_MESSAGE_BODY_BYTES = 262_144;

export class IngestEventUseCase implements IngestEvent {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: IngestEventInput): Promise<Result<IngestEventOutput>> {
    const eventResult = Event.create({
      tenant: input.tenant,
      createdAt: this.clock.now(),
      occurredAt: input.payload.occurredAt,
      tags: input.payload.tags,
      body: input.payload.body,
    });
    if (!eventResult.ok) return eventResult;

    const event = eventResult.value;
    const publishMessage = {
      eventId: event.id.value,
      occurredAt: event.occurredAt,
      createdAt: event.metadata.createdAt,
      tags: event.tags.entries,
      body: event.body.value,
    };
    const publishMessageBytes = new TextEncoder().encode(
      JSON.stringify(publishMessage),
    ).length;
    if (publishMessageBytes > SQS_MAX_MESSAGE_BODY_BYTES) {
      return Result.err(
        InvalidEvent(
          `event publish payload must not exceed ${SQS_MAX_MESSAGE_BODY_BYTES} bytes`,
        ),
      );
    }

    // Insert and outbox-write must commit together, or a crash between them
    // would lose the notification or leave a phantom (see outbox decision record).
    await this.uow.transaction(async ({ events, publisher }) => {
      await events.insert(event);
      await publisher.publish(event);
    });
    return Result.ok({ eventId: event.id.value });
  }
}
