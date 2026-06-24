import type { IamPermission } from "./iam-permission.ts";

type IamPrincipal = {
  readonly tenant: string;
  readonly organizationId: string;
  readonly apiKeyId: string;
  readonly permissions: readonly IamPermission[];
};

export type { IamPrincipal };
