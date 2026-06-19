import { z } from "zod";

const mongodbConfigSchema = z.object({
  KNOWLEDGE_VOYAGEAI_API_KEY: z.string(),
});

const getMongodbConfig = () => mongodbConfigSchema.parse(process.env);

export { getMongodbConfig };
