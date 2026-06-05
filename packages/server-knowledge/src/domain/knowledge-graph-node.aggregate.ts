import {
  EntityMetadata,
  Result,
  Tenant,
  TenantAwareAggregateRoot,
  type TenantType,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { z } from "zod";

import { Embedding } from "./embedding.value-object.ts";
import { EventId } from "./event-id.value-object.ts";
import { InvalidKnowledgeGraphNode } from "./invalid-knowledge-graph-node.error.ts";
import { KnowledgeGraphId } from "./knowledge-graph-id.value-object.ts";
import { NodeBody } from "./node-body.value-object.ts";
import { NodeCreated } from "./node-created.event.ts";
import { NodeEmbedded } from "./node-embedded.event.ts";
import { NodeId } from "./node-id.value-object.ts";
import { NODE_TYPES, type NodeType } from "./node-type.value-object.ts";

export type CreateKnowledgeGraphNodeInput = {
  tenant: Tenant;
  graphId: KnowledgeGraphId;
  type: NodeType;
  body: string;
  eventIds: EventId[];
  now: Date;
};

export type RestoreKnowledgeGraphNodeInput = {
  id: string;
  tenantType: TenantType;
  tenantId: string;
  graphId: string;
  type: NodeType;
  body: string;
  eventIds: string[];
  embedding: { vector: number[]; model: string; dimensions: number } | null;
  createdAt: Date;
  updatedAt: Date;
};

const knowledgeGraphNodePropsSchema = z.object({
  graphId: z.custom<KnowledgeGraphId>((v) => v instanceof KnowledgeGraphId),
  type: z.enum(NODE_TYPES),
  body: z.custom<NodeBody>((v) => v instanceof NodeBody),
  eventIds: z
    .array(z.custom<EventId>((v) => v instanceof EventId))
    .min(1, "node requires at least one source event"),
  embedding: z.custom<Embedding>((v) => v instanceof Embedding).nullable(),
});

type KnowledgeGraphNodeProps = z.infer<typeof knowledgeGraphNodePropsSchema>;

const dedupeEventIds = (eventIds: EventId[]): EventId[] =>
  Array.from(new Map(eventIds.map((id) => [id.value, id])).values());

export class KnowledgeGraphNode extends TenantAwareAggregateRoot<
  NodeId,
  KnowledgeGraphNodeProps
> {
  private constructor(
    id: NodeId,
    tenant: Tenant,
    metadata: EntityMetadata,
    props: KnowledgeGraphNodeProps,
  ) {
    super(id, tenant, metadata, props);
  }

  get graphId(): KnowledgeGraphId {
    return this._props.graphId;
  }

  get type(): NodeType {
    return this._props.type;
  }

  get body(): NodeBody {
    return this._props.body;
  }

  get eventIds(): EventId[] {
    return this._props.eventIds;
  }

  get embedding(): Embedding | null {
    return this._props.embedding;
  }

  static create(
    input: CreateKnowledgeGraphNodeInput,
  ): Result<KnowledgeGraphNode> {
    const createBodyResult = NodeBody.create(input.body);
    if (!createBodyResult.ok) return createBodyResult;

    const parsePropsResult = parseProps(
      knowledgeGraphNodePropsSchema,
      {
        graphId: input.graphId,
        type: input.type,
        body: createBodyResult.value,
        eventIds: dedupeEventIds(input.eventIds),
        embedding: null,
      },
      InvalidKnowledgeGraphNode,
    );
    if (!parsePropsResult.ok) return parsePropsResult;

    const node = new KnowledgeGraphNode(
      NodeId.create(),
      input.tenant,
      EntityMetadata.create(input.now),
      parsePropsResult.value,
    );
    node.recordEvent(
      new NodeCreated(node.id.value, input.now, node.graphId.value, node.type),
    );
    return Result.ok(node);
  }

  static restore(input: RestoreKnowledgeGraphNodeInput): KnowledgeGraphNode {
    return new KnowledgeGraphNode(
      NodeId.restore(input.id),
      Tenant.of(input.tenantType, input.tenantId),
      EntityMetadata.restore(input.createdAt, input.updatedAt),
      parsePropsOrThrow(knowledgeGraphNodePropsSchema, {
        graphId: KnowledgeGraphId.restore(input.graphId),
        type: input.type,
        body: NodeBody.restore(input.body),
        eventIds: input.eventIds.map((id) => EventId.restore(id)),
        embedding: input.embedding
          ? Embedding.restore(
              input.embedding.vector,
              input.embedding.model,
              input.embedding.dimensions,
            )
          : null,
      }),
    );
  }

  /** Entity resolution: another event reinforces the same node. Idempotent. */
  attachEvents(eventIds: EventId[], now: Date): void {
    const merged = dedupeEventIds([...this._props.eventIds, ...eventIds]);
    if (merged.length === this._props.eventIds.length) return;

    this.replaceProps({ ...this._props, eventIds: merged });
    this.touch(now);
  }

  assignEmbedding(embedding: Embedding, now: Date): void {
    this.replaceProps({ ...this._props, embedding });
    this.touch(now);
    this.recordEvent(
      new NodeEmbedded(
        this.id.value,
        now,
        embedding.model,
        embedding.dimensions,
      ),
    );
  }

  reviseBody(body: string, now: Date): Result<void> {
    const createBodyResult = NodeBody.create(body);
    if (!createBodyResult.ok) return createBodyResult;

    this.replaceProps({ ...this._props, body: createBodyResult.value });
    this.touch(now);
    return Result.ok(undefined);
  }

  /**
   * Fold a duplicate into this survivor without deletion: provenance only grows.
   * Re-pointing the duplicate's incident edges is I/O and lives in the application layer.
   */
  absorb(duplicate: KnowledgeGraphNode, now: Date): void {
    this.attachEvents(duplicate.eventIds, now);
  }
}
