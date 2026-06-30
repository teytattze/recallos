import type { Permission } from "./permission.ts";

type PrincipalBase = {
  readonly tenant: string;
  readonly organizationId: string;
  readonly permissions: readonly Permission[];
};

type ApiKeyPrincipal = PrincipalBase & {
  readonly authenticationMethod: "api-key";
  readonly apiKeyId: string;
};

type SessionCookiePrincipal = PrincipalBase & {
  readonly authenticationMethod: "session-cookie";
  readonly sessionId: string;
  readonly userId: string;
};

type Principal = ApiKeyPrincipal | SessionCookiePrincipal;

export type { ApiKeyPrincipal, Principal, SessionCookiePrincipal };
