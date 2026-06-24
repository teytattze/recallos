import { type IamPermission, iamPermissionSchema } from "@repo/server-iam-core";

type BetterAuthPermissionRecord = Record<string, string[]>;

const toBetterAuthPermissionRecord = (
  permissions: readonly IamPermission[],
): BetterAuthPermissionRecord => {
  const permissionRecord: BetterAuthPermissionRecord = {};

  for (const permission of permissions) {
    const [resource, action] = permission.split(":");

    if (resource === undefined || action === undefined) continue;

    permissionRecord[resource] = [
      ...(permissionRecord[resource] ?? []),
      action,
    ];
  }

  return permissionRecord;
};

const fromBetterAuthPermissionRecord = (input: unknown): IamPermission[] => {
  const parsedInput = typeof input === "string" ? parseJson(input) : input;

  if (
    typeof parsedInput !== "object" ||
    parsedInput === null ||
    Array.isArray(parsedInput)
  ) {
    return [];
  }

  return Object.entries(parsedInput).flatMap(([resource, actions]) => {
    if (!Array.isArray(actions)) return [];

    return actions.flatMap((action) => {
      if (typeof action !== "string") return [];

      const parsedPermission = iamPermissionSchema.safeParse(
        `${resource}:${action}`,
      );

      return parsedPermission.success ? [parsedPermission.data] : [];
    });
  });
};

const parseJson = (input: string): unknown => {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return undefined;
  }
};

export { fromBetterAuthPermissionRecord, toBetterAuthPermissionRecord };
export type { BetterAuthPermissionRecord };
