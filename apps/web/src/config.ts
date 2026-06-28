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
      authBasePath: z.string(),
    }),
  }),

  base: {
    local: {
      app: { version: "0.0.0" },
      iam: {
        authBaseUrl: "http://localhost:8000",
        authBasePath: "/api/v1/iam",
      },
    },
    test: {
      app: { version: "0.0.0" },
      iam: {
        authBaseUrl: "http://localhost:8000",
        authBasePath: "/api/v1/iam",
      },
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
      authBasePath: import.meta.env.VITE_IAM_AUTH_BASE_PATH,
    },
  },
})(activeEnv);

export { config };
