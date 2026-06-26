import type { Permission } from "./permission.ts";

type Principal = {
  readonly tenant: string;
  readonly organizationId: string;
  readonly apiKeyId: string;
  readonly permissions: readonly Permission[];
};

export type { Principal };
