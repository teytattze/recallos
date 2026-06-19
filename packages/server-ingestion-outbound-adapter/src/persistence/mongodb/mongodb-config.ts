import { z } from "zod";

const mongodbConfigSchema = z.object({
  INGESTION_MONGODB_URL: z.string(),
  INGESTION_MONGODB_DATABASE_NAME: z.string(),
});

const getMongodbConfig = () => mongodbConfigSchema.parse(process.env);

export { getMongodbConfig };
