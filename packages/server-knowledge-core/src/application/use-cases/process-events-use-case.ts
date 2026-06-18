import { Tenant, type Clock } from "@repo/server-kernel";

import type {
  ProcessEventsPort,
  ProcessEventsPortInput,
  ProcessEventsPortOutput,
} from "../ports/inbound/process-events-port.ts";
import type { EmbeddingGatewayPort } from "../ports/outbound/embedding-gateway-port.ts";
import type { GraphNodeRepositoryPort } from "../ports/outbound/graph-node-repository-port.ts";
import type { GraphRepositoryPort } from "../ports/outbound/graph-repository-port.ts";

import { GraphNode } from "../../domain/aggregates/graph-node.ts";
import { createGraphNotFoundError } from "../../domain/errors/graph-not-found-error.ts";
import { GraphId } from "../../domain/value-objects/graph-id.ts";

class ProcessEventsUseCase implements ProcessEventsPort {
  constructor(
    private readonly clock: Clock,
    private readonly embeddingGateway: EmbeddingGatewayPort,
    private readonly graphRepository: GraphRepositoryPort,
    private readonly graphNodeRepository: GraphNodeRepositoryPort,
  ) {}

  async execute(input: ProcessEventsPortInput): ProcessEventsPortOutput {
    const now = this.clock.now();
    const tenant = Tenant.fromString(input.tenant);
    const graphId = GraphId.restore({ payload: input.payload.graphId });

    const graph = await this.graphRepository.findById({
      id: graphId,
      tenant,
    });

    if (graph === null) {
      throw createGraphNotFoundError("Graph not found", {
        id: input.payload.graphId,
        tenant: input.tenant,
      });
    }

    // TODO: handle individual failure
    const rawEventsEmbeddingResult = await this.embeddingGateway.embed({
      dimension: graph.embeddingMetadata.dimension,
      model: graph.embeddingMetadata.model,
      texts: input.payload.events.map((event) => JSON.stringify(event.raw)),
    });

    const graphNodes = input.payload.events.map((event, i) => {
      const rawEventEmbedding = rawEventsEmbeddingResult.embeddings[i];

      // TODO: throw
      if (rawEventEmbedding === undefined) {
        throw new Error("");
      }
      return GraphNode.create({
        tenant: input.tenant,
        metadata: { now },
        payload: {
          embedding: rawEventEmbedding,
          eventId: event.id,
          graphId: input.payload.graphId,
          rawEvent: event.raw,
        },
      });
    });

    // TODO: handle individual failure
    await this.graphNodeRepository.insertMany({ data: graphNodes });
  }
}

export { ProcessEventsUseCase };
