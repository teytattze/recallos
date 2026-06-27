import z from "zod";

const configSchema = z.object({
  app: z.object({
    environment: z.enum(["local", "staging", "production"]).default("local"),
  }),
  iam: z.object({
    authBaseUrl: z.url().default("http://localhost:8000"),
  }),
});

const env = import.meta.env;

const config = configSchema.parse({
  app: {
    environment: env.VITE_APP_ENVIRONMENT,
  },
  iam: {
    authBaseUrl: env.VITE_IAM_AUTH_BASE_URL,
  },
});

export { config };
