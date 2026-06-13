import { defineError } from "@repo/server-kernel";

const createInvalidGraphError = defineError(
  "InvalidGraph",
  "validation",
);
type InvalidGraphError = ReturnType<
  typeof createInvalidGraphError
>;

export { createInvalidGraphError };
export type { InvalidGraphError };
