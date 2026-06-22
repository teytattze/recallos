# AGENTS.md

RecallOS is shared organizational memory. It ingests information from multiple sources, relates it, and makes relevant context available to people and AI agents through one interface.

## Working commands

- `bun run build`: build all workspaces in dependency order.
- `bun run dev`: run development tasks in watch mode.
- `bun run fmt`: format the repository.
- `bun run lint`: lint all applicable workspaces.
- `bun run test`: run all tests, including the container-backed end-to-end suite.

Append `--filter <path>` to target one workspace, for example `bun run test --filter ./packages/server-kernel`. End-to-end tests require a running container engine.

## Repository map

### Apps

- `apps/server-api/`: public API composition root for source ingestion and knowledge recall.
- `apps/server-worker/`: background composition root that turns ingested events into searchable knowledge.
- `apps/web-marketing/`: product marketing site.

Server apps assemble capabilities and manage runtime lifecycle. They do not import each other.

### Packages

- `packages/server-database/`: shared database connection and index-definition helpers.
- `packages/server-ingestion-core/`: ingestion domain rules and application use cases.
- `packages/server-ingestion-inbound-adapter/`: validates and translates incoming source events into ingestion calls.
- `packages/server-ingestion-outbound-adapter/`: fulfills ingestion persistence and authentication ports.
- `packages/server-kernel/`: shared domain building blocks and cross-context types.
- `packages/server-knowledge-core/`: knowledge-processing and recall domain rules and use cases.
- `packages/server-knowledge-inbound-adapter/`: exposes recall and drives knowledge processing from newly ingested events.
- `packages/server-knowledge-outbound-adapter/`: fulfills knowledge persistence and semantic-representation ports.
- `packages/server-platform/`: shared operational capabilities such as configuration, logging, and health reporting.
- `packages/typescript-config/`: shared compiler rules that keep workspace behavior consistent.

Core packages own policy. Adapter packages isolate delivery and infrastructure choices so those choices can change without rewriting business rules.

### Tests and documentation

- `tests/e2e-server/`: system tests that exercise the API, worker, data stores, and external-service boundaries together.
- `docs/engineering/`: authoritative engineering and testing patterns.
- `docs/thoughts/`: exploratory designs, not descriptions of current behavior unless explicitly stated.
- `decision-records/`: durable decisions and their reasoning. New records follow `template.md`.

## Architecture

### Server-side

The server uses hexagonal architecture and domain-driven design to keep product rules stable while delivery mechanisms and infrastructure evolve.

- **Core packages** own domain models, invariants, use cases, and port interfaces. They describe required capabilities without depending on concrete infrastructure.
- **Inbound adapters** translate external inputs into application calls.
- **Outbound adapters** fulfill application ports for persistence, authentication, and external services.
- **Composition roots** choose implementations, wire dependencies, and manage runtime lifecycle.
- **Platform packages** provide shared operational concerns. Core packages must not depend on them.

Dependencies point inward. Enforce this through workspace dependency declarations and follow the layer-specific guidance in `docs/engineering/`.

## Behavioral guidelines

These guidelines favor caution over speed. Use judgment for trivial tasks. They are working when diffs contain fewer unrelated changes, solutions need fewer rewrites, and ambiguity is resolved before implementation.

### Think before coding

- State material assumptions. Ask when uncertainty would change the solution.
- Present distinct interpretations and tradeoffs instead of choosing silently.
- Prefer a simpler approach when it meets the same goal.
- Stop and clarify requirements that are too ambiguous to implement safely.

### Simplicity first

- Implement only what was requested.
- Avoid abstractions, flexibility, configuration, and error handling without a current need.
- If the solution is substantially larger than the problem warrants, simplify it.

### Surgical changes

- Touch only files and lines required by the task.
- Preserve existing style and avoid unrelated cleanup or refactoring.
- Remove only imports, variables, or functions made obsolete by your changes.
- Mention unrelated problems instead of expanding scope to fix them.

Every changed line should trace directly to the request.

### Goal-driven execution

- Translate the request into observable success criteria before implementation.
- For behavioral changes, reproduce the current failure and verify the intended outcome.
- For refactors, establish that behavior is preserved before and after the change.
- For multi-step tasks, state a short plan with a verification step for each stage.
- Run the relevant checks and report anything that could not be verified.
