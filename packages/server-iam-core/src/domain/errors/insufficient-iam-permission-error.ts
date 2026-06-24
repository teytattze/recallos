import { defineError } from "@repo/server-kernel";

const createInsufficientIamPermissionError = defineError(
  "InsufficientIamPermission",
  "forbidden",
);
type InsufficientIamPermissionError = ReturnType<
  typeof createInsufficientIamPermissionError
>;

export { createInsufficientIamPermissionError };
export type { InsufficientIamPermissionError };
