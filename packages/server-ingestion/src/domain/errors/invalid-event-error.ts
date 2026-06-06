import { defineError } from "@repo/server-kernel";

const createInvalidEventError = defineError("InvalidEvent", "validation");
type InvalidEventError = ReturnType<typeof createInvalidEventError>;

export { createInvalidEventError };
export type { InvalidEventError };
