import {
  EntityMetadata,
  parseProps,
  Tenant,
  TenantAwareAggregateRoot,
} from "@repo/server-kernel";
import z from "zod";

import {
  EmbeddingMetadata,
  type CreateEmbeddingMetadataInput,
  type RestoreEmbeddingMetadataInput,
} from "../value-objects/embedding-metadata";
import { GraphId } from "../value-objects/graph-id";

const graphPropsSchema = z.object({
  embeddingMetadata: z.custom<EmbeddingMetadata>(
    (v) => v instanceof EmbeddingMetadata,
  ),
});

type GraphProps = z.output<typeof graphPropsSchema>;

type CreateGraphInput = {
  tenant: string;
  metadata: { now: Date };
  payload: {
    embeddingMetadata: CreateEmbeddingMetadataInput;
  };
};
type RestoreGraphInput = {
  tenant: string;
  metadata: { createdAt: Date; updatedAt: Date };
  payload: {
    id: string;
    embeddingMetadata: RestoreEmbeddingMetadataInput;
  };
};

class Graph extends TenantAwareAggregateRoot<GraphId, GraphProps> {
  static create(input: CreateGraphInput): Graph {
    return new Graph(
      GraphId.create(),
      Tenant.fromString(input.tenant),
      EntityMetadata.create({ payload: input.metadata }),
      parseProps(graphPropsSchema, {
        embeddingMetadata: EmbeddingMetadata.create(
          input.payload.embeddingMetadata,
        ),
      }),
    );
  }

  static restore(input: RestoreGraphInput): Graph {
    return new Graph(
      GraphId.restore({ payload: input.payload.id }),
      Tenant.fromString(input.tenant),
      EntityMetadata.restore({ payload: input.metadata }),
      parseProps(graphPropsSchema, {
        embeddingMetadata: EmbeddingMetadata.restore(
          input.payload.embeddingMetadata,
        ),
      }),
    );
  }

  get embeddingMetadata(): GraphProps["embeddingMetadata"] {
    return this._props.embeddingMetadata;
  }
}

export { Graph };
