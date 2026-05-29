# infrastructure

AWS CDK (v2, TypeScript, run via Bun) that deploys the RecallOS container
images to AWS. It is a standalone project — deliberately **not** part of the
Turbo workspaces — so CDK's toolchain stays out of the app build/lint/test path.

## What it provisions

Two independently deployable stacks:

- **`RecallosEcrStack`** — the single ECR repository CI pushes every app image
  to (images are tagged `<app>.<version>`, e.g. `server-api-service.main-abc1234`).
- **`RecallosServiceStack`** — a VPC + ECS Fargate cluster that runs each image:
  - `server-api-service` behind a public Application Load Balancer (port 8000,
    health check `/api/v1/health`),
  - `server-knowledge-worker` and `server-outbox-worker` as headless Fargate
    services.

## Configuration

Resolved from CDK context (`-c key=value`), then environment, then defaults:

| Key                  | Env                     | Default     | Notes                                  |
| -------------------- | ----------------------- | ----------- | -------------------------------------- |
| `account`            | `CDK_DEFAULT_ACCOUNT`   | —           | Target AWS account.                    |
| `region`             | `CDK_DEFAULT_REGION`    | `us-east-1` | Target region.                         |
| `ecrRepositoryName`  | `ECR_REPOSITORY_NAME`   | `recallos`  | Must match CI's `AWS_ECR_REPOSITORY`.  |
| `imageTag`           | `IMAGE_TAG`             | `latest`    | Version segment of the image tag.      |

## Usage

```sh
cd infrastructure
bun install

# 1. Create the registry, then let CI push images to it.
bun run deploy -- RecallosEcrStack

# 2. Deploy the services against a specific image version.
bun run deploy -- RecallosServiceStack -c imageTag=main-abc1234

# Other commands
bun run synth      # synthesize CloudFormation
bun run diff       # diff against deployed state
bun run build      # type-check
```

`bun run deploy` (no stack argument) deploys both stacks via `cdk deploy --all`.

## Out of scope

Data stores and queues the apps rely on at runtime (Aurora/pgvector, SQS, S3 —
see `compose.yml` and the server decision records) are not provisioned here;
this project covers running the published ECR images. Wire their connection
details in through the task `environment` in `lib/service-stack.ts` once those
resources exist.
