# Result vs throw for failure propagation across the hexagonal backend

- **Status:** Accepted
- **Date:** 20260523
- **Deciders:** Liam Tat Tze Tey
- **Scope:** Every bounded context in the backend — all hexagonal layers (domain, application, outbound/inbound adapters) and the `@repo/server-kernel` primitives they share. Excludes frontend and transport-specific status-mapping tables (deferred to per-adapter follow-ups).

---

## Context

- Failures must move through the hexagonal architecture consistently, but two propagation styles compete: errors-as-values (`Result`) and exceptions (`throw`). Choosing per-case by taste produces inconsistent signatures across layers.
- The real axis is not "values vs exceptions" but **who can act on the failure**: a caller that is supposed to branch on an outcome needs it in the type signature; a fault nobody downstream can sensibly handle should bubble to a boundary.
- `Result` everywhere threads infra concerns (connection-pool exhaustion, timeouts) through every signature as noise. `throw` everywhere hides the domain's real failure modes from the type system.
- Fixed constraint: `@repo/server-kernel` stays zero-dependency, so the primitives are hand-rolled (no `neverthrow`/`fp-ts`). Assumed: zod is permitted in the pure core.

## Decision

> Use `Result` for expected, domain-meaningful failures and `throw` only for the truly exceptional; the inbound adapter is the single place the two are reconciled.

- **Expected failures** — violated business rules, validation, refused aggregate transitions, caller-relevant absence — return **`Result<T, E = DomainError>`**, putting them in the type signature so callers must branch.
- **Exceptional faults** — programmer errors, "can't happen" invariants, infrastructure dying — **`throw`** and propagate to a boundary handler.
- Per-layer rules:
  - **Domain:** `Result` for anticipated validation (`Email.create(raw)`); `throw` for defensive asserts on invariants the application layer should already guarantee.
  - **Application (use cases / inbound ports):** `Result<T, DomainError>` _is_ the inbound-port contract.
  - **Outbound adapters (`server-<context>-infra`):** `throw` on infra faults; map expected absence to `null`/`Result` at the port boundary.
  - **Inbound adapters (`http/`, `jobs/`):** the single reconciliation point — `catch` thrown faults _and_ unwrap `Result` into a transport response.
- `DomainError` is a **tagged union**, not a class hierarchy: a `kind` discriminant enables exhaustive `switch`; a `category` (`validation | not-found | conflict | forbidden | unexpected`) carries domain semantics that the inbound adapter maps to transport (e.g. `validation → 422`), so adapters never enumerate every concrete `kind`.

## Consequences

- **Positive:** everything inside the hexagon returns `Result` for business failures, so the type system documents real failure modes; anything that `throw`s is by definition a fault the boundary logs and converts, never control flow the domain depends on. Adapters map `category → status` without knowing each `kind`.
- **Trade-offs:** hand-rolled `Result`/`DomainError` primitives must be maintained instead of adopting a library. Async composes only as `Promise<Result<T, E>>` with sync combinators after `await` — no `ResultAsync` abstraction yet, which may feel verbose when chaining.
- **Follow-ups:** define transport-mapping tables per inbound adapter (HTTP status, worker retry/DLQ policy); decide whether richer async combinators are warranted; settle the structured-logging shape for thrown faults at the boundary.

## Alternatives considered

- **`Result` everywhere** — maximizes explicitness; loses because it threads unactionable infra faults through every signature as noise, drowning the domain's real failure modes.
- **`throw` everywhere** — minimal signatures; loses because it hides anticipated business failures from the type system, so callers can't be forced to handle them.
- **`neverthrow` / `fp-ts` for the primitives** — mature combinators; loses because it breaks the zero-dependency constraint on `@repo/server-kernel`.
- **Class-hierarchy `DomainError` with `instanceof`** — familiar OO shape; loses because `instanceof` chains can't be checked exhaustively and rot as the hierarchy grows, where a tagged union lets TypeScript flag unhandled cases.
