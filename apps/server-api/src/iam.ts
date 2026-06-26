import { createMongodbClient } from "@repo/server-database";
import { permissions, VerifyApiKeyUseCase } from "@repo/server-iam-core";
import {
  createApiKeyMiddleware,
  getTenant,
} from "@repo/server-iam-inbound-adapter";
import { createBetterAuth } from "@repo/server-iam-outbound-adapter";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { config } from "./config.ts";

// CONFIG
const iamConfig = config.iam;

// OUTBOUND
const mongodbClient = createMongodbClient({
  url: iamConfig.mongodb.url,
});
const betterAuth = createBetterAuth({
  mongodbClient,
  config: {
    baseUrl: iamConfig.baseUrl,
    basePath: iamConfig.basePath,
    trustedOrigins: iamConfig.trustedOrigins,
    secrets: iamConfig.secrets,
    mongodb: {
      databaseName: iamConfig.mongodb.databaseName,
    },
    resend: iamConfig.resend,
    otp: iamConfig.otp,
    apiKey: iamConfig.apiKey,
  },
});

// CORE
const verifyApiKeyUseCase = new VerifyApiKeyUseCase(betterAuth.apiKeyVerifier);

// INBOUND
const iamHttpApp = new Hono();

iamHttpApp.use(
  `${iamConfig.basePath}/*`,
  cors({
    origin: iamConfig.trustedOrigins,
    allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    credentials: true,
  }),
);
iamHttpApp.on(["POST", "GET"], `${iamConfig.basePath}/*`, (c) =>
  betterAuth.handler(c.req.raw),
);

const requireKnowledgeRead = createApiKeyMiddleware({
  requiredPermissions: [permissions.knowledgeRead],
  verifyApiKey: verifyApiKeyUseCase,
});
const requireIngestionWrite = createApiKeyMiddleware({
  requiredPermissions: [permissions.ingestionWrite],
  verifyApiKey: verifyApiKeyUseCase,
});

export { getTenant, iamHttpApp, requireIngestionWrite, requireKnowledgeRead };
