import type {
  EmbeddingGatewayPort,
  EmbeddingGatewayPortEmbedInput,
  EmbeddingGatewayPortEmbedOutput,
} from "@repo/server-knowledge-core";

import { z } from "zod";

const VOYAGEAI_BASE_URL = "https://api.voyageai.com/v1";

const voyageaiEmbeddingResponseSchema = z.object({
  data: z.tuple([
    z.object({
      embedding: z.array(z.number()),
      index: z.number().int().nonnegative(),
    }),
  ]),
});

class VoyageaiEmbeddingGateway implements EmbeddingGatewayPort {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = VOYAGEAI_BASE_URL,
  ) {}

  async embed(
    input: EmbeddingGatewayPortEmbedInput,
  ): EmbeddingGatewayPortEmbedOutput {
    const embeddingsUrl = new URL(
      "embeddings",
      this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`,
    ).toString();

    const response = await fetch(embeddingsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: input.text,
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

    return { embedding: parsed.data[0].embedding };
  }
}

export { VoyageaiEmbeddingGateway };
