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

import { createInvalidGraphError } from "../errors/invalid-graph-error.ts";
import { GraphId } from "../value-objects/graph-id.ts";

type CreateGraphInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    name: string;
    embeddingModel: string;
    embeddingDimensions: number;
  };
};

type RestoreGraphInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    id: string;
    name: string;
    embeddingModel: string;
    embeddingDimensions: number;
  };
};

const graphPropsSchema = z.object({
  name: z.string().trim().min(1, "graph name must not be empty"),
  embeddingModel: z.string().trim().min(1, "embedding model must be provided"),
  embeddingDimensions: z.number().int().positive(),
});

type GraphProps = z.infer<typeof graphPropsSchema>;

class Graph extends TenantAwareAggregateRoot<
  GraphId,
  GraphProps
> {
  private constructor(
    id: GraphId,
    tenant: Tenant,
    metadata: EntityMetadata,
    props: GraphProps,
  ) {
    super(id, tenant, metadata, props);
  }

  static create(input: CreateGraphInput): Result<Graph> {
    const parsePropsResult = parseProps(
      graphPropsSchema,
      {
        name: input.payload.name,
        embeddingModel: input.payload.embeddingModel,
        embeddingDimensions: input.payload.embeddingDimensions,
      },
      createInvalidGraphError,
    );
    if (!parsePropsResult.ok) return parsePropsResult;

    return okResult(
      new Graph(
        GraphId.create(),
        input.tenant,
        input.metadata,
        parsePropsResult.value,
      ),
    );
  }

  static restore(input: RestoreGraphInput): Graph {
    return new Graph(
      GraphId.restore({ payload: input.payload.id }),
      input.tenant,
      input.metadata,
      parsePropsOrThrow(graphPropsSchema, {
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

export { Graph };
