import {
  EntityMetadata,
  errResult,
  okResult,
  type Clock,
  type Result,
} from "@repo/server-kernel";

import type {
  IngestEventPortInput,
  IngestEventPortOutput,
  IngestEventPort,
} from "../ports/inbound/ingest-event-port.ts";
import type { UnitOfWorkPort } from "../ports/outbound/unit-of-work-port.ts";

import { Event } from "../../domain/aggregates/event.ts";
import { createInvalidEventError } from "../../domain/errors/invalid-event-error.ts";

const SQS_MAX_MESSAGE_BODY_BYTES = 262_144;

class IngestEventUseCase implements IngestEventPort {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: IngestEventPortInput,
  ): Promise<Result<IngestEventPortOutput>> {
    const eventResult = Event.create({
      tenant: input.tenant,
      metadata: EntityMetadata.create(this.clock.now()),
      payload: input.payload,
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
        createInvalidEventError(
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

export { IngestEventUseCase };
