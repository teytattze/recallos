import { defineConfig, envSchema } from "@repo/app-config";
import z from "zod";
import "dotenv/config";

const activeEnv = envSchema.parse(process.env.NODE_ENV);

const config = defineConfig({
  schema: z.object({
    app: z.object({
      version: z.string(),
      http: z.object({
        port: z.coerce.number().int().positive(),
      }),
    }),
    ingestion: z.object({
      mongodb: z.object({
        url: z.url(),
        databaseName: z.string(),
      }),
    }),
    knowledge: z.object({
      mongodb: z.object({
        url: z.url(),
        databaseName: z.string(),
      }),
      voyageai: z.object({
        apiKey: z.string(),
        baseUrl: z.url(),
      }),
    }),
  }),

  base: {
    local: {
      app: {
        version: "0.0.0",
        http: { port: 8001 },
      },
      ingestion: {
        mongodb: {
          databaseName: "recallos",
        },
      },
      knowledge: {
        mongodb: {
          databaseName: "recallos",
        },
        voyageai: {
          baseUrl: "https://api.voyageai.com/v1",
        },
      },
    },

    test: {
      app: {
        version: "0.0.0",
        http: { port: 8001 },
      },
      ingestion: {
        mongodb: {
          databaseName: "recallos",
        },
      },
      knowledge: {
        mongodb: {
          databaseName: "recallos",
        },
        voyageai: {
          baseUrl: "https://api.voyageai.com/v1",
        },
      },
    },

    staging: {
      app: {
        http: { port: 8001 },
      },
      ingestion: {
        mongodb: {
          databaseName: "recallos",
        },
      },
      knowledge: {
        mongodb: {
          databaseName: "recallos",
        },
        voyageai: {
          baseUrl: "https://api.voyageai.com/v1",
        },
      },
    },

    production: {
      app: {
        http: { port: 8001 },
      },
      ingestion: {
        mongodb: {
          databaseName: "recallos",
        },
      },
      knowledge: {
        mongodb: {
          databaseName: "recallos",
        },
        voyageai: {
          baseUrl: "https://api.voyageai.com/v1",
        },
      },
    },
  },

  runtime: {
    app: {
      version: process.env.APP_VERSION,
      http: {
        port: process.env.APP_HTTP_PORT,
      },
    },
    ingestion: {
      mongodb: {
        url: process.env.INGESTION_MONGODB_URL,
        databaseName: process.env.INGESTION_MONGODB_DATABASE_NAME,
      },
    },
    knowledge: {
      mongodb: {
        url: process.env.KNOWLEDGE_MONGODB_URL,
        databaseName: process.env.KNOWLEDGE_MONGODB_DATABASE_NAME,
      },
      voyageai: {
        apiKey: process.env.KNOWLEDGE_VOYAGEAI_API_KEY,
        baseUrl: process.env.KNOWLEDGE_VOYAGEAI_BASE_URL,
      },
    },
  },
})(activeEnv);

export { config };
