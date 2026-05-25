import { AggregateRoot, EntityMetadata, Result } from "server-kernel";

import type { Embedding } from "./embedding.value-object.ts";
import type { KnowledgeGraphId } from "./ids.value-object.ts";

import { EmptyGraphNameError } from "./errors/index.ts";

type KnowledgeGraphProps = {
  name: string;
  embeddingModel: string;
  embeddingDimensions: number;
};

/**
 * The thin graph root (Approach A): identity + metadata + graph-wide policy. It
 * does not hold node/edge collections — those are independent aggregates that
 * reference the graph by id.
 */
export class KnowledgeGraph extends AggregateRoot<
  KnowledgeGraphId,
  KnowledgeGraphProps
> {
  private constructor(
    id: KnowledgeGraphId,
    metadata: EntityMetadata,
    props: KnowledgeGraphProps,
  ) {
    super(id, metadata, props);
  }

  get name(): string {
    return this._props.name;
  }

  get embeddingModel(): string {
    return this._props.embeddingModel;
  }

  get embeddingDimensions(): number {
    return this._props.embeddingDimensions;
  }

  static create(props: {
    id: KnowledgeGraphId;
    name: string;
    embeddingModel: string;
    embeddingDimensions: number;
    now: Date;
  }): Result<KnowledgeGraph> {
    const name = props.name.trim();
    if (name.length === 0) {
      return Result.err(
        EmptyGraphNameError("Knowledge graph name must not be empty"),
      );
    }
    return Result.ok(
      new KnowledgeGraph(props.id, EntityMetadata.create(props.now), {
        name,
        embeddingModel: props.embeddingModel,
        embeddingDimensions: props.embeddingDimensions,
      }),
    );
  }

  /** Graph-wide invariant a node aggregate can't see on its own. */
  accepts(embedding: Embedding): boolean {
    return (
      embedding.model === this._props.embeddingModel &&
      embedding.dimensions === this._props.embeddingDimensions
    );
  }
}
