import { Result } from "@repo/server-kernel";

import { EventId } from "./event-id.value-object.ts";
import { KnowledgeGraphEdge } from "./knowledge-graph-edge.aggregate.ts";
import { KnowledgeGraphNode } from "./knowledge-graph-node.aggregate.ts";
import { type RelationshipType } from "./relationship-type.value-object.ts";

export type RelateInput = {
  from: KnowledgeGraphNode;
  to: KnowledgeGraphNode;
  relationship: RelationshipType;
  confidence: number;
  sourceEventIds: EventId[];
  observedAt: Date;
  /** The `(from, to, relationship)` edge if it already exists in the graph. */
  existing: KnowledgeGraphEdge | null;
  now: Date;
};

/**
 * The one cross-aggregate write — "relate A to B" — as a pure domain service
 * over already-loaded node aggregates (no repositories). It enforces edge
 * de-duplication: re-asserting an existing `(from, to, relationship)` triple
 * reinforces it; otherwise a new edge is created.
 */
export const GraphRelation = {
  relate(input: RelateInput): Result<KnowledgeGraphEdge> {
    if (input.existing) {
      const reinforceResult = input.existing.reinforce({
        confidence: input.confidence,
        sourceEventIds: input.sourceEventIds,
        observedAt: input.observedAt,
        now: input.now,
      });
      return Result.map(reinforceResult, () => input.existing!);
    }

    return KnowledgeGraphEdge.create({
      graphId: input.from.graphId,
      fromId: input.from.id,
      toId: input.to.id,
      relationship: input.relationship,
      confidence: input.confidence,
      sourceEventIds: input.sourceEventIds,
      observedAt: input.observedAt,
      now: input.now,
    });
  },
} as const;
