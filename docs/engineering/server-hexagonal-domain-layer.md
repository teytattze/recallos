# Domain Layer Pattern

## Intent

- Model business invariants in a pure library with zero I/O.
- Make time and outside-world data explicit inputs.

## Pattern

- Owns entities, value objects, aggregates, domain events, domain services, domain errors, and invariants.
- Declares ports when it needs outside-world capabilities.
- Accepts time as input, e.g. `recordedAt: Date`; never calls `Date.now()`.

## Boundaries

- Depends on `@repo/server-kernel` and `zod`.
- Avoid I/O, frameworks, SQL, env reads, and wall-clock reads.

## Conventions

- Use one building block per file: `*.aggregate.ts`, `*.entity.ts`, `*.value-object.ts`, `*.event.ts`, `*.error.ts`.
- Define one `zod` schema per aggregate, entity, value object, and event.
- Derive props with `z.infer`.
- Validate with kernel helpers, not raw `schema.parse`:
  - `parseProps`: returns `Result` for expected invariant failures.
  - `parsePropsOrThrow`: throws for impossible states.
- Cross-field/contextual checks zod can't express are layered imperatively after `parseProps`, returning `Result.err(<contextError>(...))` (e.g. `occurredAt` must not be after `recordedAt`).
- Use private constructors that receive already-parsed props.
- Use `create(input)` for untrusted input; validate with `parseProps` and return `Result`.
- Use `restore(input)` for persisted/trusted data; validate with `parsePropsOrThrow`.
- Identity/always-valid value objects skip the `Result` factory and validate construction with `parsePropsOrThrow`.
- Define context-specific errors with `defineError` in `*.error.ts`.
- Thread context errors through `parseProps` so failures carry a discriminant.
- Compose aggregates from child value objects; short-circuit on the first child `Result.err`.
- Validate aggregate props containing value objects with `z.custom<T>((v) => v instanceof T)`.
