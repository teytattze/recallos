import type { App } from "aws-cdk-lib";

export interface ServiceConfig {
  /** App name; doubles as the image tag prefix CI uses (`<name>.<version>`). */
  readonly name: string;
  readonly cpu: number;
  readonly memoryLimitMiB: number;
  readonly desiredCount: number;
  /** When true the service is fronted by a public ALB on `containerPort`. */
  readonly exposed: boolean;
  readonly containerPort?: number;
}

export interface RecallosConfig {
  readonly env: { readonly account?: string; readonly region: string };
  /** The single ECR repository CI pushes every app image to. */
  readonly ecrRepositoryName: string;
  /** Version segment of the image tag, e.g. `main-abc1234`. */
  readonly imageTag: string;
  readonly services: readonly ServiceConfig[];
}

// Mirrors the apps CI builds and pushes to ECR. The API takes HTTP traffic on
// 8000 (Hono `/api/v1/health`); the workers run headless.
const SERVICES: readonly ServiceConfig[] = [
  {
    name: "server-api-service",
    cpu: 256,
    memoryLimitMiB: 512,
    desiredCount: 1,
    exposed: true,
    containerPort: 8000,
  },
  {
    name: "server-knowledge-worker",
    cpu: 256,
    memoryLimitMiB: 512,
    desiredCount: 1,
    exposed: false,
  },
  {
    name: "server-outbox-worker",
    cpu: 256,
    memoryLimitMiB: 512,
    desiredCount: 1,
    exposed: false,
  },
];

/** Resolve config from CDK context (`-c key=value`), then env, then defaults. */
export function loadConfig(app: App): RecallosConfig {
  const region =
    app.node.tryGetContext("region") ??
    process.env.CDK_DEFAULT_REGION ??
    "us-east-1";
  const account =
    app.node.tryGetContext("account") ?? process.env.CDK_DEFAULT_ACCOUNT;
  const ecrRepositoryName =
    app.node.tryGetContext("ecrRepositoryName") ??
    process.env.ECR_REPOSITORY_NAME ??
    "recallos";
  const imageTag =
    app.node.tryGetContext("imageTag") ?? process.env.IMAGE_TAG ?? "latest";

  return {
    env: { account, region },
    ecrRepositoryName,
    imageTag,
    services: SERVICES,
  };
}
