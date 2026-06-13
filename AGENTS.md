# AGENTS.md

RecallOS is org-wide shared memory: ingest information from many sources, relate everything, and serve recall to humans and AI agents through one API. Bun + Turborepo monorepo. Dependency versions are centralized in the root `package.json` `catalog` and referenced as `"catalog:"` in each workspace.

## Commands

- `bun run build`: build every workspace topologically (`turbo run build`; respects `^build`). Single workspace: `--filter ./apps/server-api-service`.
- `bun run dev`: run watch/dev tasks (`turbo run dev`; cached off, persistent). Server apps use `bun --watch src/index.ts`.
- `bun run fmt`: format the whole repo with `oxfmt` (runs at the root, not through Turbo).
- `bun run lint`: lint every workspace (`turbo run lint`; each runs `oxlint`).
- `bun run test`: run every workspace's tests (`turbo run test`; each runs `bun test --randomize`).

**Note**: Append `--filter <path>` to run a Turbo command in a specific workspace. Eg. `bun run test --filter ./apps/server-api-service` or `bun run test --filter ./packages/server-kernel`.

## Project structures

### CI/CD

- `@.github/`: GitHub Actions. `workflows/ci.yml` runs on every branch/tag: unit test → build artifact → (on `main`/tags) build & push Docker image to ECR. `actions/extract-version/` is a composite action for image tagging.
- `@dockers/`: per-app Dockerfiles (`Dockerfile.service`).

### Apps

- `@apps/`: deployable runtimes — composition roots only; they wire inbound adapters, outbound adapters, platform primitives, and core use cases, and never import each other.
- `@apps/server-api-service/`: Hono HTTP API runtime. Currently a single `/api/v1/health` route. Built with `bun build … --target bun` to `dist/`.
- `@apps/server-knowledge-worker/`: knowledge worker runtime. Built with `bun build … --target bun` to `dist/`.

### Documentations

- `@decision-records/`: durable, committed engineering decisions with reasoning. Server decisions in `server/`, named `<YYYYMMDD>-<title>.md`; format follows `template.md` (pattern in `@docs/engineering/decision-record.md`).
- `@docs/`: design write-ups, engineering patterns, and exploration. `engineering/` is the source of truth for engineering patterns; `thoughts/` holds feature designs and trade-off analyses (e.g. `project-structure.md`, `database-tradeoffs.md`); `diagrams/` holds the Excalidraw architecture diagram.

### Packages

- `@packages/`: shared workspaces; every server package is prefixed `server-`.
- `@packages/server-ingestion-core/`: ingestion bounded context core — pure domain + application (event ingestion).
- `@packages/server-ingestion-inbound-adapter/`: inbound adapters for the ingestion context (HTTP, cron, queue triggers).
- `@packages/server-ingestion-outbound-adapter/`: outbound adapters for the ingestion context (persistence + gateways).
- `@packages/server-database/`: dedicated Prisma data layer for the consolidated Postgres cluster — single schema + migration history, `createPrismaClient` factory, `db:*` scripts.
- `@packages/server-kernel/`: DDD shared kernel — `Entity`, `AggregateRoot`, `ValueObject`, `DomainEvent`, `Id`, `Result`, `DomainError`, `Clock`, `Tenant`, schema helpers. Depends on `zod` and `es-toolkit` only.
- `@packages/server-knowledge-core/`: knowledge bounded context core — pure domain + application (knowledge graph).
- `@packages/server-knowledge-outbound-adapter/`: outbound adapters for the knowledge context.
- `@packages/server-platform/`: cross-cutting infra primitives — `zod` config, `pino` logger, (db pool, event bus, unit-of-work to come).
- `@packages/server-integration-testing/`: cross-context system integration tests — drives the real use cases/adapters against **Postgres + floci (SQS) Docker containers** (Testcontainers), no mocks. Requires a running Docker daemon; its `test` task is uncached.
- `@packages/typescript-config/`: shared strict tsconfig (`@repo/typescript-config`); extend `bun.json` for server packages.

## Architecture

### Server-side

The server side follows **hexagonal architecture + DDD**. Dependencies point inward only; the domain is a pure library with zero I/O, and everything touching the network, a DB, a clock, or a framework is an adapter behind a port. Per-layer patterns live in `@docs/engineering/`; `.claude/rules/` contains path-scoped Claude stubs that point there. The full blueprint is `@docs/thoughts/project-structure.md`. Layer summary:

- **Kernel** (`server-kernel`): DDD building blocks; depends on `zod` and `es-toolkit` only.
- **Domain** (`server-<context>-core/src/domain/`): entities, value objects, aggregates, events, invariants. Pure — `@repo/server-kernel`, `zod` only.
- **Application** (`server-<context>-core/src/application/`): use cases + inbound/outbound port interfaces. Pure; never names a concrete adapter.
- **Inbound adapters** (`server-<context>-inbound-adapter`): translate HTTP/cron/queue into inbound port calls.
- **Outbound adapters** (`server-<context>-outbound-adapter`): port implementations against real tech (Postgres, pgvector, external APIs).
- **Composition roots** (`apps/*`): deployable runtimes that wire inbound adapters, outbound adapters, platform primitives, and core use cases.
- **Platform** (`server-platform`): sideways cross-cutting infra (config, logger, pg pool, event bus); never imported by the domain.

The dependency rule is enforced primarily by what each `package.json` declares — a pure core package simply does not list a driver or `@repo/server-platform`. Each context can have a pure `@repo/server-<context>-core`, an optional `@repo/server-<context>-inbound-adapter`, and an optional `@repo/server-<context>-outbound-adapter`.

## Behavioral guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

### Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
