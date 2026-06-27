import type { BetterAuthError } from "@/vendors/better-auth/better-auth-client-error";

type BetterAuthActionResponse = {
  readonly error: BetterAuthError | null;
};

type BetterAuthSessionResponse = {
  readonly data: {
    readonly user: {
      readonly email: string;
      readonly id: string;
    };
  } | null;
  readonly error: BetterAuthError | null;
};

export type { BetterAuthActionResponse, BetterAuthSessionResponse };
