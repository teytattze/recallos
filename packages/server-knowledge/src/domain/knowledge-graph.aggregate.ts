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

import type { Embedding } from "./embedding.value-object.ts";

import { InvalidKnowledgeGraph } from "./invalid-knowledge-graph.error.ts";
import { KnowledgeGraphId } from "./knowledge-graph-id.value-object.ts";

export type CreateKnowledgeGraphInput = {
  tenant: Tenant;
  name: string;
  embeddingModel: string;
  embeddingDimensions: number;
  now: Date;
};

export type RestoreKnowledgeGraphInput = {
  id: string;
  tenantType: TenantType;
  tenantId: string;
  name: string;
  embeddingModel: string;
  embeddingDimensions: number;
  createdAt: Date;
  updatedAt: Date;
};

const knowledgeGraphPropsSchema = z.object({
  name: z.string().trim().min(1, "knowledge graph name must not be empty"),
  embeddingModel: z.string().trim().min(1, "embedding model must be provided"),
  embeddingDimensions: z.number().int().positive(),
});

type KnowledgeGraphProps = z.infer<typeof knowledgeGraphPropsSchema>;

export class KnowledgeGraph extends TenantAwareAggregateRoot<
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
        name: input.name,
        embeddingModel: input.embeddingModel,
        embeddingDimensions: input.embeddingDimensions,
      },
      InvalidKnowledgeGraph,
    );
    if (!parsePropsResult.ok) return parsePropsResult;

    return Result.ok(
      new KnowledgeGraph(
        KnowledgeGraphId.create(),
        input.tenant,
        EntityMetadata.create(input.now),
        parsePropsResult.value,
      ),
    );
  }

  static restore(input: RestoreKnowledgeGraphInput): KnowledgeGraph {
    return new KnowledgeGraph(
      KnowledgeGraphId.restore(input.id),
      Tenant.of(input.tenantType, input.tenantId),
      EntityMetadata.restore(input.createdAt, input.updatedAt),
      parsePropsOrThrow(knowledgeGraphPropsSchema, {
        name: input.name,
        embeddingModel: input.embeddingModel,
        embeddingDimensions: input.embeddingDimensions,
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
