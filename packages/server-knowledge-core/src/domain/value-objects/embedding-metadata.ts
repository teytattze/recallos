import { parseProps, ValueObject } from "@repo/server-kernel";
import z from "zod";

const embeddingMetadataPropsSchema = z.object({
  dimension: z.enum(["1024"]),
  model: z.enum(["voyage-4-large"]),
});

type EmbeddingMetadataPropsIn = z.input<typeof embeddingMetadataPropsSchema>;
type EmbeddingMetadataProps = z.output<typeof embeddingMetadataPropsSchema>;

type CreateEmbeddingMetadataInput = {
  payload: EmbeddingMetadataPropsIn;
};
type RestoreEmbeddingMetadataInput = {
  payload: EmbeddingMetadataPropsIn;
};

class EmbeddingMetadata extends ValueObject<EmbeddingMetadataProps> {
  static create(input: CreateEmbeddingMetadataInput): EmbeddingMetadata {
    return new EmbeddingMetadata(
      parseProps(embeddingMetadataPropsSchema, input.payload),
    );
  }

  static restore(input: RestoreEmbeddingMetadataInput): EmbeddingMetadata {
    return new EmbeddingMetadata(
      parseProps(embeddingMetadataPropsSchema, input.payload),
    );
  }

  get dimension(): EmbeddingMetadataProps["dimension"] {
    return this._props.dimension;
  }
  get model(): EmbeddingMetadataProps["model"] {
    return this._props.model;
  }
}

export { EmbeddingMetadata };
export type { CreateEmbeddingMetadataInput, RestoreEmbeddingMetadataInput };
