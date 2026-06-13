import {
  ValueObject,
  mapResult,
  parseProps,
  parsePropsOrThrow,
  type Result,
} from "@repo/server-kernel";
import { z } from "zod";

import { createInvalidGraphNodeError } from "../errors/invalid-graph-node-error.ts";

const embeddingPropsSchema = z.object({
  vector: z.array(z.number()).min(1, "embedding vector must not be empty"),
  model: z.string().trim().min(1, "embedding model must be provided"),
  dimensions: z.number().int().positive(),
});

type EmbeddingProps = z.infer<typeof embeddingPropsSchema>;

type CreateEmbeddingInput = {
  payload: {
    vector: number[];
    model: string;
  };
};

type RestoreEmbeddingInput = {
  payload: {
    vector: number[];
    model: string;
    dimensions: number;
  };
};

class Embedding extends ValueObject<EmbeddingProps> {
  private constructor(props: EmbeddingProps) {
    super(props);
  }

  static create(input: CreateEmbeddingInput): Result<Embedding> {
    return mapResult(
      parseProps(
        embeddingPropsSchema,
        {
          vector: input.payload.vector,
          model: input.payload.model,
          dimensions: input.payload.vector.length,
        },
        createInvalidGraphNodeError,
      ),
      (props) => new Embedding(props),
    );
  }

  static restore(input: RestoreEmbeddingInput): Embedding {
    return new Embedding(
      parsePropsOrThrow(embeddingPropsSchema, {
        vector: input.payload.vector,
        model: input.payload.model,
        dimensions: input.payload.dimensions,
      }),
    );
  }

  get model(): string {
    return this._props.model;
  }

  get dimensions(): number {
    return this._props.dimensions;
  }
}

export { Embedding };
