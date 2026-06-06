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

import type { Embedding } from "../value-objects/embedding.ts";

import { createInvalidKnowledgeGraphError } from "../errors/invalid-knowledge-graph-error.ts";
import { KnowledgeGraphId } from "../value-objects/knowledge-graph-id.ts";

type CreateKnowledgeGraphInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    name: string;
    embeddingModel: string;
    embeddingDimensions: number;
  };
};

type RestoreKnowledgeGraphInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    id: string;
    name: string;
    embeddingModel: string;
    embeddingDimensions: number;
  };
};

const knowledgeGraphPropsSchema = z.object({
  name: z.string().trim().min(1, "knowledge graph name must not be empty"),
  embeddingModel: z.string().trim().min(1, "embedding model must be provided"),
  embeddingDimensions: z.number().int().positive(),
});

type KnowledgeGraphProps = z.infer<typeof knowledgeGraphPropsSchema>;

class KnowledgeGraph extends TenantAwareAggregateRoot<
  KnowledgeGraphId,
  KnowledgeGraphProps
> {
  private constructor(
    id: KnowledgeGraphId,
    tenant: Tenant,
    metadata: EntityMetadata,
    props: KnowledgeGraphProps,
  ) {
    super(id, tenant, metadata, props);
  }

  static create(input: CreateKnowledgeGraphInput): Result<KnowledgeGraph> {
    const parsePropsResult = parseProps(
      knowledgeGraphPropsSchema,
      {
        name: input.payload.name,
        embeddingModel: input.payload.embeddingModel,
        embeddingDimensions: input.payload.embeddingDimensions,
      },
      createInvalidKnowledgeGraphError,
    );
    if (!parsePropsResult.ok) return parsePropsResult;

    return okResult(
      new KnowledgeGraph(
        KnowledgeGraphId.create(),
        input.tenant,
        input.metadata,
        parsePropsResult.value,
      ),
    );
  }

  static restore(input: RestoreKnowledgeGraphInput): KnowledgeGraph {
    return new KnowledgeGraph(
      KnowledgeGraphId.restore(input.payload.id),
      input.tenant,
      input.metadata,
      parsePropsOrThrow(knowledgeGraphPropsSchema, {
        name: input.payload.name,
        embeddingModel: input.payload.embeddingModel,
        embeddingDimensions: input.payload.embeddingDimensions,
      }),
    );
  }

  /** Graph-wide policy a node can't see on its own: does this embedding match the graph's spec? */
  accepts(embedding: Embedding): boolean {
    return (
      embedding.model === this._props.embeddingModel &&
      embedding.dimensions === this._props.embeddingDimensions
    );
  }
}

export { KnowledgeGraph };
