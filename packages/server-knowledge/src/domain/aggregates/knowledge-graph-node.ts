import {
  EntityMetadata,
  type Result,
  type Tenant,
  TenantAwareAggregateRoot,
  okResult,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { z } from "zod";

import { createInvalidKnowledgeGraphNodeError } from "../errors/invalid-knowledge-graph-node-error.ts";
import { NodeCreated } from "../events/node-created.ts";
import { NodeEmbedded } from "../events/node-embedded.ts";
import { Embedding } from "../value-objects/embedding.ts";
import { EventId } from "../value-objects/event-id.ts";
import { KnowledgeGraphId } from "../value-objects/knowledge-graph-id.ts";
import { NodeBody } from "../value-objects/node-body.ts";
import { NodeId } from "../value-objects/node-id.ts";
import { NODE_TYPES, type NodeType } from "../value-objects/node-type.ts";

type CreateKnowledgeGraphNodeInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    graphId: KnowledgeGraphId;
    type: NodeType;
    body: string;
    eventIds: EventId[];
  };
};

type RestoreKnowledgeGraphNodeInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    id: string;
    graphId: string;
    type: NodeType;
    body: string;
    eventIds: string[];
    embedding: { vector: number[]; model: string; dimensions: number } | null;
  };
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

class KnowledgeGraphNode extends TenantAwareAggregateRoot<
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
    const createBodyResult = NodeBody.create({ payload: input.payload.body });
    if (!createBodyResult.ok) return createBodyResult;

    const parsePropsResult = parseProps(
      knowledgeGraphNodePropsSchema,
      {
        graphId: input.payload.graphId,
        type: input.payload.type,
        body: createBodyResult.value,
        eventIds: dedupeEventIds(input.payload.eventIds),
        embedding: null,
      },
      createInvalidKnowledgeGraphNodeError,
    );
    if (!parsePropsResult.ok) return parsePropsResult;

    const node = new KnowledgeGraphNode(
      NodeId.create(),
      input.tenant,
      input.metadata,
      parsePropsResult.value,
    );
    node.recordEvent(
      NodeCreated(node.id.value, input.metadata.createdAt, {
        graphId: node.graphId.value,
        type: node.type,
      }),
    );
    return okResult(node);
  }

  static restore(input: RestoreKnowledgeGraphNodeInput): KnowledgeGraphNode {
    return new KnowledgeGraphNode(
      NodeId.restore(input.payload.id),
      input.tenant,
      input.metadata,
      parsePropsOrThrow(knowledgeGraphNodePropsSchema, {
        graphId: KnowledgeGraphId.restore(input.payload.graphId),
        type: input.payload.type,
        body: NodeBody.restore({ payload: input.payload.body }),
        eventIds: input.payload.eventIds.map((id) => EventId.restore(id)),
        embedding: input.payload.embedding
          ? Embedding.restore({
              payload: {
                vector: input.payload.embedding.vector,
                model: input.payload.embedding.model,
                dimensions: input.payload.embedding.dimensions,
              },
            })
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
      NodeEmbedded(this.id.value, now, {
        model: embedding.model,
        dimensions: embedding.dimensions,
      }),
    );
  }

  reviseBody(body: string, now: Date): Result<void> {
    const createBodyResult = NodeBody.create({ payload: body });
    if (!createBodyResult.ok) return createBodyResult;

    this.replaceProps({ ...this._props, body: createBodyResult.value });
    this.touch(now);
    return okResult(undefined);
  }

  /**
   * Fold a duplicate into this survivor without deletion: provenance only grows.
   * Re-pointing the duplicate's incident edges is I/O and lives in the application layer.
   */
  absorb(duplicate: KnowledgeGraphNode, now: Date): void {
    this.attachEvents(duplicate.eventIds, now);
  }
}

export { KnowledgeGraphNode };
