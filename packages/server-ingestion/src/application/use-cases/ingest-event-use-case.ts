import { EntityMetadata, okResult, type Clock } from "@repo/server-kernel";

import type {
  IngestEventPortInput,
  IngestEventPortOutput,
  IngestEventPort,
} from "../ports/inbound/ingest-event-port.ts";
import type { UnitOfWorkPort } from "../ports/outbound/unit-of-work-port.ts";

import { Event } from "../../domain/aggregates/event.ts";

class IngestEventUseCase implements IngestEventPort {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly clock: Clock,
  ) {}

  async execute(input: IngestEventPortInput): IngestEventPortOutput {
    const eventResult = Event.create({
      tenant: input.tenant,
      metadata: EntityMetadata.create(this.clock.now()),
      payload: input.payload,
    });

    if (!eventResult.ok) {
      return eventResult;
    }
    const event = eventResult.value;

    // TODO: Check events size and handle differently

    await this.uow.transaction(async ({ eventRepository }) => {
      await eventRepository.insert(event);
    });

    return okResult({ id: event.id.toString() });
  }
}

export { IngestEventUseCase };
