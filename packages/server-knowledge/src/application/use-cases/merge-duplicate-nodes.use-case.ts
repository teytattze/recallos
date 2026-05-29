import { type Clock, type DomainEvent, Result } from "@repo/server-kernel";

import type { EventId } from "../../domain/event-id.value-object.ts";
import type { KnowledgeGraphEdge } from "../../domain/knowledge-graph-edge.aggregate.ts";
import type { KnowledgeGraphNode } from "../../domain/knowledge-graph-node.aggregate.ts";
import type { NodeId } from "../../domain/node-id.value-object.ts";
import type {
  MergeDuplicateNodes,
  MergeDuplicateNodesInput,
  MergeDuplicateNodesReport,
} from "../ports/inbound/merge-duplicate-nodes.use-case.ts";
import type { EventPublisher } from "../ports/outbound/event-publisher.port.ts";
import type { KnowledgeGraphEdgeRepository } from "../ports/outbound/knowledge-graph-edge.repository.ts";
import type { KnowledgeGraphNodeRepository } from "../ports/outbound/knowledge-graph-node.repository.ts";
import type { UnitOfWork } from "../ports/outbound/unit-of-work.port.ts";

/** A `DUPLICATE_OF` edge points from the duplicate to the survivor. */
const DUPLICATE_OF = "DUPLICATE_OF" as const;

export class MergeDuplicateNodesUseCase implements MergeDuplicateNodes {
  constructor(
    private readonly nodes: KnowledgeGraphNodeRepository,
    private readonly edges: KnowledgeGraphEdgeRepository,
    private readonly publisher: EventPublisher,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: MergeDuplicateNodesInput,
  ): Promise<Result<MergeDuplicateNodesReport>> {
    const pending = await this.edges.findByRelationship(
      DUPLICATE_OF,
      input.limit,
    );
    if (pending.length === 0) return Result.ok({ merged: 0 });

    const survivors: KnowledgeGraphNode[] = [];
    const repoints: Array<{ from: NodeId; to: NodeId }> = [];
    const resolvedEdges: KnowledgeGraphEdge[] = [];
    let merged = 0;

    for (const edge of pending) {
      const [duplicate, survivor] = await Promise.all([
        this.nodes.findById(edge.fromId),
        this.nodes.findById(edge.toId),
      ]);
      // A dangling marker is still resolved (its endpoints are gone).
      if (duplicate && survivor) {
        survivor.attachEvents(
          [...duplicate.eventIds] as EventId[],
          this.clock.now(),
        );
        survivors.push(survivor);
        repoints.push({ from: duplicate.id, to: survivor.id });
        merged++;
      }
      resolvedEdges.push(edge);
    }

    await this.uow.run(async () => {
      await this.nodes.saveMany(survivors);
      for (const { from, to } of repoints) {
        await this.edges.repointIncidentEdges(from, to);
      }
      await this.edges.deleteMany(resolvedEdges);
    });

    const domainEvents: DomainEvent[] = survivors.flatMap((node) => [
      ...node.pullDomainEvents(),
    ]);
    await this.publisher.publish(domainEvents);

    return Result.ok({ merged });
  }
}
