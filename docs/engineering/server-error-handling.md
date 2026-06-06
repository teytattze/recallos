# Server Error Handling Pattern

## Intent

- Make expected business failures explicit in type signatures.
- Let exceptional faults bubble to the runtime boundary.
- Keep transport concerns out of the domain and application core.

## Pattern

- Use `Result<T, E>` for failures the caller is expected to branch on.
- Use `throw` for faults the caller cannot sensibly handle.
- Reconcile both forms at the inbound adapter boundary.
- Represent expected failures as tagged `DomainError` values, not error classes.
- Treat `DomainError.category` as domain-level routing metadata, not an HTTP status.

The split is based on who can act on the failure. If the next caller should make
a business decision, return `Result`. If the only meaningful response is
logging, retrying, or returning a generic failure, throw and let the boundary
handle it.

## Layer Rules

| Layer             | Rule                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domain            | Return `Result` for expected invariant and validation failures. Throw only for impossible states and defensive assertions.                       |
| Application       | Use cases and inbound ports return `Promise<Result<T, DomainError>>` when they have business outcomes to report.                                 |
| Outbound adapters | Throw for infrastructure faults. Model expected absence or conflicts in the outbound port contract as `null`, `Result`, or a named return shape. |
| Inbound adapters  | Catch thrown faults and unwrap `Result` values into transport responses, worker retry decisions, or dead-letter decisions.                       |

## Expected Failures

Expected failures are part of the contract:

- value-object or aggregate construction rejects invalid input;
- an aggregate refuses a state transition;
- a requested entity is absent and the caller must choose what to do;
- a uniqueness, quota, authorization, or policy rule blocks the request.

Expected failures use `Result<T, E>`, where `E` is usually a context-specific
union of `DomainError` values:

```ts
const EmailInvalid = defineError("EmailInvalid", "validation");
const QuotaExceeded = defineError("QuotaExceeded", "conflict");

type CaptureEventError =
  | ReturnType<typeof EmailInvalid>
  | ReturnType<typeof QuotaExceeded>;
```

Inside a context, switch on `error.kind` when concrete behavior differs. At
transport boundaries, route by `error.category` unless a specific kind truly
needs special rendering.

## Exceptional Faults

Exceptional faults are not part of the business contract:

- database connections are unavailable;
- an SDK call times out;
- persisted data violates a restore-time invariant;
- a supposedly impossible branch is reached;
- configuration is invalid at boot.

These failures throw. Do not convert them into `Result.err` just to avoid a
`try/catch`. The inbound adapter owns the catch-all handler, logging, and
generic failure response.

## Boundary Mapping

Inbound adapters are the only place expected failures and thrown faults meet.

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

Worker adapters use the same distinction but map to acknowledge, retry, or
dead-letter behavior instead of HTTP status codes.

## Kernel Primitives

- `Result<T, E = DomainError>` is the shared success/failure union plus
  combinators such as `ok`, `err`, `map`, `mapErr`, `andThen`, and `unwrapOr`.
- `DomainError` carries `kind`, `category`, `message`, and optional `details`.
- `defineError(kind, category)` creates typed error factories for context
  `domain/errors/*-error.ts` files.
- `parseProps` wraps `zod.safeParse` and returns `Result` for expected invariant
  failures.
- `parsePropsOrThrow` validates trusted or impossible states and throws on
  failure.

## Conventions

- Domain `create(input)` factories validate untrusted input and return `Result`.
- Domain `restore(input)` factories validate trusted persisted data with
  `parsePropsOrThrow`.
- Name error factories `create<ErrorName>Error` and error types
  `<ErrorName>Error`.
- Application use cases short-circuit on the first domain `Result.err`.
- Async composition uses `Promise<Result<T, E>>`; do not add a `ResultAsync`
  abstraction unless repeated chaining pain appears in real code.
- zod errors never escape the pure core directly; wrap them with `parseProps` or
  `parsePropsOrThrow`.
- Avoid `category: "unexpected"` for real infrastructure faults. Prefer
  throwing.

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
