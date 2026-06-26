import { z } from "zod";

const permissionSchema = z.enum(["knowledge:read", "ingestion:write"]);

type Permission = z.output<typeof permissionSchema>;

const permissions = {
  knowledgeRead: "knowledge:read",
  ingestionWrite: "ingestion:write",
} as const satisfies Record<string, Permission>;

export { permissionSchema, permissions };
export type { Permission };
