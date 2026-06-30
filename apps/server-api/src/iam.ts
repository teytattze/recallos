import { createMongodbClient } from "@repo/server-database";
import {
  permissions,
  VerifyApiKeyUseCase,
  VerifySessionCookieUseCase,
} from "@repo/server-iam-core";
import {
  createAuthenticationMiddleware,
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
const verifySessionCookieUseCase = new VerifySessionCookieUseCase(
  betterAuth.sessionCookieVerifier,
);

// INBOUND
const iamHttpApp = new Hono();

["/email-otp/send-verification-otp", "/sign-in/email-otp"].map((subPath) =>
  iamHttpApp.use(
    `${iamConfig.basePath}${subPath}`,
    cors({
      origin: iamConfig.trustedOrigins,
      allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
      allowMethods: ["POST", "GET", "OPTIONS"],
      credentials: true,
    }),
  ),
);

iamHttpApp.on(["POST", "GET"], `${iamConfig.basePath}/*`, (c) =>
  betterAuth.handler(c.req.raw),
);

const requireKnowledgeRead = createAuthenticationMiddleware({
  requiredPermissions: [permissions.knowledgeRead],
  verifyApiKey: verifyApiKeyUseCase,
  verifySessionCookie: verifySessionCookieUseCase,
});
const requireIngestionWrite = createAuthenticationMiddleware({
  requiredPermissions: [permissions.ingestionWrite],
  verifyApiKey: verifyApiKeyUseCase,
  verifySessionCookie: verifySessionCookieUseCase,
});

export { getTenant, iamHttpApp, requireIngestionWrite, requireKnowledgeRead };
