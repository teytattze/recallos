import { Tenant } from "@repo/server-kernel";

import type {
  GetGraphNodeByEventIdPort,
  GetGraphNodeByEventIdPortInput,
  GetGraphNodeByEventIdPortOutput,
} from "../ports/inbound/get-graph-node-by-event-id-port.ts";
import type { GraphNodeRepositoryPort } from "../ports/outbound/graph-node-repository-port.ts";

import { createGraphNodeNotFoundError } from "../../domain/errors/graph-node-not-found-error.ts";
import { EventId } from "../../domain/value-objects/event-id.ts";

class GetGraphNodeByEventIdUseCase implements GetGraphNodeByEventIdPort {
  constructor(private readonly graphNodeRepository: GraphNodeRepositoryPort) {}

  async execute(
    input: GetGraphNodeByEventIdPortInput,
  ): GetGraphNodeByEventIdPortOutput {
    const tenant = Tenant.fromString(input.tenant);
    const eventId = EventId.restore({ payload: input.payload.eventId });
    const graphNode = await this.graphNodeRepository.findByEventId({
      eventId,
      tenant,
    });

    if (graphNode === null) {
      throw createGraphNodeNotFoundError("Graph node not found", {
        eventId: input.payload.eventId,
        tenant: input.tenant,
      });
    }

    return {
      id: graphNode.id.toString(),
      tenant: graphNode.tenant.toString(),
      createdAt: graphNode.metadata.createdAt.toISOString(),
      updatedAt: graphNode.metadata.updatedAt.toISOString(),
      eventId: graphNode.eventId.toString(),
      graphId: graphNode.graphId.toString(),
      rawEvent: graphNode.rawEvent,
    };
  }
}

export { GetGraphNodeByEventIdUseCase };
