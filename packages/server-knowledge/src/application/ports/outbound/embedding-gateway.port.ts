export interface EmbeddingGatewayPort {
  embed(texts: string[], model: string): Promise<number[][]>;
}
