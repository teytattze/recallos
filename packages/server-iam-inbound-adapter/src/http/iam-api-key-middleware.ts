import type { IamPermission, VerifyIamApiKeyPort } from "@repo/server-iam-core";
import type { MiddlewareHandler } from "hono";

import type { IamHonoEnv } from "./iam-context.ts";

type CreateIamApiKeyMiddlewareInput = {
  readonly requiredPermissions: readonly IamPermission[];
  readonly verifyIamApiKey: VerifyIamApiKeyPort;
};

type CategorizedError = {
  readonly kind: string;
};

const isCategorizedError = (error: unknown): error is CategorizedError =>
  typeof error === "object" &&
  error !== null &&
  "kind" in error &&
  typeof error.kind === "string";

const createIamApiKeyMiddleware = (
  input: CreateIamApiKeyMiddlewareInput,
): MiddlewareHandler<IamHonoEnv> => {
  return async (c, next) => {
    try {
      const principal = await input.verifyIamApiKey.execute({
        apiKey: c.req.header("x-api-key"),
        requiredPermissions: input.requiredPermissions,
      });

      c.set("iamPrincipal", principal);

      await next();
      return undefined;
    } catch (error) {
      if (
        isCategorizedError(error) &&
        (error.kind === "MissingIamApiKey" || error.kind === "InvalidIamApiKey")
      ) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      if (
        isCategorizedError(error) &&
        error.kind === "InsufficientIamPermission"
      ) {
        return c.json({ message: "Forbidden" }, 403);
      }

      throw error;
    }
  };
};

export { createIamApiKeyMiddleware };
export type { CreateIamApiKeyMiddlewareInput };
