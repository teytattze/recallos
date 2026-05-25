import { Result, ValueObject } from "server-kernel";

import {
  EmptyEmbeddingError,
  MissingEmbeddingModelError,
  NonFiniteEmbeddingError,
} from "./errors/index.ts";

type EmbeddingProps = {
  vector: readonly number[];
  model: string;
  dimensions: number;
};

/** A vector representation of a node's body, assigned by the Worker after creation. */
export class Embedding extends ValueObject<EmbeddingProps> {
  private constructor(props: EmbeddingProps) {
    super(props);
  }

  get vector(): readonly number[] {
    return this._props.vector;
  }

  get model(): string {
    return this._props.model;
  }

  get dimensions(): number {
    return this._props.dimensions;
  }

  static create(vector: readonly number[], model: string): Result<Embedding> {
    if (vector.length === 0) {
      return Result.err(
        EmptyEmbeddingError("Embedding vector must not be empty"),
      );
    }
    if (!vector.every((component) => Number.isFinite(component))) {
      return Result.err(
        NonFiniteEmbeddingError(
          "Embedding vector must contain only finite numbers",
        ),
      );
    }
    const trimmedModel = model.trim();
    if (trimmedModel.length === 0) {
      return Result.err(
        MissingEmbeddingModelError("Embedding model must be provided"),
      );
    }
    return Result.ok(
      new Embedding({
        vector: [...vector],
        model: trimmedModel,
        dimensions: vector.length,
      }),
    );
  }
}
