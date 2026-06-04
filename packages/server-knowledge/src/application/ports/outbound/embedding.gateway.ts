export interface EmbeddingGateway {
  embed(texts: string[], model: string): Promise<number[][]>;
}
