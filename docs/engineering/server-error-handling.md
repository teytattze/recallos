# Server Error Handling Pattern

## Intent

- Make expected business failures explicit in type signatures.
- Let exceptional faults reach the runtime boundary.
- Keep transport concerns out of the domain and application core.

## Pattern

- Use `Result<T, E>` for failures the caller is expected to branch on.
- Use `throw` for faults the caller cannot sensibly handle.
- Reconcile both forms at the inbound adapter boundary.
- Represent expected failures as tagged `DomainError` values, not error classes.
- Treat `DomainError.category` as routing metadata, not an HTTP status.

If the caller can make a business decision, return `Result`.
If the response is logging, retrying, or generic failure, throw.

## Layer Rules

- Domain: return `Result` for expected invariant and validation failures.
  Throw only for impossible states and assertions.
- Application: use cases and inbound ports return `Promise<Result<T, DomainError>>` for business outcomes.
- Outbound adapters: throw for infrastructure faults.
  Model expected absence or conflicts as `null`, `Result`, or a named shape.
- Inbound adapters: catch thrown faults and unwrap `Result` values into transport responses or worker decisions.

## Expected Failures

Expected failures are contract outcomes:

- value-object or aggregate construction rejects invalid input;
- an aggregate refuses a state transition;
- a requested entity is absent and the caller must choose what to do;
- a uniqueness, quota, authorization, or policy rule blocks the request.

Return `Result<T, E>`, where `E` is a context-specific union of `DomainError` values.
Inside a context, switch on `error.kind` when behavior differs.
At transport boundaries, route by `error.category`; render specific kinds only when required.

## Exceptional Faults

Exceptional faults are not part of the business contract:

- database connections are unavailable;
- an SDK call times out;
- persisted data violates a restore-time invariant;
- a supposedly impossible branch is reached;
- configuration is invalid at boot.

These failures throw. Do not convert them into `Result.err` to avoid `try/catch`.
The inbound adapter owns catch-all handling, logging, and generic responses.

## Boundary Mapping

Inbound adapters are where expected failures and thrown faults meet.

- `Result.ok(value)` maps to the successful transport response.
- `Result.err(error)` maps by `DomainError.category`.
- Thrown faults map to a generic internal failure response or worker retry path.
- Fault logs include technical details; external responses do not.

Default HTTP category mapping:

| Category     | HTTP status |
| ------------ | ----------- |
| `validation` | `422`       |
| `not-found`  | `404`       |
| `conflict`   | `409`       |
| `forbidden`  | `403`       |
| `unexpected` | `500`       |

Worker adapters map the same distinction to acknowledge, retry, or dead-letter behavior.

## Kernel Primitives

- `Result<T, E = DomainError>` is the shared success/failure union plus
  `ok`, `err`, `map`, `mapErr`, `andThen`, and `unwrapOr`.
- `DomainError` carries `kind`, `category`, `message`, and optional `details`.
- `defineError(kind, category)` creates typed error factories for `domain/errors/*-error.ts`.
- `parseProps` wraps `zod.safeParse` and returns `Result`.
- `parsePropsOrThrow` validates trusted or impossible states and throws on failure.

## Conventions

- Domain `create(input)` factories validate untrusted input and return `Result`.
- Domain `restore(input)` factories validate trusted persisted data with
  `parsePropsOrThrow`.
- Name error factories `create<ErrorName>Error` and error types
  `<ErrorName>Error`.
- Application use cases short-circuit on the first domain `Result.err`.
- Async composition uses `Promise<Result<T, E>>`; do not add `ResultAsync`.
- zod errors never escape the pure core; wrap them with `parseProps` or `parsePropsOrThrow`.
- Do not use `category: "unexpected"` for real infrastructure faults; throw.

## Anti-Patterns

- Throwing domain validation errors for control flow.
- Returning `Result.err` for connection loss, network timeout, or programmer
  mistakes.
- Mapping every concrete `error.kind` in HTTP adapters when `category` is
  sufficient.
- Catching infrastructure exceptions inside use cases and converting them to
  domain errors.
- Letting raw `ZodError`, Prisma errors, SDK errors, or framework errors cross
  inward into the domain or application layers.
