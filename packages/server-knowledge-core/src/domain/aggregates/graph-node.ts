import {
  EntityMetadata,
  type Result,
  type Tenant,
  TenantAwareAggregateRoot,
  okResult,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { isNull } from "es-toolkit";
import { z } from "zod";

import { createInvalidGraphNodeError } from "../errors/invalid-graph-node-error.ts";
import { createNodeCreatedEvent } from "../events/graph-node-created-event.ts";
import { createNodeEmbeddedEvent } from "../events/graph-node-embedded-event.ts";
import { Embedding } from "../value-objects/embedding.ts";
import { EventId } from "../value-objects/event-id.ts";
import { GraphId } from "../value-objects/graph-id.ts";
import { GraphNodeBody } from "../value-objects/graph-node-body.ts";
import { GraphNodeId } from "../value-objects/graph-node-id.ts";

type CreateGraphNodeInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    body: string;
    eventIds: EventId[];
    graphId: GraphId;
  };
};

type RestoreGraphNodeInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    id: string;
    graphId: string;
    body: string;
    eventIds: string[];
    embedding: { vector: number[]; model: string; dimensions: number } | null;
  };
};

const graphNodePropsSchema = z.object({
  body: z.custom<GraphNodeBody>((v) => v instanceof GraphNodeBody),
  embedding: z.custom<Embedding>((v) => v instanceof Embedding).nullable(),

  eventIds: z
    .array(z.custom<EventId>((v) => v instanceof EventId))
    .min(1, "node requires at least one source event"),
  graphId: z.custom<GraphId>((v) => v instanceof GraphId),
});

type GraphNodeProps = z.infer<typeof graphNodePropsSchema>;

const dedupeEventIds = (eventIds: EventId[]): EventId[] =>
  Array.from(new Map(eventIds.map((id) => [id.value, id])).values());

class GraphNode extends TenantAwareAggregateRoot<
  GraphNodeId,
  GraphNodeProps
> {
  private constructor(
    id: GraphNodeId,
    tenant: Tenant,
    metadata: EntityMetadata,
    props: GraphNodeProps,
  ) {
    super(id, tenant, metadata, props);
  }

  static create(
    input: CreateGraphNodeInput,
  ): Result<GraphNode> {
    const createBodyResult = GraphNodeBody.create({
      payload: input.payload.body,
    });

    if (!createBodyResult.ok) {
      return createBodyResult;
    }
    const parsePropsResult = parseProps(
      graphNodePropsSchema,
      {
        body: createBodyResult.value,
        embedding: null,
        eventIds: dedupeEventIds(input.payload.eventIds),
        graphId: input.payload.graphId,
      },
      createInvalidGraphNodeError,
    );

    if (!parsePropsResult.ok) {
      return parsePropsResult;
    }
    const node = new GraphNode(
      GraphNodeId.create(),
      input.tenant,
      input.metadata,
      parsePropsResult.value,
    );

    node.recordEvent(
      createNodeCreatedEvent(node.id.value, input.metadata.createdAt, {
        graphId: node.graphId.value,
      }),
    );
    return okResult(node);
  }

  static restore(input: RestoreGraphNodeInput): GraphNode {
    return new GraphNode(
      GraphNodeId.restore(input.payload.id),
      input.tenant,
      input.metadata,
      parsePropsOrThrow(graphNodePropsSchema, {
        body: GraphNodeBody.restore({
          payload: input.payload.body,
        }),
        embedding: isNull(input.payload.embedding)
          ? null
          : Embedding.restore({
              payload: {
                vector: input.payload.embedding.vector,
                model: input.payload.embedding.model,
                dimensions: input.payload.embedding.dimensions,
              },
            }),

        eventIds: input.payload.eventIds.map((eventId) =>
          EventId.restore({ payload: eventId }),
        ),
        graphId: GraphId.restore({ payload: input.payload.graphId }),
      }),
    );
  }

  attachEvents(eventIds: EventId[], now: Date): void {
    const merged = dedupeEventIds([...this._props.eventIds, ...eventIds]);

    if (merged.length === this._props.eventIds.length) {
      return;
    }
    this.replaceProps({ ...this._props, eventIds: merged });
    this.touch(now);
  }

  assignEmbedding(embedding: Embedding, now: Date): void {
    this.replaceProps({ ...this._props, embedding });
    this.touch(now);
    this.recordEvent(
      createNodeEmbeddedEvent(this.id.value, now, {
        model: embedding.model,
        dimensions: embedding.dimensions,
      }),
    );
  }

  reviseBody(body: string, now: Date): Result<void> {
    const createBodyResult = GraphNodeBody.create({ payload: body });

    if (!createBodyResult.ok) {
      return createBodyResult;
    }
    this.replaceProps({ ...this._props, body: createBodyResult.value });
    this.touch(now);

    return okResult(undefined);
  }

  /**
   * Fold a duplicate into this survivor without deletion: provenance only grows.
   * Re-pointing the duplicate's incident edges is I/O and lives in the application layer.
   */
  absorb(duplicate: GraphNode, now: Date): void {
    this.attachEvents(duplicate.eventIds, now);
  }

  get body(): GraphNodeBody {
    return this._props.body;
  }

  get embedding(): Embedding | null {
    return this._props.embedding;
  }

  get eventIds(): EventId[] {
    return this._props.eventIds;
  }

  get graphId(): GraphId {
    return this._props.graphId;
  }
}

export { GraphNode };
