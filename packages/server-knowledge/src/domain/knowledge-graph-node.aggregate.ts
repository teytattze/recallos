import {
  AggregateRoot,
  EntityMetadata,
  Result,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { z } from "zod";

import { Embedding } from "./embedding.value-object.ts";
import { EventId } from "./event-id.value-object.ts";
import { InvalidKnowledgeGraphNode } from "./invalid-knowledge-graph-node.error.ts";
import { KnowledgeGraphId } from "./knowledge-graph-id.value-object.ts";
import { NodeBody } from "./node-body.value-object.ts";
import { NodeId } from "./node-id.value-object.ts";
import { NodeType } from "./node-type.value-object.ts";

export type CreateKnowledgeGraphNodeInput = {
  graphId: KnowledgeGraphId;
  type: NodeType;
  body: string;
  eventIds: EventId[];
  now: Date;
};

export type RestoreKnowledgeGraphNodeInput = {
  id: string;
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
  type: z.enum(NodeType),
  body: z.custom<NodeBody>((v) => v instanceof NodeBody),
  eventIds: z
    .array(z.custom<EventId>((v) => v instanceof EventId))
    .min(1, "node requires at least one source event"),
  embedding: z.custom<Embedding>((v) => v instanceof Embedding).nullable(),
});

type KnowledgeGraphNodeProps = z.infer<typeof knowledgeGraphNodePropsSchema>;

const dedupeEventIds = (eventIds: EventId[]): EventId[] =>
  Array.from(new Map(eventIds.map((id) => [id.value, id])).values());

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

    return Result.ok(
      new KnowledgeGraphNode(
        NodeId.create(),
        EntityMetadata.create(input.now),
        parsePropsResult.value,
      ),
    );
  }

  static restore(input: RestoreKnowledgeGraphNodeInput): KnowledgeGraphNode {
    return new KnowledgeGraphNode(
      NodeId.restore(input.id),
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
}
