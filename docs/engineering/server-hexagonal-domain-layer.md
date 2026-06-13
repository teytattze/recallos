# Domain Layer Pattern

## Intent

- Model business invariants in a pure library.
- Make time and outside-world data explicit inputs.

## Pattern

- Lives in `packages/server-<context>-core/src/domain/`.
- Owns entities, value objects, aggregates, domain events, domain services, errors, and invariants.
- Declares ports when it needs outside-world capabilities.
- Accepts time as input, e.g. `createdAt: Date`; never calls `Date.now()`.

## Boundaries

- Depends on `@repo/server-kernel` and `zod`.
- No I/O, frameworks, SQL, env reads, or wall-clock reads.

## Conventions

- Group domain files by building-block type:
  - aggregates: `domain/aggregates/<concept>.ts`
  - entities: `domain/entities/<concept>.ts`
  - value objects: `domain/value-objects/<concept>.ts`
  - events: `domain/events/<event-name>-event.ts`
  - errors: `domain/errors/<error-name>-error.ts`
- Use kebab-case filenames without dotted role suffixes.
- Use one building block per file.
- Define one `zod` schema per aggregate, entity, value object, and event.
- Derive props with `z.infer`.
- Validate with kernel helpers, not raw `schema.parse`:
  - `parseProps`: returns `Result` for expected invariant failures.
  - `parsePropsOrThrow`: throws for impossible states.
- Run cross-field checks after `parseProps`; return `Result.err(<contextError>(...))`.
- Use private constructors that receive already-parsed props.
- Use `create(input)` for untrusted input; validate with `parseProps` and return `Result`.
- Aggregate `create` and `restore` input is `{ tenant, metadata, payload }`.
- Value object `create` and `restore` inputs are object-shaped; use `{ payload }` for single-value objects.
- Use `restore(input)` for persisted/trusted data; validate with `parsePropsOrThrow`.
- Identity/always-valid value objects skip the `Result` factory and validate construction with `parsePropsOrThrow`.
- Define context-specific errors with `defineError` in `domain/errors/*-error.ts`.
- Name error factories `create<ErrorName>Error` and error types `<ErrorName>Error`.
- Define domain events with `defineEvent` in `domain/events/*-event.ts`.
- Name event factories `create<EventName>Event` and event types `<EventName>Event`.
- Thread context errors through `parseProps` so failures carry a discriminant.
- Compose aggregates from child value objects; short-circuit on the first child `Result.err`.
- Validate aggregate props containing value objects with `z.custom<T>((v) => v instanceof T)`.
- Use file-local declarations plus final `export { ... }` and `export type { ... }` blocks.
