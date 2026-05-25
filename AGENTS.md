# AGENTS.md

RecallOS is org-wide shared memory: ingest information from many sources, relate everything, and serve recall to humans and AI agents through one API. Bun + Turborepo monorepo. Dependency versions are centralized in the root `package.json` `catalog` and referenced as `"catalog:"` in each workspace.

## Commands

- `bun run build`: build every workspace topologically (`turbo run build`; respects `^build`). Single workspace: `--filter ./apps/service`.
- `bun run dev`: run watch/dev tasks (`turbo run dev`; cached off, persistent). `apps/service` uses `bun --watch src/index.ts`.
- `bun run fmt`: format the whole repo with `oxfmt` (runs at the root, not through Turbo).
- `bun run lint`: lint every workspace (`turbo run lint`; each runs `oxlint`).
- `bun run test`: run every workspace's tests (`turbo run test`; each runs `bun test --randomize`).

**Note**: Append `--filter <path>` to run a Turbo command in a specific workspace. Eg. `bun run test --filter ./apps/service` or `bun run test --filter ./packages/server-kernel`.

## Project structures

### CI/CD

- `@.github/`: GitHub Actions. `workflows/ci.yml` runs on every branch/tag: unit test → build artifact → (on `main`/tags) build & push Docker image to ECR. `actions/extract-version/` is a composite action for image tagging.
- `@dockers/`: per-app Dockerfiles (`Dockerfile.service`).

### Apps

- `@apps/`: deployable runtimes — thin driving adapters (inbound + composition root only), never import each other.
- `@apps/service/`: Hono HTTP API (ingest + read). Currently a single `/api/v1/health` route. Built with `bun build … --target bun` to `dist/`.

### Documentations

- `@decision-records/`: durable, committed engineering decisions with reasoning. Server decisions in `server/`, named `<YYYYMMDD>-<title>.md`; format follows `template.md` (rules in `@.claude/rules/decision-record.md`).
- `@docs/`: design write-ups and exploration. `thoughts/` holds feature designs and trade-off analyses (e.g. `project-structure.md`, `database-tradeoffs.md`); `diagrams/` holds the Excalidraw architecture diagram.

### Packages

- `@packages/`: shared workspaces; every server package is prefixed `server-`.
- `@packages/server-ingestion/`: ingestion bounded context — pure domain + application (event ingestion). `@repo/server-kernel` only so far.
- `@packages/server-ingestion-infra/`: outbound adapters for the ingestion context (persistence + gateways).
- `@packages/server-kernel/`: DDD shared kernel — `Entity`, `AggregateRoot`, `ValueObject`, `DomainEvent`, `Id`, `Result`, `DomainError`, `Clock`, `Tenant`, schema helpers. Depends on `zod` only.
- `@packages/server-knowledge/`: knowledge bounded context — pure domain + application (knowledge graph).
- `@packages/server-knowledge-infra/`: outbound adapters for the knowledge context.
- `@packages/server-platform/`: cross-cutting infra primitives — `zod` config, `pino` logger, (db pool, event bus, unit-of-work to come).
- `@packages/typescript-config/`: shared strict tsconfig (`@repo/typescript-config`); extend `bun.json` for server packages.

## Architecture

### Server-side

The server side follows **hexagonal architecture + DDD**. Dependencies point inward only; the domain is a pure library with zero I/O, and everything touching the network, a DB, a clock, or a framework is an adapter behind a port. Per-layer rules live in `@.claude/rules/` (path-scoped) and the full blueprint is `@docs/thoughts/project-structure.md`. Layer summary:

- **Kernel** (`server-kernel`): DDD building blocks; depends on `zod` only.
- **Domain** (`server-<context>/src/domain/`): entities, value objects, aggregates, events, invariants. Pure — `@repo/server-kernel`, `zod`, `es-toolkit` only.
- **Application** (`server-<context>/src/application/`): use cases + inbound/outbound port interfaces. Pure; never names a concrete adapter.
- **Outbound adapters** (`server-<context>-infra`): port implementations against real tech (Postgres, pgvector, external APIs).
- **Inbound adapters + composition root** (`apps/*`): translate HTTP/cron/queue into port calls, and wire concrete adapters to use cases (DI).
- **Platform** (`server-platform`): sideways cross-cutting infra (config, logger, pg pool, event bus); never imported by the domain.

The dependency rule is enforced primarily by what each `package.json` declares — a pure package simply does not list a driver or `@repo/server-platform`. Each context is two packages: pure `@repo/server-<context>` + adapter `@repo/server-<context>-infra`.
