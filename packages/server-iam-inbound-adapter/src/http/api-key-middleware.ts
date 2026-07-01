import type { Permission, VerifyApiKeyPort } from "@repo/server-iam-core";
import type { MiddlewareHandler } from "hono";

import { AppError } from "@repo/app-error";

import type { HonoEnv } from "./context.ts";

type CreateApiKeyMiddlewareInput = {
  readonly requiredPermissions: readonly Permission[];
  readonly verifyApiKey: VerifyApiKeyPort;
};

const createApiKeyMiddleware = (
  input: CreateApiKeyMiddlewareInput,
): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    try {
      const principal = await input.verifyApiKey.execute({
        apiKey: c.req.header("x-api-key"),
        requiredPermissions: input.requiredPermissions,
      });

      c.set("principal", principal);

      await next();
      return undefined;
    } catch (error) {
      const appError = AppError.from(error);
      return c.json(appError.toJSON(), appError.httpStatus);
    }
  };
};

export { createApiKeyMiddleware };
export type { CreateApiKeyMiddlewareInput };
