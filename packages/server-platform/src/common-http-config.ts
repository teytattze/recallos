import { z } from "zod";

const commonHttpConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
});

const getCommonHttpConfig = () => commonHttpConfigSchema.parse(process.env);

export { getCommonHttpConfig };
