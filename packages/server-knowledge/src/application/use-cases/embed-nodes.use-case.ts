import { type Clock, type DomainEvent, Result } from "@repo/server-kernel";

import type { KnowledgeGraphNode } from "../../domain/knowledge-graph-node.aggregate.ts";
import type {
  EmbedNodes,
  EmbedNodesInput,
  EmbedNodesReport,
} from "../ports/inbound/embed-nodes.use-case.ts";
import type { EmbeddingGateway } from "../ports/outbound/embedding.gateway.ts";
import type { EventPublisher } from "../ports/outbound/event-publisher.port.ts";
import type { KnowledgeGraphNodeRepository } from "../ports/outbound/knowledge-graph-node.repository.ts";
import type { KnowledgeGraphRepository } from "../ports/outbound/knowledge-graph.repository.ts";
import type { UnitOfWork } from "../ports/outbound/unit-of-work.port.ts";

import { Embedding } from "../../domain/embedding.value-object.ts";

export class EmbedNodesUseCase implements EmbedNodes {
  constructor(
    private readonly nodes: KnowledgeGraphNodeRepository,
    private readonly graphs: KnowledgeGraphRepository,
    private readonly embeddings: EmbeddingGateway,
    private readonly publisher: EventPublisher,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: EmbedNodesInput): Promise<Result<EmbedNodesReport>> {
    const nodes = input.nodeIds
      ? await this.nodes.findByIds(input.nodeIds)
      : await this.nodes.findNeedingEmbedding(input.limit);

    if (nodes.length === 0) return Result.ok({ embedded: 0 });

    // Group by graph so each graph's standardized embedding model is applied
    // once to a batched call (§12).
    const byGraph = new Map<string, KnowledgeGraphNode[]>();
    for (const node of nodes) {
      const key = node.graphId.value;
      const group = byGraph.get(key);
      if (group) group.push(node);
      else byGraph.set(key, [node]);
    }

    const embedded: KnowledgeGraphNode[] = [];
    for (const group of byGraph.values()) {
      const graph = await this.graphs.findById(group[0]!.graphId);
      if (!graph) continue;

      const vectors = await this.embeddings.embed(
        group.map((node) => node.body.value),
        graph.embeddingModel,
      );
      for (let i = 0; i < group.length; i++) {
        const vector = vectors[i];
        if (!vector) continue;
        const embedding = Embedding.create(vector, graph.embeddingModel);
        if (!embedding.ok) continue;
        group[i]!.assignEmbedding(embedding.value, this.clock.now());
        embedded.push(group[i]!);
      }
    }

    await this.uow.run(async () => {
      await this.nodes.saveMany(embedded);
    });

    const domainEvents: DomainEvent[] = embedded.flatMap((node) => [
      ...node.pullDomainEvents(),
    ]);
    await this.publisher.publish(domainEvents);

    return Result.ok({ embedded: embedded.length });
  }
}
