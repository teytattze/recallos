import { defineError } from "@repo/server-kernel";

const createMissingSessionCookieError = defineError(
  "MissingSessionCookie",
  "forbidden",
);
type MissingSessionCookieError = ReturnType<
  typeof createMissingSessionCookieError
>;

export { createMissingSessionCookieError };
export type { MissingSessionCookieError };
