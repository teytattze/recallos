import { z } from "zod";

const httpConfigSchema = z.object({
  INGESTION_PORT: z.number().int(),
});

const getHttpConfig = () => httpConfigSchema.parse(process.env);

export { getHttpConfig };
