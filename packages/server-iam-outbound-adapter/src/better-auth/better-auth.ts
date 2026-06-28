import type { MongoClient } from "mongodb";

import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { emailOTP, organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

import { ResendOtpEmailSender } from "../email/resend-otp-email-sender.ts";
import { BetterAuthApiKeyVerifier } from "./better-auth-api-key-verifier.ts";

type BetterAuthConfig = {
  readonly baseUrl: string;
  readonly basePath: string;
  readonly secrets: readonly {
    readonly version: number;
    readonly value: string;
  }[];
  readonly trustedOrigins: readonly string[];
  readonly mongodb: {
    readonly databaseName: string;
  };
  readonly resend: {
    readonly apiKey: string;
    readonly from: string;
  };
  readonly otp: {
    readonly length: number;
    readonly expiresInSeconds: number;
    readonly allowedAttempts: number;
  };
  readonly apiKey: {
    readonly configId: string;
    readonly prefix: string;
    readonly rateLimit: {
      readonly enabled: boolean;
      readonly maxRequests: number;
      readonly timeWindowMilliseconds: number;
    };
  };
};

type CreateBetterAuthInput = {
  readonly mongodbClient: MongoClient;
  readonly config: BetterAuthConfig;
};

const accessControl = createAccessControl({
  ...defaultStatements,
  apiKey: ["create", "read", "update", "delete"],
} as const);
const ownerRole = accessControl.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
  apiKey: ["create", "read", "update", "delete"],
});
const adminRole = accessControl.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: ["create", "update", "delete"],
  ac: ["create", "read", "update", "delete"],
  apiKey: ["create", "read", "update", "delete"],
});
const memberRole = accessControl.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ["read"],
  apiKey: ["read"],
});

const createBetterAuth = (input: CreateBetterAuthInput) => {
  const otpEmailSender = new ResendOtpEmailSender(input.config.resend);
  const auth = betterAuth({
    appName: "RecallOS",
    baseURL: input.config.baseUrl,
    basePath: input.config.basePath,
    database: mongodbAdapter(
      input.mongodbClient.db(input.config.mongodb.databaseName),
      { client: input.mongodbClient, usePlural: true },
    ),
    secrets: [...input.config.secrets],
    trustedOrigins: [...input.config.trustedOrigins],
    verification: {
      storeIdentifier: "hashed",
      storeInDatabase: true,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
    },
    plugins: [
      organization({
        ac: accessControl,
        roles: {
          owner: ownerRole,
          admin: adminRole,
          member: memberRole,
        },
      }),
      emailOTP({
        allowedAttempts: input.config.otp.allowedAttempts,
        disableSignUp: false,
        expiresIn: input.config.otp.expiresInSeconds,
        otpLength: input.config.otp.length,
        resendStrategy: "rotate",
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp, type }) => {
          await otpEmailSender.send({ email, otp, type });
        },
      }),
      apiKey({
        configId: input.config.apiKey.configId,
        references: "organization",
        defaultPrefix: input.config.apiKey.prefix,
        rateLimit: {
          enabled: input.config.apiKey.rateLimit.enabled,
          maxRequests: input.config.apiKey.rateLimit.maxRequests,
          timeWindow: input.config.apiKey.rateLimit.timeWindowMilliseconds,
        },
        storage: "database",
      }),
    ],
  });

  return {
    handler: auth.handler,
    apiKeyVerifier: new BetterAuthApiKeyVerifier({
      api: auth.api,
      configId: input.config.apiKey.configId,
    }),
  };
};

export { createBetterAuth };
export type { BetterAuthConfig, CreateBetterAuthInput };
