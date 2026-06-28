import { defineConfig, envSchema } from "@repo/app-config";
import z from "zod";

const activeEnv = envSchema.parse(import.meta.env.VITE_ENV);

const config = defineConfig({
  schema: z.object({
    app: z.object({
      version: z.string(),
    }),
    iam: z.object({
      authBaseUrl: z.url(),
    }),
  }),

  base: {
    local: {
      app: { version: "0.0.0" },
      iam: { authBaseUrl: "http://localhost:8000" },
    },
    test: {
      app: { version: "0.0.0" },
      iam: { authBaseUrl: "http://localhost:8000" },
    },
    staging: {},
    production: {},
  },

  runtime: {
    app: {
      version: import.meta.env.VITE_APP_VERSION,
    },
    iam: {
      authBaseUrl: import.meta.env.VITE_IAM_AUTH_BASE_URL,
    },
  },
})(activeEnv);

export { config };
