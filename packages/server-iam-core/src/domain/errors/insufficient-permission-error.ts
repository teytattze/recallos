import { defineError } from "@repo/server-kernel";

const createInsufficientPermissionError = defineError(
  "InsufficientPermission",
  "forbidden",
);
type InsufficientPermissionError = ReturnType<
  typeof createInsufficientPermissionError
>;

export { createInsufficientPermissionError };
export type { InsufficientPermissionError };
