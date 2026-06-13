interface EmbeddingGatewayPort {
  embed(input: {
    payload: { texts: string[]; model: string };
  }): Promise<number[][]>;
}

export type { EmbeddingGatewayPort };
