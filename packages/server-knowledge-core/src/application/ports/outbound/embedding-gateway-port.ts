type EmbeddingGatewayPortEmbedInput = {
  model: "voyage-4-large";
  dimension: "1024";
  texts: string[];
};

type EmbeddingGatewayPortEmbedOutput = Promise<{
  embeddings: number[][];
}>;

interface EmbeddingGatewayPort {
  embed(input: EmbeddingGatewayPortEmbedInput): EmbeddingGatewayPortEmbedOutput;
}

export type {
  EmbeddingGatewayPort,
  EmbeddingGatewayPortEmbedInput,
  EmbeddingGatewayPortEmbedOutput,
};
