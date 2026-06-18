import { z } from "zod";

const voyageaiConfigSchema = z.object({
  KNOWLEDGE_VOYAGEAI_API_KEY: z.string(),
});

const getVoyageaiConfig = () => voyageaiConfigSchema.parse(process.env);

export { getVoyageaiConfig };
