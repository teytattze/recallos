import type { Permission, VerifyApiKeyPort } from "@repo/server-iam-core";
import type { MiddlewareHandler } from "hono";

import type { HonoEnv } from "./context.ts";

type CreateApiKeyMiddlewareInput = {
  readonly requiredPermissions: readonly Permission[];
  readonly verifyApiKey: VerifyApiKeyPort;
};

const createApiKeyMiddleware = (
  input: CreateApiKeyMiddlewareInput,
): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    const principal = await input.verifyApiKey.execute({
      apiKey: c.req.header("x-api-key"),
      requiredPermissions: input.requiredPermissions,
    });

    c.set("principal", principal);

    await next();
  };
};

export { createApiKeyMiddleware };
export type { CreateApiKeyMiddlewareInput };
