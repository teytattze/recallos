import type { Permission, VerifyApiKeyPort } from "@repo/server-iam-core";
import type { MiddlewareHandler } from "hono";

import type { HonoEnv } from "./context.ts";

type CreateApiKeyMiddlewareInput = {
  readonly requiredPermissions: readonly Permission[];
  readonly verifyApiKey: VerifyApiKeyPort;
};

type CategorizedError = {
  readonly kind: string;
};

const isCategorizedError = (error: unknown): error is CategorizedError =>
  typeof error === "object" &&
  error !== null &&
  "kind" in error &&
  typeof error.kind === "string";

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
      if (
        isCategorizedError(error) &&
        (error.kind === "MissingApiKey" || error.kind === "InvalidApiKey")
      ) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      if (
        isCategorizedError(error) &&
        error.kind === "InsufficientPermission"
      ) {
        return c.json({ message: "Forbidden" }, 403);
      }

      throw error;
    }
  };
};

export { createApiKeyMiddleware };
export type { CreateApiKeyMiddlewareInput };
