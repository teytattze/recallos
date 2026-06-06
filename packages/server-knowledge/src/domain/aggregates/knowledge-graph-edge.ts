import {
  EntityMetadata,
  type Result,
  type Tenant,
  TenantAwareAggregateRoot,
  errResult,
  okResult,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { z } from "zod";

import { createInvalidKnowledgeGraphEdgeError } from "../errors/invalid-knowledge-graph-edge-error.ts";
import { NodesRelated } from "../events/nodes-related.ts";
import { Confidence } from "../value-objects/confidence.ts";
import { EdgeId } from "../value-objects/edge-id.ts";
import { EventId } from "../value-objects/event-id.ts";
import { KnowledgeGraphId } from "../value-objects/knowledge-graph-id.ts";
import { NodeId } from "../value-objects/node-id.ts";
import {
  RELATIONSHIP_TYPES,
  type RelationshipType,
} from "../value-objects/relationship-type.ts";

type CreateKnowledgeGraphEdgeInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    graphId: KnowledgeGraphId;
    fromId: NodeId;
    toId: NodeId;
    relationship: RelationshipType;
    confidence: number;
    sourceEventIds: EventId[];
    observedAt: Date;
  };
};

type RestoreKnowledgeGraphEdgeInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    id: string;
    graphId: string;
    fromId: string;
    toId: string;
    relationship: RelationshipType;
    confidence: number;
    sourceEventIds: string[];
    observedAt: Date;
  };
};

const knowledgeGraphEdgePropsSchema = z.object({
  graphId: z.custom<KnowledgeGraphId>((v) => v instanceof KnowledgeGraphId),
  fromId: z.custom<NodeId>((v) => v instanceof NodeId),
  toId: z.custom<NodeId>((v) => v instanceof NodeId),
  relationship: z.enum(RELATIONSHIP_TYPES),
  confidence: z.custom<Confidence>((v) => v instanceof Confidence),
  sourceEventIds: z
    .array(z.custom<EventId>((v) => v instanceof EventId))
    .min(1, "edge requires at least one source event"),
  observedAt: z.date(),
});

type KnowledgeGraphEdgeProps = z.infer<typeof knowledgeGraphEdgePropsSchema>;

const dedupeEventIds = (eventIds: EventId[]): EventId[] =>
  Array.from(new Map(eventIds.map((id) => [id.value, id])).values());

class KnowledgeGraphEdge extends TenantAwareAggregateRoot<
  EdgeId,
  KnowledgeGraphEdgeProps
> {
  private constructor(
    id: EdgeId,
    tenant: Tenant,
    metadata: EntityMetadata,
    props: KnowledgeGraphEdgeProps,
  ) {
    super(id, tenant, metadata, props);
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

  get sourceEventIds(): EventId[] {
    return this._props.sourceEventIds;
  }

  get observedAt(): Date {
    return this._props.observedAt;
  }

  static create(
    input: CreateKnowledgeGraphEdgeInput,
  ): Result<KnowledgeGraphEdge> {
    if (input.payload.fromId.equals(input.payload.toId)) {
      return errResult(
        createInvalidKnowledgeGraphEdgeError(
          "edge cannot connect a node to itself",
        ),
      );
    }

    const createConfidenceResult = Confidence.create({
      payload: input.payload.confidence,
    });
    if (!createConfidenceResult.ok) return createConfidenceResult;

    const parsePropsResult = parseProps(
      knowledgeGraphEdgePropsSchema,
      {
        graphId: input.payload.graphId,
        fromId: input.payload.fromId,
        toId: input.payload.toId,
        relationship: input.payload.relationship,
        confidence: createConfidenceResult.value,
        sourceEventIds: dedupeEventIds(input.payload.sourceEventIds),
        observedAt: input.payload.observedAt,
      },
      createInvalidKnowledgeGraphEdgeError,
    );
    if (!parsePropsResult.ok) return parsePropsResult;

    const edge = new KnowledgeGraphEdge(
      EdgeId.create(),
      input.tenant,
      input.metadata,
      parsePropsResult.value,
    );
    edge.recordEvent(
      NodesRelated(edge.id.value, input.metadata.createdAt, {
        fromId: edge.fromId.value,
        toId: edge.toId.value,
        relationship: edge.relationship,
      }),
    );
    return okResult(edge);
  }

  static restore(input: RestoreKnowledgeGraphEdgeInput): KnowledgeGraphEdge {
    return new KnowledgeGraphEdge(
      EdgeId.restore(input.payload.id),
      input.tenant,
      input.metadata,
      parsePropsOrThrow(knowledgeGraphEdgePropsSchema, {
        graphId: KnowledgeGraphId.restore(input.payload.graphId),
        fromId: NodeId.restore(input.payload.fromId),
        toId: NodeId.restore(input.payload.toId),
        relationship: input.payload.relationship,
        confidence: Confidence.restore({ payload: input.payload.confidence }),
        sourceEventIds: input.payload.sourceEventIds.map((id) =>
          EventId.restore(id),
        ),
        observedAt: input.payload.observedAt,
      }),
    );
  }

  /** Re-asserted by a later event: bump confidence, accumulate provenance, keep the latest observation. */
  reinforce(input: {
    confidence: number;
    sourceEventIds: EventId[];
    observedAt: Date;
    now: Date;
  }): Result<void> {
    const createConfidenceResult = Confidence.create({
      payload: input.confidence,
    });
    if (!createConfidenceResult.ok) return createConfidenceResult;

    this.replaceProps({
      ...this._props,
      confidence: createConfidenceResult.value,
      sourceEventIds: dedupeEventIds([
        ...this._props.sourceEventIds,
        ...input.sourceEventIds,
      ]),
      observedAt:
        input.observedAt > this._props.observedAt
          ? input.observedAt
          : this._props.observedAt,
    });
    this.touch(input.now);
    return okResult(undefined);
  }
}

export { KnowledgeGraphEdge };
