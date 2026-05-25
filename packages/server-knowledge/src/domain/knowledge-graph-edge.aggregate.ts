import { AggregateRoot, EntityMetadata, Result } from "server-kernel";

import type { Confidence } from "./confidence.value-object.ts";

import {
  MissingProvenanceError,
  SelfLoopNotAllowedError,
  UnknownRelationshipTypeError,
} from "./errors/index.ts";
import { edgeReinforced, nodesRelated } from "./events/index.ts";
import {
  dedupeEventIds,
  type EdgeId,
  type EventId,
  type KnowledgeGraphId,
  type NodeId,
} from "./ids.value-object.ts";
import {
  isRelationshipType,
  type RelationshipType,
} from "./relationship-type.value-object.ts";

type KnowledgeGraphEdgeProps = {
  graphId: KnowledgeGraphId;
  fromId: NodeId;
  toId: NodeId;
  relationship: RelationshipType;
  confidence: Confidence;
  sourceEventIds: readonly EventId[];
  observedAt: Date;
};

/**
 * A directed, typed relationship between two nodes, carrying the metadata recall
 * needs to trust (confidence), explain (provenance), and time-travel (observedAt).
 */
export class KnowledgeGraphEdge extends AggregateRoot<
  EdgeId,
  KnowledgeGraphEdgeProps
> {
  private constructor(
    id: EdgeId,
    metadata: EntityMetadata,
    props: KnowledgeGraphEdgeProps,
  ) {
    super(id, metadata, props);
  }

  get graphId(): KnowledgeGraphId {
    return this._props.graphId;
  }

  get fromId(): NodeId {
    return this._props.fromId;
  }

  get toId(): NodeId {
    return this._props.toId;
  }

  get relationship(): RelationshipType {
    return this._props.relationship;
  }

  get confidence(): Confidence {
    return this._props.confidence;
  }

  get sourceEventIds(): readonly EventId[] {
    return this._props.sourceEventIds;
  }

  get observedAt(): Date {
    return this._props.observedAt;
  }

  static create(props: {
    id: EdgeId;
    graphId: KnowledgeGraphId;
    fromId: NodeId;
    toId: NodeId;
    relationship: RelationshipType;
    confidence: Confidence;
    sourceEventIds: readonly EventId[];
    observedAt: Date;
    now: Date;
  }): Result<KnowledgeGraphEdge> {
    if (props.fromId.equals(props.toId)) {
      return Result.err(
        SelfLoopNotAllowedError("An edge cannot connect a node to itself", {
          nodeId: props.fromId.value,
        }),
      );
    }
    if (!isRelationshipType(props.relationship)) {
      return Result.err(
        UnknownRelationshipTypeError(
          `Unknown relationship type: ${String(props.relationship)}`,
          { relationship: props.relationship },
        ),
      );
    }
    if (props.sourceEventIds.length === 0) {
      return Result.err(
        MissingProvenanceError(
          "An edge must reference at least one source event",
          { aggregate: "edge" },
        ),
      );
    }
    const edge = new KnowledgeGraphEdge(
      props.id,
      EntityMetadata.create(props.now),
      {
        graphId: props.graphId,
        fromId: props.fromId,
        toId: props.toId,
        relationship: props.relationship,
        confidence: props.confidence,
        sourceEventIds: dedupeEventIds(props.sourceEventIds),
        observedAt: props.observedAt,
      },
    );
    edge.recordEvent(
      nodesRelated({
        edgeId: props.id,
        fromId: props.fromId,
        toId: props.toId,
        relationship: props.relationship,
        occurredAt: props.now,
      }),
    );
    return Result.ok(edge);
  }

  /** Re-asserted by a later event: latest confidence wins, provenance/time accumulate. */
  reinforce(props: {
    confidence: Confidence;
    sourceEventIds: readonly EventId[];
    observedAt: Date;
    now: Date;
  }): void {
    const mergedEvents = dedupeEventIds([
      ...this._props.sourceEventIds,
      ...props.sourceEventIds,
    ]);
    const observedAt =
      props.observedAt > this._props.observedAt
        ? props.observedAt
        : this._props.observedAt;
    this.replaceProps({
      ...this._props,
      confidence: props.confidence,
      sourceEventIds: mergedEvents,
      observedAt,
    });
    this.touch(props.now);
    this.recordEvent(
      edgeReinforced({
        edgeId: this.id,
        confidence: props.confidence,
        addedEventIds: props.sourceEventIds,
        occurredAt: props.now,
      }),
    );
  }
}
