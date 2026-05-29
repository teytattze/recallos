import {
  Result,
  ValueObject,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { z } from "zod";

import { InvalidKnowledgeGraphNode } from "./invalid-knowledge-graph-node.error.ts";

const embeddingPropsSchema = z.object({
  vector: z.array(z.number()).min(1, "embedding vector must not be empty"),
  model: z.string().trim().min(1, "embedding model must be provided"),
  dimensions: z.number().int().positive(),
});

type EmbeddingProps = z.infer<typeof embeddingPropsSchema>;

export class Embedding extends ValueObject<EmbeddingProps> {
  private constructor(props: EmbeddingProps) {
    super(props);
  }

  get vector(): number[] {
    return this._props.vector;
  }

  get model(): string {
    return this._props.model;
  }

  get dimensions(): number {
    return this._props.dimensions;
  }

  static create(vector: number[], model: string): Result<Embedding> {
    return Result.map(
      parseProps(
        embeddingPropsSchema,
        { vector, model, dimensions: vector.length },
        InvalidKnowledgeGraphNode,
      ),
      (props) => new Embedding(props),
    );
  }

  static restore(
    vector: number[],
    model: string,
    dimensions: number,
  ): Embedding {
    return new Embedding(
      parsePropsOrThrow(embeddingPropsSchema, { vector, model, dimensions }),
    );
  }
}
