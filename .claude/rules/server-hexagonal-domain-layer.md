---
paths:
  - "packages/server-ingestion/src/domain/**/*"
  - "packages/server-knowledge/src/domain/**/*"
---

# Rules: Domain

## Scope

- Contains: entities, value objects, aggregates, domain events, domain services, domain errors, invariants.
- Pure library with zero I/O. If it needs the outside world, it declares a port rather than reaching out.
- Must NOT contain: I/O, frameworks, SQL, env reads, wall-clock reads (`Date.now()`). Time enters as an input (e.g. `recordedAt: Date`), never read in-domain.

## Dependencies

- May depend on `@repo/server-kernel`, `es-toolkit`, `zod` — nothing else.

## File conventions

- One building block per file: `*.aggregate.ts`, `*.entity.ts`, `*.value-object.ts`, `*.event.ts`, `*.error.ts`.

## Invariants & validation

- Each aggregate, entity, value object, and event declares a `zod` schema as the single source of truth for its props; derive the props type with `z.infer`.
- Validate through kernel helpers, never raw `schema.parse`:
  - `parseProps` — returns `Result`, for _expected_ invariant failures.
  - `parsePropsOrThrow` — throws, for _impossible_ states (a fault, not a domain failure).
- Cross-field/contextual checks zod can't express are layered imperatively after `parseProps`, returning `Result.err(<contextError>(...))` (e.g. `occurredAt` must not be after `recordedAt`).

## Factories

- The private constructor takes already-parsed props; static factories run the schema (see `Tags`/`EventBody`).
- Two factories per type:
  - `create(input)` — new instance from untrusted input; validates with `parseProps`, returns `Result`. Name it `create` across aggregates, entities, and value objects (e.g. `Event.create`, `Tags.create`).
  - `restore(input)` — rebuild from persisted/trusted data; validates with `parsePropsOrThrow`, since data that already passed its invariants is an impossible state if now invalid.
- Identity / always-valid value objects (an `Id` subclass like `EventId`, `Tenant`) skip the `Result` factory — construction runs `parsePropsOrThrow` because an empty value is an impossible state.

## Domain errors

- Define a context-specific error with `defineError` in a `*.error.ts` file (e.g. `InvalidEvent`).
- Thread it through `parseProps` as the error builder so failures carry a context discriminant.

## Aggregate composition

- Aggregates compose child value objects: build each via its `create`, short-circuit on the first error `Result`, then validate aggregate props holding the VO instances (`z.custom<T>((v) => v instanceof T)`).
