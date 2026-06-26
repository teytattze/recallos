import { Tenant } from "@repo/server-kernel";

import type {
  SearchGraphPort,
  SearchGraphPortInput,
  SearchGraphPortOutput,
} from "../ports/inbound/search-graph-port.ts";
import type { EmbeddingGatewayPort } from "../ports/outbound/embedding-gateway-port.ts";
import type { GraphNodeRepositoryPort } from "../ports/outbound/graph-node-repository-port.ts";
import type { GraphRepositoryPort } from "../ports/outbound/graph-repository-port.ts";

import { createGraphNotFoundError } from "../../domain/errors/graph-not-found-error.ts";
import { GraphId } from "../../domain/value-objects/graph-id.ts";

class SearchGraphUseCase implements SearchGraphPort {
  constructor(
    private readonly embeddingGateway: EmbeddingGatewayPort,
    private readonly graphRepository: GraphRepositoryPort,
    private readonly graphNodeRepository: GraphNodeRepositoryPort,
  ) {}

  async execute(input: SearchGraphPortInput): SearchGraphPortOutput {
    const tenant = Tenant.fromString(input.tenant);
    const graphId = GraphId.restore({ payload: input.payload.graphId });
    const graph = await this.graphRepository.findById({ id: graphId, tenant });

    if (graph === null) {
      throw createGraphNotFoundError("Graph not found", {
        id: input.payload.graphId,
        tenant: input.tenant,
      });
    }

    const embedResult = await this.embeddingGateway.embed({
      model: graph.embeddingMetadata.model,
      dimension: graph.embeddingMetadata.dimension,
      text: input.payload.query,
      inputType: "query",
    });
    const graphNodes = await this.graphNodeRepository.searchByEmbedding({
      tenant,
      filters: { graphId },
      embedding: embedResult.embedding,
      limit: 10,
    });

    return {
      data: graphNodes.map((graphNode) => ({ rawEvent: graphNode.rawEvent })),
    };
  }
}

export { SearchGraphUseCase };
