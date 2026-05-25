import { defineError } from "@repo/server-kernel";

export const InvalidEvent = defineError("InvalidEvent", "validation");
export type InvalidEvent = ReturnType<typeof InvalidEvent>;
