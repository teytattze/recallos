import {
  errResult,
  okResult,
  type Clock,
  type Result,
} from "@repo/server-kernel";

import type {
  IngestEventUseCaseInput,
  IngestEventUseCaseOutput,
  IngestEventUseCasePort,
} from "../ports/inbound/ingest-event-use-case.port.ts";
import type { UnitOfWorkPort } from "../ports/outbound/unit-of-work.port.ts";

import { Event } from "../../domain/event.aggregate.ts";
import { InvalidEvent } from "../../domain/invalid-event.error.ts";

const SQS_MAX_MESSAGE_BODY_BYTES = 262_144;

export class IngestEventUseCase implements IngestEventUseCasePort {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: IngestEventUseCaseInput,
  ): Promise<Result<IngestEventUseCaseOutput>> {
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
      return errResult(
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
    return okResult({ eventId: event.id.value });
  }
}
