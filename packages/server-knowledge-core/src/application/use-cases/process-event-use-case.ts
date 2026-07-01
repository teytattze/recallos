import { AppError } from "@repo/app-error";
import { Tenant, type Clock } from "@repo/server-kernel";

import type {
  ProcessEventPort,
  ProcessEventPortInput,
  ProcessEventPortOutput,
} from "../ports/inbound/process-event-port.ts";
import type { EmbeddingGatewayPort } from "../ports/outbound/embedding-gateway-port.ts";
import type { GraphNodeRepositoryPort } from "../ports/outbound/graph-node-repository-port.ts";
import type { GraphRepositoryPort } from "../ports/outbound/graph-repository-port.ts";

import { GraphNode } from "../../domain/aggregates/graph-node.ts";
import { GraphId } from "../../domain/value-objects/graph-id.ts";

class ProcessEventUseCase implements ProcessEventPort {
  constructor(
    private readonly clock: Clock,
    private readonly embeddingGateway: EmbeddingGatewayPort,
    private readonly graphRepository: GraphRepositoryPort,
    private readonly graphNodeRepository: GraphNodeRepositoryPort,
  ) {}

  async execute(input: ProcessEventPortInput): ProcessEventPortOutput {
    const now = this.clock.now();
    const tenant = Tenant.fromString(input.tenant);
    const graphId = GraphId.restore({ payload: input.payload.graphId });

    const graph = await this.graphRepository.findById({
      id: graphId,
      tenant,
    });

    if (graph === null) {
      throw AppError.ofCode("serverKnowledgeCore.graphNotFound");
    }

    const { embedding } = await this.embeddingGateway.embed({
      dimension: graph.embeddingMetadata.dimension,
      model: graph.embeddingMetadata.model,
      text: JSON.stringify(input.payload.event.raw),
      inputType: "document",
    });

    const graphNode = GraphNode.create({
      tenant: input.tenant,
      metadata: { now },
      payload: {
        embedding,
        eventId: input.payload.event.id,
        graphId: input.payload.graphId,
        rawEvent: input.payload.event.raw,
      },
    });

    await this.graphNodeRepository.insert({ data: graphNode });
  }
}

export { ProcessEventUseCase };
