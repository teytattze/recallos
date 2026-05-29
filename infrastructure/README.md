# @repo/infrastructure

AWS CDK (v2, TypeScript) that deploys the RecallOS container images to AWS. It
is a Bun + Turborepo workspace package; CDK runs through Bun, so there is no
separate compile step.

## What it provisions

Two independently deployable CloudFormation stacks:

- **`RecallosEcrStack`** — the single ECR repository CI pushes every app image
  to. Images are tagged `<app>.<version>` (e.g. `server-api-service.main-abc1234`).
- **`RecallosServiceStack`** — a VPC + ECS Fargate cluster that runs each image:
  - `server-api-service` behind a public Application Load Balancer (port 8000,
    health check `/api/v1/health`),
  - `server-knowledge-worker` and `server-outbox-worker` as headless Fargate
    services.

The service stack imports the ECR repository **by name** (not via a cross-stack
export), so the two stacks deploy independently and the name stays in sync with
CI's `AWS_ECR_REPOSITORY`.

## Prerequisites

- AWS credentials in your shell (`AWS_PROFILE`, env vars, or SSO) for the target
  account.
- The target account/region **bootstrapped** for CDK once:
  ```sh
  cd infrastructure
  bunx cdk bootstrap aws://<account>/<region>
  ```

## Configuration

Resolved from CDK context (`-c key=value`), then environment, then defaults:

| Key                 | Env                   | Default     | Notes                                 |
| ------------------- | --------------------- | ----------- | ------------------------------------- |
| `account`           | `CDK_DEFAULT_ACCOUNT` | —           | Target AWS account.                   |
| `region`            | `CDK_DEFAULT_REGION`  | `us-east-1` | Target region.                        |
| `ecrRepositoryName` | `ECR_REPOSITORY_NAME` | `recallos`  | Must match CI's `AWS_ECR_REPOSITORY`. |
| `imageTag`          | `IMAGE_TAG`           | `latest`    | Version segment of the image tag.     |

`account`/`region` are picked up automatically from your AWS credentials when
you run a `cdk deploy`. `imageTag` is the only value you normally pass by hand.

## Usage

Dependencies install from the repo root (`bun install`). Run the package scripts
through Turbo's filter, or `cd infrastructure` and call `bun run`
directly. Pass CDK flags after `--`.

```sh
# Inspect first.
bun run --filter @repo/infrastructure synth -- -c imageTag=main-abc1234
bun run --filter @repo/infrastructure diff  -- -c imageTag=main-abc1234

# 1. Create the registry, then let CI build and push images to it.
bun run --filter @repo/infrastructure deploy -- RecallosEcrStack

# 2. Deploy the services against a specific image version.
bun run --filter @repo/infrastructure deploy -- RecallosServiceStack -c imageTag=main-abc1234
```

| Script    | Action                                                |
| --------- | ----------------------------------------------------- |
| `build`   | Bundle the app entrypoint with `bun build` (CDK runs via Bun). |
| `synth`   | Synthesize CloudFormation templates to `cdk.out/`.    |
| `diff`    | Diff the synthesized stacks against what is deployed. |
| `deploy`  | `cdk deploy --all` (pass a stack id to scope it).     |
| `destroy` | `cdk destroy --all`.                                  |

### Typical deploy flow

Pushing a tag or merging to `main` runs the whole pipeline in
`.github/workflows/ci.yml`:

1. `deploy_ecr` runs `cdk deploy RecallosEcrStack` so the repository exists
   (idempotent — a no-op once created).
2. CI builds the images and pushes them as `<app>.<version>` to that repository.
3. `deploy_service` runs `cdk deploy RecallosServiceStack -c imageTag=<version>`
   to roll the cluster onto the new images.

To deploy a specific version by hand instead, run the step-3 command yourself.
`<version>` is what `extract-version` produced (`main-<sha7>` for `main`, or the
git tag).

## CI IAM permissions

The CI user (behind `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) only needs to
**assume the bootstrap roles** for the deploy — the heavy permissions live on
the bootstrap `cfn-exec-role`, not the user — plus **ECR push** for the
`upload_image` job. The finalized inline policy is in
[`ci-user-policy.json`](./ci-user-policy.json); substitute `<ACCOUNT_ID>`,
`<REGION>`, and the repository name (`recallos` = `AWS_ECR_REPOSITORY`) before
attaching it:

```sh
sed -e "s/<ACCOUNT_ID>/$AWS_ACCOUNT_ID/g" -e "s/<REGION>/$AWS_REGION/g" \
  ci-user-policy.json > /tmp/ci-user-policy.json
aws iam put-user-policy \
  --user-name <ci-user> \
  --policy-name recallos-ci \
  --policy-document file:///tmp/ci-user-policy.json
```

Assumes the default bootstrap qualifier (`hnb659fds`); a custom `--qualifier`
changes the role-name and SSM-parameter ARNs accordingly.

## Layout

```
infrastructure/
  bin/recallos.ts        # CDK app entrypoint — instantiates both stacks
  lib/config.ts          # context/env/default resolution + service definitions
  lib/ecr-stack.ts       # RecallosEcrStack
  lib/service-stack.ts   # RecallosServiceStack (VPC + Fargate)
  cdk.json               # `app` runs `bun bin/recallos.ts`
```

## Out of scope

Data stores and queues the apps rely on at runtime (Aurora/pgvector, SQS, S3 —
see `compose.yml` and the server decision records) are not provisioned here;
this package covers running the published ECR images. Wire their connection
details in through the task `environment` in `lib/service-stack.ts` once those
resources exist.
