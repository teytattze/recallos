# RecallOS — Error Handling (Result vs Throw)

Companion to [`project-structure.md`](./project-structure.md). It fixes _how failures move through the hexagon_: which layer returns a value and which one throws, and where the two are reconciled. The primitives live in `@repo/server-kernel` (`result.ts`, `domain-error.ts`).

---

## 1. The decision

> **Use `Result` for expected, domain-meaningful failures. `throw` only for the truly exceptional. The inbound adapter is the one place the two meet.**

The split is not "errors as values vs exceptions" as a matter of taste — it is **who can act on the failure**:

- **Expected failure** — a business rule was violated, validation failed, an aggregate refused a transition, an entity the caller must handle was absent. The caller is _supposed_ to branch on this, so it belongs in the type signature → **`Result<T, E>`**.
- **Exceptional fault** — a programmer error, an invariant that "can't happen," infrastructure dying (DB connection lost, network timeout). Nobody downstream can sensibly branch on it; it should bubble to a boundary handler → **`throw`**.

"`Result` everywhere" threads connection-pool exhaustion through every signature as noise. "`throw` everywhere" hides the domain's real failure modes from the type system. Splitting by _who acts_ avoids both.

---

## 2. Per-layer rules

| Layer                                            | Strategy                                                                                                                                                                   | Rationale                                                                                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Domain** (value objects, aggregates)           | `Result` for anticipated validation (`Email.create(raw): Result<Email>`); `throw` for defensive asserts on invariants the application layer should already have guaranteed | Construction failure is an expected outcome; a violated post-condition is a bug, not a branch                                                  |
| **Application** (use cases / inbound ports)      | **`Result<T, DomainError>`** — this _is_ the inbound-port contract                                                                                                         | A use case's failures are business outcomes the caller routes on. Matches `execute(input): Promise<Result<MemoryItemId>>` in the structure doc |
| **Outbound adapters** (`server-<context>-infra`) | `throw` on infra faults; map _expected_ absence to `null` or `Result` at the port boundary                                                                                 | A dropped connection is exceptional; "no row" is often normal and belongs in the contract                                                      |
| **Inbound adapters** (`http/`, `jobs/`)          | The **single reconciliation point**: `catch` thrown faults _and_ unwrap `Result` into a transport response (HTTP status / retry decision)                                  | One place owns "domain failure → 4xx, unexpected throw → 500/retry." Nothing inside relies on `throw` for control flow                         |

The architectural payoff: everything _inside_ the hexagon returns `Result` for business failures; anything that `throw`s is, by definition, a fault the boundary logs and converts — never flow the domain depends on.

---

## 3. The kernel primitives

`@repo/server-kernel` stays zero-dependency, so these are hand-rolled (no `neverthrow`/`fp-ts`).

**`Result<T, E = DomainError>`** — a discriminated union plus combinators (`result.ts`):

```ts
export type Result<T, E = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// Result.ok / err / isOk / isErr / map / mapErr / andThen / unwrapOr
```

`E` defaults to `DomainError`, so a use case reads as `Result<MemoryItemId>`. `Result` is both a type and a value (type-space vs value-space), so `Result<T>` and `Result.ok(x)` coexist.

**`DomainError`** — a _tagged union_, not a class hierarchy (`domain-error.ts`):

```ts
export interface DomainError {
  readonly kind: string; // unique discriminant, e.g. "EmailInvalid"
  readonly category: DomainErrorCategory; // validation | not-found | conflict | forbidden | unexpected
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

const EmailInvalid = defineError("EmailInvalid", "validation");
const QuotaExceeded = defineError("QuotaExceeded", "conflict");

type IngestError =
  | ReturnType<typeof EmailInvalid>
  | ReturnType<typeof QuotaExceeded>;
```

- `kind` lets a context `switch` over its error union _exhaustively_ (TypeScript flags an unhandled case). `instanceof` chains rot; tagged unions don't.
- `category` is **domain semantics, not transport** — it says _what kind_ of failure happened. The inbound adapter maps `category → status code`, so adapters never need to know every concrete `kind`. (e.g. `validation → 422`, `not-found → 404`, `conflict → 409`, `forbidden → 403`, else `500`.)

---

## 4. Conventions & gotchas

- **zod returns a `Result`-shaped union already.** Now that zod is allowed in the pure core (see structure doc §3), a value object wraps `schema.safeParse()` and returns our `Result` — never let a raw `ZodError` escape the domain.
- **Async composes as `Promise<Result<T, E>>`.** Use the sync combinators after `await`; don't reach for a `ResultAsync` abstraction yet. Revisit only if chaining becomes painful in practice.
- **Never use `Result` for faults.** If the only sensible handling is "log and 500," it's a `throw`, not an `Err`. `category: "unexpected"` is a last resort, not a substitute for throwing.
- **The boundary catches; the core does not.** Use cases should not wrap infra calls in `try/catch` to convert faults into `Err` — let them propagate to the inbound adapter, which is the one layer allowed to know about transport.

---

## Closing notes

- **Decided here:** the `Result`/`throw` split, the `DomainError` tagged-union shape, and `category` as the domain→transport mapping seam.
- **Deferred:** transport-mapping tables per inbound adapter (HTTP status, worker retry/DLQ policy); whether to adopt richer async combinators; structured-logging shape for thrown faults at the boundary.
