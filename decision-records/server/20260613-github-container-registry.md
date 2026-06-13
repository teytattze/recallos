# GitHub Container Registry for runtime images

- **Status:** Accepted
- **Date:** 20260613
- **Deciders:** Liam Tat Tze Tey
- **Scope:** Container image publishing for deployable runtime apps in this monorepo.

---

## Context

- The CI pipeline publishes container images for each runtime app after building the Bun artifact.
- The previous pipeline targeted AWS Private ECR and included AWS credential setup, ECR login, and an ECR provisioning job.
- The repository no longer has the referenced infrastructure package, so the ECR provisioning step is stale and couples image publishing to AWS-specific CI configuration.
- GitHub Container Registry can publish packages from GitHub Actions with `GITHUB_TOKEN`, which removes registry-specific AWS credentials from the image publishing path.

## Decision

> Publish runtime container images to GitHub Container Registry as one package per app.

- CI will publish `server-api-service`, `server-ingestion-worker`, and `server-knowledge-worker` images to `ghcr.io/<owner>/<app>:<version>`.
- Image tags keep the existing version extraction behavior: release tags use the tag name, and `main` uses `main-<sha7>`.
- CI will not publish a floating `latest` tag.

## Consequences

- **Positive:** image publishing no longer needs AWS registry credentials, ECR login, or ECR repository provisioning in CI.
- **Trade-offs:** deployment consumers must update image references from ECR to GHCR and authenticate if GHCR packages are private.
- **Follow-ups:** configure GHCR package visibility after the first publish and update any runtime deployment configuration that still pulls ECR images.

## Alternatives considered

- **Keep AWS Private ECR** - keeps deployment image references stable, but retains stale provisioning in CI and AWS-specific registry credentials.
- **Publish one GHCR package with app-prefixed tags** - closer to the old ECR tag shape, but makes package ownership and app-level visibility less explicit than one package per runtime.
