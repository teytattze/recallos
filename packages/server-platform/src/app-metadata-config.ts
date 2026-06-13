import { z } from "zod";

const appMetadataConfigSchema = z.object({
  APP_ENV: z.enum(["staging", "production"]).default("staging"),
  APP_VERSION: z.string().default("0.0.0"),
  APP_IS_LOCAL: z.coerce.boolean().default(true),
});
type AppMetadataConfig = z.infer<typeof appMetadataConfigSchema>;

const getAppMetadataConfigSchema = () =>
  appMetadataConfigSchema.parse(process.env);

export { getAppMetadataConfigSchema };
export type { AppMetadataConfig };
