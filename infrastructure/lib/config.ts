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
  /** When true the task gets `SQS_QUEUE_URL` and permission to publish to it. */
  readonly needsQueue?: boolean;
}

export interface DomainConfig {
  /** Apex Route53 hosted zone, e.g. `recallos.io`. */
  readonly zoneName: string;
  /** Fully-qualified record for the API, e.g. `dev.api-service.recallos.io`. */
  readonly recordName: string;
}

export interface RecallosConfig {
  readonly env: { readonly account?: string; readonly region: string };
  /** The single ECR repository CI pushes every app image to. */
  readonly ecrRepositoryName: string;
  /** Version segment of the image tag, e.g. `main-abc1234`. */
  readonly imageTag: string;
  readonly services: readonly ServiceConfig[];
  /** When set, the exposed service gets an HTTPS ALB + Route53 alias record. */
  readonly domain?: DomainConfig;
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
    needsQueue: true,
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

  const zoneName =
    app.node.tryGetContext("hostedZoneName") ?? process.env.HOSTED_ZONE_NAME;
  const recordName =
    app.node.tryGetContext("apiDomainName") ?? process.env.API_DOMAIN_NAME;
  // Both are required to wire the domain; without them the ALB stays HTTP-only.
  const domain = zoneName && recordName ? { zoneName, recordName } : undefined;

  return {
    env: { account, region },
    ecrRepositoryName,
    imageTag,
    services: SERVICES,
    domain,
  };
}
