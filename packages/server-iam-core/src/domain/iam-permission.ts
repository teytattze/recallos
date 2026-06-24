import { z } from "zod";

const iamPermissionSchema = z.enum(["knowledge:read", "ingestion:write"]);

type IamPermission = z.output<typeof iamPermissionSchema>;

const iamPermissions = {
  knowledgeRead: "knowledge:read",
  ingestionWrite: "ingestion:write",
} as const satisfies Record<string, IamPermission>;

export { iamPermissionSchema, iamPermissions };
export type { IamPermission };
