import {
  AggregateRoot,
  EntityMetadata,
  Result,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { z } from "zod";

import { Confidence } from "./confidence.value-object.ts";
import { EdgeId } from "./edge-id.value-object.ts";
import { EdgeReinforced } from "./edge-reinforced.event.ts";
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

  static create(
    input: CreateKnowledgeGraphEdgeInput,
  ): Result<KnowledgeGraphEdge> {
    if (input.fromId.equals(input.toId)) {
      return Result.err(
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
      EntityMetadata.create(input.now),
      parsePropsResult.value,
    );
    edge.recordEvent(
      new NodesRelated(
        edge.id.value,
        input.fromId.value,
        input.toId.value,
        input.relationship,
        input.now,
      ),
    );
    return Result.ok(edge);
  }

  /** Re-asserted by a later event: confidence is latest-wins, provenance grows,
   *  `observedAt` keeps the most recent observation (§6 of the domain doc). */
  reinforce(input: {
    confidence: number;
    sourceEventIds: EventId[];
    observedAt: Date;
    now: Date;
  }): Result<void> {
    const createConfidenceResult = Confidence.create(input.confidence);
    if (!createConfidenceResult.ok) return createConfidenceResult;

    const mergedEventIds = dedupeEventIds([
      ...this._props.sourceEventIds,
      ...input.sourceEventIds,
    ]);
    const observedAt =
      input.observedAt > this._props.observedAt
        ? input.observedAt
        : this._props.observedAt;

    this.replaceProps({
      ...this._props,
      confidence: createConfidenceResult.value,
      sourceEventIds: mergedEventIds,
      observedAt,
    });
    this.touch(input.now);
    this.recordEvent(
      new EdgeReinforced(
        this.id.value,
        input.confidence,
        input.sourceEventIds.map((id) => id.value),
        input.now,
      ),
    );
    return Result.ok(undefined);
  }

  static restore(input: RestoreKnowledgeGraphEdgeInput): KnowledgeGraphEdge {
    return new KnowledgeGraphEdge(
      EdgeId.restore(input.id),
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
}
