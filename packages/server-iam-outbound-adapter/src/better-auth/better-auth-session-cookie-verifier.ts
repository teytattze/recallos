import type {
  Permission,
  SessionCookieVerifierPort,
  SessionCookieVerifierPortVerifyInput,
  SessionCookieVerifierPortVerifyOutput,
} from "@repo/server-iam-core";

import { AppError } from "@repo/app-error";
import { Tenant } from "@repo/server-kernel";

import { toBetterAuthPermissionRecord } from "./permission-record.ts";

type BetterAuthSession = {
  readonly session: {
    readonly id: string;
    readonly userId: string;
    readonly activeOrganizationId?: string | null;
  };
  readonly user: {
    readonly id: string;
  };
};

type BetterAuthHasPermissionResult = {
  readonly success: boolean;
};

type BetterAuthSessionCookieApi = {
  readonly getSession: (input: {
    readonly headers: Headers;
    readonly query?: {
      readonly disableCookieCache?: boolean;
      readonly disableRefresh?: boolean;
    };
  }) => Promise<BetterAuthSession | null>;
  readonly hasPermission: (input: {
    readonly headers: Headers;
    readonly body: {
      readonly organizationId: string;
      readonly permissions: Record<string, string[]>;
    };
  }) => Promise<BetterAuthHasPermissionResult>;
};

type BetterAuthSessionCookieVerifierInput = {
  readonly api: BetterAuthSessionCookieApi;
};

class BetterAuthSessionCookieVerifier implements SessionCookieVerifierPort {
  constructor(private readonly input: BetterAuthSessionCookieVerifierInput) {}

  async verify(
    input: SessionCookieVerifierPortVerifyInput,
  ): SessionCookieVerifierPortVerifyOutput {
    const headers = new Headers({ cookie: input.cookieHeader });
    const result = await this.input.api.getSession({
      headers,
      query: { disableCookieCache: true },
    });

    if (result === null) {
      throw AppError.ofCode("serverIamCore.invalidSessionCookie");
    }

    const organizationId = result.session.activeOrganizationId;

    if (
      organizationId === undefined ||
      organizationId === null ||
      organizationId.length === 0
    ) {
      throw AppError.ofCode("serverIamCore.invalidSessionCookie");
    }

    const permissionResult = await this.input.api.hasPermission({
      headers,
      body: {
        organizationId,
        permissions: toBetterAuthPermissionRecord(input.requiredPermissions),
      },
    });

    return {
      tenant: Tenant.create("organization", organizationId).toString(),
      organizationId,
      authenticationMethod: "session-cookie",
      sessionId: result.session.id,
      userId: result.user.id,
      permissions: this.resolvePermissions({
        authorized: permissionResult.success,
        verifiedPermissions: input.requiredPermissions,
      }),
    };
  }

  private resolvePermissions(input: {
    readonly authorized: boolean;
    readonly verifiedPermissions: readonly Permission[];
  }): readonly Permission[] {
    if (!input.authorized) return [];

    return input.verifiedPermissions;
  }
}

export { BetterAuthSessionCookieVerifier };
export type {
  BetterAuthHasPermissionResult,
  BetterAuthSession,
  BetterAuthSessionCookieApi,
};
