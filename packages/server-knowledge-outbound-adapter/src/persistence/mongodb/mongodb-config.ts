import { z } from "zod";

const mongodbConfigSchema = z.object({
  KNOWLEDGE_MONGODB_URL: z.string(),
  KNOWLEDGE_MONGODB_DATABASE_NAME: z.string(),
});

const getMongodbConfig = () => mongodbConfigSchema.parse(process.env);

export { getMongodbConfig };
