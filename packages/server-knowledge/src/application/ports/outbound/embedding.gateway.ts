/** Turns text into vectors. Batched, so a page of nodes amortizes the call. */
export interface EmbeddingGateway {
  embed(texts: string[], model: string): Promise<number[][]>;
}
