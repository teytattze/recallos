interface EmbeddingGatewayPort {
  embed(texts: string[], model: string): Promise<number[][]>;
}

export type { EmbeddingGatewayPort };
