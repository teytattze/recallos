import { EntityMetadata, okResult, type Clock } from "@repo/server-kernel";

import type {
  ProcessEventPort,
  ProcessEventPortInput,
  ProcessEventPortOutput,
} from "../ports/inbound/process-event-port.ts";
import type { EmbeddingGatewayPort } from "../ports/outbound/embedding-gateway-port.ts";
import type { GraphNodeRepositoryPort } from "../ports/outbound/graph-node-repository-port.ts";
import type { ProcessedEventRepositoryPort } from "../ports/outbound/processed-event-repository-port.ts";
import type { UnitOfWorkPort } from "../ports/outbound/unit-of-work-port.ts";

import { GraphEdge } from "../../domain/aggregates/graph-edge.ts";
import { GraphNode } from "../../domain/aggregates/graph-node.ts";
import { EventId } from "../../domain/value-objects/event-id.ts";
import { GraphId } from "../../domain/value-objects/graph-id.ts";

class ProcessEventUseCase implements ProcessEventPort {
  constructor(
    private readonly clock: Clock,
    private readonly embeddingGateway: EmbeddingGatewayPort,
    private readonly processedEventRepository: ProcessedEventRepositoryPort,
    private readonly graphNodeRepository: GraphNodeRepositoryPort,
    private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(input: ProcessEventPortInput): ProcessEventPortOutput {
    const eventId = EventId.restore({ payload: input.payload.event.id });
    const isAlreadyProcessed = await this.processedEventRepository.seen({
      payload: { eventId },
    });
    if (isAlreadyProcessed) {
      return okResult(undefined);
    }

    const graphId = GraphId.restore({
      payload: input.payload.event.graphId,
    });

    const createGraphNodeResult = GraphNode.create({
      tenant: input.tenant,
      metadata: EntityMetadata.create(this.clock.now()),
      payload: {
        body: input.payload.event.body,
        eventIds: [eventId],
        graphId,
      },
    });

    if (!createGraphNodeResult.ok) {
      return createGraphNodeResult;
    }
    const newGraphNode = createGraphNodeResult.value;

    const embedding = await this.embeddingGateway.embed({
      payload: {
        texts: [JSON.stringify(input.payload)],
        model: "",
      },
    });

    const relatedGraphNodes =
      await this.graphNodeRepository.searchByEmbedding({
        tenant: input.tenant,
        payload: { embedding },
      });

    const graphEdges: GraphEdge[] = [];
    for (const node of relatedGraphNodes) {
      const createEdgeResult = GraphEdge.create({
        tenant: input.tenant,
        metadata: EntityMetadata.create(this.clock.now()),
        payload: {
          fromId: newGraphNode.id,
          toId: node.id,
          graphId: node.graphId,
          relationship: "RELATED_TO",
          confidence: 1,
          sourceEventIds: [...newGraphNode.eventIds, ...node.eventIds],
        },
      });
      if (!createEdgeResult.ok) {
        return createEdgeResult;
      }
      graphEdges.push(createEdgeResult.value);
    }

    await this.uow.transaction(
      async ({
        graphEdgeRepository,
        processedEventRepository,
        graphNodeRepository,
      }) => {
        await processedEventRepository.insert({ payload: { eventId } });
        await graphNodeRepository.insert({ payload: newGraphNode });
        await graphEdgeRepository.insertMany({
          payload: graphEdges,
        });
      },
    );

    return okResult(undefined);
  }
}

export { ProcessEventUseCase };
