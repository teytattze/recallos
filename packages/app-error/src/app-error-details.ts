import { isString } from "es-toolkit";

type BaseAppErrorDefinition<T extends string | undefined = undefined> = {
  mappings: {
    httpStatus: number;
  };
  message: string;
  origin: T extends undefined ? null : T;
};
type BaseAppErrorDefinitions<T extends string | undefined = undefined> = Record<
  T extends undefined ? string : `${T}.${string}`,
  BaseAppErrorDefinition<T>
>;

const baseAppErrorCodeToDefinition = {
  unknown: {
    mappings: { httpStatus: 500 },
    message: "Unknown error",
    origin: null,
  },
} as const satisfies BaseAppErrorDefinitions;

const serverAppErrorCodeToDefinition = {
  "serverKernel.invariantViolation": {
    mappings: { httpStatus: 422 },
    message: "Invalid request",
    origin: "serverKernel",
  },
  "serverIngestionCore.invalidWebhookAuthentication": {
    mappings: { httpStatus: 403 },
    message: "Forbidden",
    origin: "serverIngestionCore",
  },
  "serverIngestionCore.webhookSubscriptionNotFound": {
    mappings: { httpStatus: 404 },
    message: "Not found",
    origin: "serverIngestionCore",
  },
  "serverIamCore.missingApiKey": {
    mappings: { httpStatus: 401 },
    message: "Unauthorized",
    origin: "serverIamCore",
  },
  "serverIamCore.invalidApiKey": {
    mappings: { httpStatus: 401 },
    message: "Unauthorized",
    origin: "serverIamCore",
  },
  "serverIamCore.missingSessionCookie": {
    mappings: { httpStatus: 401 },
    message: "Unauthorized",
    origin: "serverIamCore",
  },
  "serverIamCore.invalidSessionCookie": {
    mappings: { httpStatus: 401 },
    message: "Unauthorized",
    origin: "serverIamCore",
  },
  "serverIamCore.insufficientPermission": {
    mappings: { httpStatus: 403 },
    message: "Forbidden",
    origin: "serverIamCore",
  },
  "serverKnowledgeCore.graphNotFound": {
    mappings: { httpStatus: 404 },
    message: "Not found",
    origin: "serverKnowledgeCore",
  },
} as const satisfies BaseAppErrorDefinitions<
  | "serverIamCore"
  | "serverIngestionCore"
  | "serverKernel"
  | "serverKnowledgeCore"
>;

const webAppErrorCodeToDefinition = {} as const satisfies Record<
  string,
  BaseAppErrorDefinition
>;

const appErrorCodeToDefinition = {
  ...baseAppErrorCodeToDefinition,
  ...serverAppErrorCodeToDefinition,
  ...webAppErrorCodeToDefinition,
} as const satisfies BaseAppErrorDefinitions<string>;

type AppErrorCodeToDefinition = typeof appErrorCodeToDefinition;
type AppErrorCode = keyof AppErrorCodeToDefinition;
type AppErrorDefinition = AppErrorCodeToDefinition[AppErrorCode];

const isAppErrorCode = (v: unknown): v is AppErrorCode =>
  isString(v) && v in appErrorCodeToDefinition;

export { appErrorCodeToDefinition, isAppErrorCode };
export type { AppErrorCode, AppErrorDefinition };
