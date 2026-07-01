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

const createAuthenticationMiddleware = (
  input: CreateAuthenticationMiddlewareInput,
): MiddlewareHandler<HonoEnv> => {
  return async (c, next) => {
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
  };
};

export { createAuthenticationMiddleware };
export type { CreateAuthenticationMiddlewareInput };
