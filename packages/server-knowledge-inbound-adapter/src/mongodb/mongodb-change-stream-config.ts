import { z } from "zod";

const mongodbChangeStreamConfigSchema = z.object({
  INGESTION_MONGODB_URL: z.string(),
  INGESTION_MONGODB_DATABASE_NAME: z.string(),
});

const getMongodbChangeStreamConfig = () =>
  mongodbChangeStreamConfigSchema.parse(process.env);

export { getMongodbChangeStreamConfig };
