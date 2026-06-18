import type {
  EmbeddingGatewayPort,
  EmbeddingGatewayPortEmbedInput,
  EmbeddingGatewayPortEmbedOutput,
} from "@repo/server-knowledge-core";

import { z } from "zod";

const VOYAGEAI_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";

const voyageaiEmbeddingResponseSchema = z.object({
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
      index: z.number().int().nonnegative(),
    }),
  ),
});

class VoyageaiEmbeddingGateway implements EmbeddingGatewayPort {
  constructor(private readonly apiKey: string) {}

  async embed(
    input: EmbeddingGatewayPortEmbedInput,
  ): EmbeddingGatewayPortEmbedOutput {
    const response = await fetch(VOYAGEAI_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: input.texts,
        input_type: "document",
        model: input.model,
        output_dimension: Number(input.dimension),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Voyage AI embedding request failed with status ${response.status}`,
      );
    }

    const parsed = voyageaiEmbeddingResponseSchema.parse(await response.json());
    const embeddings = parsed.data
      .toSorted((left, right) => left.index - right.index)
      .map((item) => item.embedding);

    return { embeddings };
  }
}

export { VoyageaiEmbeddingGateway };
