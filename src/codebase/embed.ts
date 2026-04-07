import { VoyageAIClient } from "voyageai";
import { env } from "@/lib/env";

const EMBEDDING_MODEL = "voyage-code-3.5";

const voyageai = new VoyageAIClient({ apiKey: env.voyageaiApiKey });

async function embedTexts(texts: string[]): Promise<number[][]> {
  const result = await voyageai.embed({
    input: texts,
    model: EMBEDDING_MODEL,
  });

  return (result.data ?? []).map((item) => item.embedding ?? []);
}

async function embedQuery(query: string): Promise<number[]> {
  const [embedding] = await embedTexts([query]);
  return embedding ?? [];
}

export { embedTexts, embedQuery };
