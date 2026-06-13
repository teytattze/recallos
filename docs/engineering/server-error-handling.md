# Server Error Handling Pattern

## Intent

- Make domain and application failures consistent across server packages.
- Keep transport concerns out of the domain and application core.
- Let inbound adapters own logging and response mapping.

## Pattern

- Throw for validation failures, refused invariants, business policy failures, and infrastructure faults.
- Throw tagged `DomainError` values for domain/application failures that callers or adapters may classify.
- Throw ordinary `Error` values for technical faults where no domain category is useful.
- Treat `DomainError.category` as routing metadata, not an HTTP status.

Do not return `Result` from domain factories, use cases, or inbound ports.
If a caller needs to react to a failure, it catches a thrown `DomainError` and switches on `kind` or `category`.

## Layer Rules

- Domain: validate construction and state transitions with throwing helpers.
  Throw context-specific `DomainError` values for rejected input or invariants.
- Application: use cases and inbound ports return successful outputs directly, usually as `Promise<Output>`.
  Let domain and infrastructure failures propagate.
- Outbound adapters: throw for infrastructure faults.
  Model expected absence with `null` or a named successful shape when absence is not a failure.
- Inbound adapters: catch thrown values and map them into transport responses or worker decisions.

## Domain Errors

Domain errors are contract failures:

- value-object or aggregate construction rejects invalid input;
- an aggregate refuses a state transition;
- a requested entity is absent and the caller must choose what to do;
- a uniqueness, quota, authorization, or policy rule blocks the request.

Represent these as tagged `DomainError` values with `kind`, `category`, `message`, and optional `details`.
Inside a context, switch on `error.kind` when behavior differs.
At transport boundaries, route by `error.category`; render specific kinds only when required.

## Exceptional Faults

Exceptional faults are not business contract failures:

- database connections are unavailable;
- an SDK call times out;
- persisted data violates a restore-time invariant;
- a supposedly impossible branch is reached;
- configuration is invalid at boot.

These failures also throw.
The inbound adapter owns catch-all handling, logging, and generic responses.

## Boundary Mapping

Inbound adapters are the only place thrown failures become transport responses.

- Successful use-case return values map to successful transport responses.
- Thrown `DomainError` values map by `category`.
- Other thrown values map to a generic internal failure response or worker retry path.
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

- `DomainError` carries `kind`, `category`, `message`, and optional `details`.
- `defineError(kind, category)` creates typed error factories for `domain/errors/*-error.ts`.
- `parseProps` wraps `zod.safeParse`, returns parsed props on success, and throws a `DomainError` on failure.

## Conventions

- Domain `create(input)` factories validate untrusted input and return the created object directly.
- Domain `restore(input)` factories validate trusted persisted data with the same throwing validation helpers.
- Name error factories `create<ErrorName>Error` and error types `<ErrorName>Error`.
- Application use cases do not catch domain errors unless they can add meaningful business behavior.
- zod errors never escape the pure core; wrap them with `parseProps`.
- Do not use `category: "unexpected"` for real infrastructure faults; throw the technical error.

## Anti-Patterns

- Returning `Result` from domain factories, use cases, or inbound ports.
- Catching domain errors only to rethrow the same value.
- Mapping every concrete `error.kind` in HTTP adapters when `category` is sufficient.
- Catching infrastructure exceptions inside use cases and converting them to domain errors.
- Letting raw `ZodError`, Prisma errors, SDK errors, or framework errors cross inward into the domain or application layers.
