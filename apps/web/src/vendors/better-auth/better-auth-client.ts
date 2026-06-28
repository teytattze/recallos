import { apiKeyClient } from "@better-auth/api-key/client";
import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type {
  BetterAuthActionResponse,
  BetterAuthSessionResponse,
} from "@/vendors/better-auth/better-auth-client-dto";

import { config } from "@/config";

type BetterAuthClient = {
  emailOtp: {
    sendVerificationOtp: (input: {
      email: string;
      type: "sign-in";
    }) => Promise<BetterAuthActionResponse>;
  };
  getSession: () => Promise<BetterAuthSessionResponse>;
  signIn: {
    emailOtp: (input: {
      email: string;
      otp: string;
    }) => Promise<BetterAuthActionResponse>;
  };
  signOut: () => Promise<BetterAuthActionResponse>;
};

const betterAuthClient: BetterAuthClient = createAuthClient({
  baseURL: config.iam.authBaseUrl,
  basePath: config.iam.authBasePath,
  plugins: [emailOTPClient(), organizationClient(), apiKeyClient()],
});

export { betterAuthClient };
export type { BetterAuthClient };
