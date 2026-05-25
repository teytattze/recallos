import { Result } from "server-kernel";

import type { Confidence } from "./confidence.value-object.ts";
import type { EdgeId, EventId } from "./ids.value-object.ts";
import type { KnowledgeGraphNode } from "./knowledge-graph-node.aggregate.ts";

import {
  IncompatibleRelationshipError,
  SelfLoopNotAllowedError,
} from "./errors/index.ts";
import { KnowledgeGraphEdge } from "./knowledge-graph-edge.aggregate.ts";
import {
  relationshipAllowsTypes,
  type RelationshipType,
} from "./relationship-type.value-object.ts";

/**
 * The one cross-aggregate operation ("relate A to B"), kept pure by operating on
 * already-loaded node aggregates. The application use case loads the nodes (and
 * the existing edge, if any), calls this, and persists the result.
 */
export const GraphRelation = {
  relate(props: {
    from: KnowledgeGraphNode;
    to: KnowledgeGraphNode;
    relationship: RelationshipType;
    confidence: Confidence;
    sourceEventIds: readonly EventId[];
    observedAt: Date;
    newEdgeId: EdgeId;
    existing: KnowledgeGraphEdge | null;
    now: Date;
  }): Result<KnowledgeGraphEdge> {
    if (props.from.id.equals(props.to.id)) {
      return Result.err(
        SelfLoopNotAllowedError("An edge cannot connect a node to itself", {
          nodeId: props.from.id.value,
        }),
      );
    }
    if (
      !relationshipAllowsTypes(
        props.relationship,
        props.from.type,
        props.to.type,
      )
    ) {
      return Result.err(
        IncompatibleRelationshipError(
          `Relationship ${props.relationship} is not allowed between ${props.from.type} and ${props.to.type}`,
          {
            relationship: props.relationship,
            from: props.from.type,
            to: props.to.type,
          },
        ),
      );
    }

    if (props.existing) {
      props.existing.reinforce({
        confidence: props.confidence,
        sourceEventIds: props.sourceEventIds,
        observedAt: props.observedAt,
        now: props.now,
      });
      return Result.ok(props.existing);
    }

    return KnowledgeGraphEdge.create({
      id: props.newEdgeId,
      graphId: props.from.graphId,
      fromId: props.from.id,
      toId: props.to.id,
      relationship: props.relationship,
      confidence: props.confidence,
      sourceEventIds: props.sourceEventIds,
      observedAt: props.observedAt,
      now: props.now,
    });
  },
} as const;
