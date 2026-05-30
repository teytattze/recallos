import { Result } from "@repo/server-kernel";

import type { EventId } from "./event-id.value-object.ts";
import {
  KnowledgeGraphEdge,
  type CreateKnowledgeGraphEdgeInput,
} from "./knowledge-graph-edge.aggregate.ts";
import type { KnowledgeGraphId } from "./knowledge-graph-id.value-object.ts";
import type { NodeId } from "./node-id.value-object.ts";
import type { RelationshipType } from "./relationship-type.value-object.ts";

export type RelateInput = {
  graphId: KnowledgeGraphId;
  fromId: NodeId;
  toId: NodeId;
  relationship: RelationshipType;
  confidence: number;
  sourceEventIds: EventId[];
  observedAt: Date;
  /** The (fromId, toId, relationship) edge if it already exists; reinforced instead of duplicated. */
  existing: KnowledgeGraphEdge | null;
  now: Date;
};

/**
 * The one cross-aggregate operation ("relate A to B"). Pure: it works on the
 * already-loaded `existing` edge and never touches a repository.
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
      if (!reinforceResult.ok) return reinforceResult;
      return Result.ok(input.existing);
    }

    const createInput: CreateKnowledgeGraphEdgeInput = {
      graphId: input.graphId,
      fromId: input.fromId,
      toId: input.toId,
      relationship: input.relationship,
      confidence: input.confidence,
      sourceEventIds: input.sourceEventIds,
      observedAt: input.observedAt,
      now: input.now,
    };
    return KnowledgeGraphEdge.create(createInput);
  },
} as const;
