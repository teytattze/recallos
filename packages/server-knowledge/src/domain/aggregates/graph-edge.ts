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

import { createInvalidGraphEdgeError } from "../errors/invalid-graph-edge-error.ts";
import { createNodesRelatedEvent } from "../events/graph-nodes-related-event.ts";
import { Confidence } from "../value-objects/confidence.ts";
import { EventId } from "../value-objects/event-id.ts";
import { GraphEdgeId } from "../value-objects/graph-edge-id.ts";
import { GraphId } from "../value-objects/graph-id.ts";
import { GraphNodeId } from "../value-objects/graph-node-id.ts";
import {
  RELATIONSHIP_TYPES,
  type RelationshipType,
} from "../value-objects/relationship-type.ts";

type CreateGraphEdgeInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    graphId: GraphId;
    fromId: GraphNodeId;
    toId: GraphNodeId;
    relationship: RelationshipType;
    confidence: number;
    sourceEventIds: EventId[];
  };
};

type RestoreGraphEdgeInput = {
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
  };
};

const graphEdgePropsSchema = z.object({
  graphId: z.custom<GraphId>((v) => v instanceof GraphId),
  fromId: z.custom<GraphNodeId>((v) => v instanceof GraphNodeId),
  toId: z.custom<GraphNodeId>((v) => v instanceof GraphNodeId),
  relationship: z.enum(RELATIONSHIP_TYPES),
  confidence: z.custom<Confidence>((v) => v instanceof Confidence),
  sourceEventIds: z
    .array(z.custom<EventId>((v) => v instanceof EventId))
    .min(1, "edge requires at least one source event"),
});

type GraphEdgeProps = z.infer<typeof graphEdgePropsSchema>;

const dedupeEventIds = (eventIds: EventId[]): EventId[] =>
  Array.from(new Map(eventIds.map((id) => [id.value, id])).values());

class GraphEdge extends TenantAwareAggregateRoot<
  GraphEdgeId,
  GraphEdgeProps
> {
  private constructor(
    id: GraphEdgeId,
    tenant: Tenant,
    metadata: EntityMetadata,
    props: GraphEdgeProps,
  ) {
    super(id, tenant, metadata, props);
  }

  static create(
    input: CreateGraphEdgeInput,
  ): Result<GraphEdge> {
    if (input.payload.fromId.equals(input.payload.toId)) {
      return errResult(
        createInvalidGraphEdgeError(
          "edge cannot connect a node to itself",
        ),
      );
    }

    const createConfidenceResult = Confidence.create({
      payload: input.payload.confidence,
    });
    if (!createConfidenceResult.ok) return createConfidenceResult;

    const parsePropsResult = parseProps(
      graphEdgePropsSchema,
      {
        graphId: input.payload.graphId,
        fromId: input.payload.fromId,
        toId: input.payload.toId,
        relationship: input.payload.relationship,
        confidence: createConfidenceResult.value,
        sourceEventIds: dedupeEventIds(input.payload.sourceEventIds),
      },
      createInvalidGraphEdgeError,
    );
    if (!parsePropsResult.ok) return parsePropsResult;

    const edge = new GraphEdge(
      GraphEdgeId.create(),
      input.tenant,
      input.metadata,
      parsePropsResult.value,
    );
    edge.recordEvent(
      createNodesRelatedEvent(edge.id.value, input.metadata.createdAt, {
        fromId: edge.fromId.value,
        toId: edge.toId.value,
        relationship: edge.relationship,
      }),
    );
    return okResult(edge);
  }

  static restore(input: RestoreGraphEdgeInput): GraphEdge {
    return new GraphEdge(
      GraphEdgeId.restore(input.payload.id),
      input.tenant,
      input.metadata,
      parsePropsOrThrow(graphEdgePropsSchema, {
        graphId: GraphId.restore({ payload: input.payload.graphId }),
        fromId: GraphNodeId.restore(input.payload.fromId),
        toId: GraphNodeId.restore(input.payload.toId),
        relationship: input.payload.relationship,
        confidence: Confidence.restore({ payload: input.payload.confidence }),
        sourceEventIds: input.payload.sourceEventIds.map((id) =>
          EventId.restore({ payload: id }),
        ),
      }),
    );
  }

  reinforce(input: {
    confidence: number;
    sourceEventIds: EventId[];
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
    });
    this.touch(input.now);
    return okResult(undefined);
  }

  get graphId(): GraphId {
    return this._props.graphId;
  }

  get fromId(): GraphNodeId {
    return this._props.fromId;
  }

  get toId(): GraphNodeId {
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
}

export { GraphEdge };
