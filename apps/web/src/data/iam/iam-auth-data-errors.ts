type IamAuthDataSourceError = {
  readonly kind: "iam-auth-data-source-error";
  readonly message: string;
  readonly status?: number;
  readonly statusText?: string;
};

const isIamAuthDataSourceError = (
  value: unknown,
): value is IamAuthDataSourceError =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === "iam-auth-data-source-error";

export { isIamAuthDataSourceError };
export type { IamAuthDataSourceError };
