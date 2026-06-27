import type {
  IamAuthSendEmailOtpInput,
  IamAuthVerifyEmailOtpInput,
} from "@/data/iam/iam-auth-data-schemas";
import type { BetterAuthError } from "@/vendors/better-auth/better-auth-client-error";

import { betterAuthClient } from "@/vendors/better-auth/better-auth-client";

import type { IamAuthDataSourceError } from "./iam-auth-data-errors";

import {
  type IamAuthActionDataModel,
  type IamAuthSessionDataModel,
} from "./iam-auth-data-models";

const toIamAuthDataSourceError = (
  error: BetterAuthError,
): IamAuthDataSourceError => ({
  kind: "iam-auth-data-source-error",
  message:
    error.message ??
    error.statusText ??
    "The IAM authentication request failed.",
  status: error.status,
  statusText: error.statusText,
});

const getActiveSession = async (): Promise<IamAuthSessionDataModel | null> => {
  const result = await betterAuthClient.getSession();

  if (result.error) {
    throw toIamAuthDataSourceError(result.error);
  }
  return result.data
    ? { user: { email: result.data.user.email, id: result.data.user.id } }
    : null;
};

const sendEmailOtp = async (
  input: IamAuthSendEmailOtpInput,
): Promise<IamAuthActionDataModel> => {
  const result = await betterAuthClient.emailOtp.sendVerificationOtp({
    email: input.email,
    type: "sign-in",
  });

  if (result.error) {
    throw toIamAuthDataSourceError(result.error);
  }
  return { succeeded: true };
};

const signOut = async (): Promise<IamAuthActionDataModel> => {
  const result = await betterAuthClient.signOut();

  if (result.error) {
    throw toIamAuthDataSourceError(result.error);
  }
  return { succeeded: true };
};

const verifyEmailOtp = async (
  input: IamAuthVerifyEmailOtpInput,
): Promise<IamAuthActionDataModel> => {
  const result = await betterAuthClient.signIn.emailOtp(input);

  if (result.error) {
    throw toIamAuthDataSourceError(result.error);
  }
  return { succeeded: true };
};

const iamAuthDataSource = {
  getActiveSession,
  sendEmailOtp,
  signOut,
  verifyEmailOtp,
};
export { iamAuthDataSource };
