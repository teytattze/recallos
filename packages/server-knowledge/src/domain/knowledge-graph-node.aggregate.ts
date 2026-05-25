import { AggregateRoot, EntityMetadata, Result } from "server-kernel";

import type { Embedding } from "./embedding.value-object.ts";
import type { NodeBody } from "./node-body.value-object.ts";

import {
  MissingProvenanceError,
  UnknownNodeTypeError,
} from "./errors/index.ts";
import {
  nodeCreated,
  nodeEmbedded,
  nodeProvenanceExtended,
} from "./events/index.ts";
import {
  dedupeEventIds,
  type EventId,
  type KnowledgeGraphId,
  type NodeId,
} from "./ids.value-object.ts";
import { isNodeType, NodeType } from "./node-type.value-object.ts";

type KnowledgeGraphNodeProps = {
  graphId: KnowledgeGraphId;
  type: NodeType;
  body: NodeBody;
  eventIds: readonly EventId[];
  embedding: Embedding | null;
};

/**
 * A resolved entity/concept. Type and provenance are required; the embedding is
 * optional at birth and assigned later by the Worker.
 */
export class KnowledgeGraphNode extends AggregateRoot<
  NodeId,
  KnowledgeGraphNodeProps
> {
  private constructor(
    id: NodeId,
    metadata: EntityMetadata,
    props: KnowledgeGraphNodeProps,
  ) {
    super(id, metadata, props);
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

  get eventIds(): readonly EventId[] {
    return this._props.eventIds;
  }

  get embedding(): Embedding | null {
    return this._props.embedding;
  }

  static create(props: {
    id: NodeId;
    graphId: KnowledgeGraphId;
    type: NodeType;
    body: NodeBody;
    eventIds: readonly EventId[];
    now: Date;
  }): Result<KnowledgeGraphNode> {
    if (!isNodeType(props.type)) {
      return Result.err(
        UnknownNodeTypeError(`Unknown node type: ${String(props.type)}`, {
          type: props.type,
        }),
      );
    }
    if (props.eventIds.length === 0) {
      return Result.err(
        MissingProvenanceError(
          "A node must reference at least one source event",
          { aggregate: "node" },
        ),
      );
    }
    const node = new KnowledgeGraphNode(
      props.id,
      EntityMetadata.create(props.now),
      {
        graphId: props.graphId,
        type: props.type,
        body: props.body,
        eventIds: dedupeEventIds(props.eventIds),
        embedding: null,
      },
    );
    node.recordEvent(
      nodeCreated({
        nodeId: props.id,
        graphId: props.graphId,
        type: props.type,
        occurredAt: props.now,
      }),
    );
    return Result.ok(node);
  }

  /** Entity resolution: another event reinforces the same entity. */
  attachEvents(eventIds: readonly EventId[], now: Date): void {
    const merged = dedupeEventIds([...this._props.eventIds, ...eventIds]);
    if (merged.length === this._props.eventIds.length) return;
    this.replaceProps({ ...this._props, eventIds: merged });
    this.touch(now);
    this.recordEvent(
      nodeProvenanceExtended({
        nodeId: this.id,
        addedEventIds: eventIds,
        occurredAt: now,
      }),
    );
  }

  /** The Worker assigns/refreshes the embedding after creation. */
  assignEmbedding(embedding: Embedding, now: Date): void {
    this.replaceProps({ ...this._props, embedding });
    this.touch(now);
    this.recordEvent(
      nodeEmbedded({
        nodeId: this.id,
        model: embedding.model,
        dimensions: embedding.dimensions,
        occurredAt: now,
      }),
    );
  }

  reviseBody(body: NodeBody, now: Date): void {
    this.replaceProps({ ...this._props, body });
    this.touch(now);
  }
}
