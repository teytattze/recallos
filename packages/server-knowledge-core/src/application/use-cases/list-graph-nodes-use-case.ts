import { Tenant } from "@repo/server-kernel";

import type {
  ListGraphNodesPort,
  ListGraphNodesPortInput,
  ListGraphNodesPortOutput,
} from "../ports/inbound/list-graph-nodes-port.ts";
import type { GraphNodeRepositoryPort } from "../ports/outbound/graph-node-repository-port.ts";

import { EventId } from "../../domain/value-objects/event-id.ts";
import { GraphId } from "../../domain/value-objects/graph-id.ts";

class ListGraphNodesUseCase implements ListGraphNodesPort {
  constructor(private readonly graphNodeRepository: GraphNodeRepositoryPort) {}

  async execute(input: ListGraphNodesPortInput): ListGraphNodesPortOutput {
    const graphNodes = await this.graphNodeRepository.findMany({
      tenant: Tenant.fromString(input.tenant),
      filters: {
        eventId: EventId.restore({ payload: input.filters.eventId }),
        graphId: GraphId.restore({ payload: input.filters.graphId }),
      },
    });

    return {
      data: graphNodes.map((graphNode) => ({
        id: graphNode.id.toString(),
        tenant: graphNode.tenant.toString(),
        createdAt: graphNode.metadata.createdAt.toISOString(),
        updatedAt: graphNode.metadata.updatedAt.toISOString(),
        eventId: graphNode.eventId.toString(),
        graphId: graphNode.graphId.toString(),
        rawEvent: graphNode.rawEvent,
      })),
    };
  }
}

export { ListGraphNodesUseCase };
