import { createMongodbClient } from "@repo/server-database";
import { iamPermissions, VerifyIamApiKeyUseCase } from "@repo/server-iam-core";
import {
  createIamApiKeyMiddleware,
  getIamTenant,
} from "@repo/server-iam-inbound-adapter";
import { createBetterAuthIam } from "@repo/server-iam-outbound-adapter";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { config } from "./config.ts";

// CONFIG
const iamConfig = config.iam;

// OUTBOUND
const mongodbClient = createMongodbClient({
  url: iamConfig.mongodb.url,
});
const betterAuthIam = createBetterAuthIam({
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
const verifyIamApiKeyUseCase = new VerifyIamApiKeyUseCase(
  betterAuthIam.apiKeyVerifier,
);

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
  betterAuthIam.handler(c.req.raw),
);

const requireKnowledgeRead = createIamApiKeyMiddleware({
  requiredPermissions: [iamPermissions.knowledgeRead],
  verifyIamApiKey: verifyIamApiKeyUseCase,
});
const requireIngestionWrite = createIamApiKeyMiddleware({
  requiredPermissions: [iamPermissions.ingestionWrite],
  verifyIamApiKey: verifyIamApiKeyUseCase,
});

export {
  getIamTenant,
  iamHttpApp,
  requireIngestionWrite,
  requireKnowledgeRead,
};
