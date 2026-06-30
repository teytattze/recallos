import type {
  Permission,
  VerifyApiKeyPort,
  VerifySessionCookiePort,
} from "@repo/server-iam-core";
import type { MiddlewareHandler } from "hono";

import type { HonoEnv } from "./context.ts";

type CreateAuthenticationMiddlewareInput = {
  readonly requiredPermissions: readonly Permission[];
  readonly verifyApiKey: VerifyApiKeyPort;
  readonly verifySessionCookie: VerifySessionCookiePort;
};

type CategorizedError = {
  readonly kind: string;
};

const isCategorizedError = (error: unknown): error is CategorizedError =>
  typeof error === "object" &&
  error !== null &&
  "kind" in error &&
  typeof error.kind === "string";

const isUnauthorizedError = (error: CategorizedError): boolean =>
  error.kind === "MissingApiKey" ||
  error.kind === "InvalidApiKey" ||
  error.kind === "MissingSessionCookie" ||
  error.kind === "InvalidSessionCookie";

const createAuthenticationMiddleware = (
  input: CreateAuthenticationMiddlewareInput,
): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
    try {
      const apiKey = c.req.header("x-api-key")?.trim();
      const principal =
        apiKey === undefined || apiKey.length === 0
          ? await input.verifySessionCookie.execute({
              cookieHeader: c.req.header("cookie"),
              requiredPermissions: input.requiredPermissions,
            })
          : await input.verifyApiKey.execute({
              apiKey,
              requiredPermissions: input.requiredPermissions,
            });

      c.set("principal", principal);

      await next();
      return undefined;
    } catch (error) {
      if (isCategorizedError(error) && isUnauthorizedError(error)) {
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

export { createAuthenticationMiddleware };
export type { CreateAuthenticationMiddlewareInput };
