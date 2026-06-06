import {
  EntityMetadata,
  type Result,
  Tenant,
  TenantAwareAggregateRoot,
  type TenantType,
  errResult,
  okResult,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { z } from "zod";

import { Confidence } from "./confidence.value-object.ts";
import { EdgeId } from "./edge-id.value-object.ts";
import { EventId } from "./event-id.value-object.ts";
import { InvalidKnowledgeGraphEdge } from "./invalid-knowledge-graph-edge.error.ts";
import { KnowledgeGraphId } from "./knowledge-graph-id.value-object.ts";
import { NodeId } from "./node-id.value-object.ts";
import { NodesRelated } from "./nodes-related.event.ts";
import {
  RELATIONSHIP_TYPES,
  type RelationshipType,
} from "./relationship-type.value-object.ts";

export type CreateKnowledgeGraphEdgeInput = {
  tenant: Tenant;
  graphId: KnowledgeGraphId;
  fromId: NodeId;
  toId: NodeId;
  relationship: RelationshipType;
  confidence: number;
  sourceEventIds: EventId[];
  observedAt: Date;
  now: Date;
};

export type RestoreKnowledgeGraphEdgeInput = {
  id: string;
  tenantType: TenantType;
  tenantId: string;
  graphId: string;
  fromId: string;
  toId: string;
  relationship: RelationshipType;
  confidence: number;
  sourceEventIds: string[];
  observedAt: Date;
  createdAt: Date;
  updatedAt: Date;
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

export class KnowledgeGraphEdge extends TenantAwareAggregateRoot<
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
    if (input.fromId.equals(input.toId)) {
      return errResult(
        InvalidKnowledgeGraphEdge("edge cannot connect a node to itself"),
      );
    }

    const createConfidenceResult = Confidence.create(input.confidence);
    if (!createConfidenceResult.ok) return createConfidenceResult;

    const parsePropsResult = parseProps(
      knowledgeGraphEdgePropsSchema,
      {
        graphId: input.graphId,
        fromId: input.fromId,
        toId: input.toId,
        relationship: input.relationship,
        confidence: createConfidenceResult.value,
        sourceEventIds: dedupeEventIds(input.sourceEventIds),
        observedAt: input.observedAt,
      },
      InvalidKnowledgeGraphEdge,
    );
    if (!parsePropsResult.ok) return parsePropsResult;

    const edge = new KnowledgeGraphEdge(
      EdgeId.create(),
      input.tenant,
      EntityMetadata.create(input.now),
      parsePropsResult.value,
    );
    edge.recordEvent(
      NodesRelated(edge.id.value, input.now, {
        fromId: edge.fromId.value,
        toId: edge.toId.value,
        relationship: edge.relationship,
      }),
    );
    return okResult(edge);
  }

  static restore(input: RestoreKnowledgeGraphEdgeInput): KnowledgeGraphEdge {
    return new KnowledgeGraphEdge(
      EdgeId.restore(input.id),
      Tenant.create(input.tenantType, input.tenantId),
      EntityMetadata.restore(input.createdAt, input.updatedAt),
      parsePropsOrThrow(knowledgeGraphEdgePropsSchema, {
        graphId: KnowledgeGraphId.restore(input.graphId),
        fromId: NodeId.restore(input.fromId),
        toId: NodeId.restore(input.toId),
        relationship: input.relationship,
        confidence: Confidence.restore(input.confidence),
        sourceEventIds: input.sourceEventIds.map((id) => EventId.restore(id)),
        observedAt: input.observedAt,
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
    const createConfidenceResult = Confidence.create(input.confidence);
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
