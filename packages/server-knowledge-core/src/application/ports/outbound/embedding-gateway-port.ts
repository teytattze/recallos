type EmbeddingGatewayPortEmbedInput = {
  model: "voyage-4-large";
  dimension: "1024";
  text: string;
  inputType: "document" | "query";
};

type EmbeddingGatewayPortEmbedOutput = Promise<{
  embedding: number[];
}>;

interface EmbeddingGatewayPort {
  embed(input: EmbeddingGatewayPortEmbedInput): EmbeddingGatewayPortEmbedOutput;
}

export type {
  EmbeddingGatewayPort,
  EmbeddingGatewayPortEmbedInput,
  EmbeddingGatewayPortEmbedOutput,
};
