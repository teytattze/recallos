import { defineError } from "@repo/server-kernel";

const createInvalidSessionCookieError = defineError(
  "InvalidSessionCookie",
  "forbidden",
);
type InvalidSessionCookieError = ReturnType<
  typeof createInvalidSessionCookieError
>;

export { createInvalidSessionCookieError };
export type { InvalidSessionCookieError };
