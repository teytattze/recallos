# Shared Kernel Pattern

## Intent

- Provide reusable DDD primitives for bounded contexts.
- Stay framework-free, context-free, and I/O-free.

## Pattern

- Owns base types: `Entity`, `AggregateRoot`, `ValueObject`, `TenantAwareAggregateRoot`.
- Owns identity and ownership: `Id`, `Tenant`/`TenantType`, `EntityMetadata`.
- Owns primitives: `DomainEvent`, `DomainError`, `Clock`, `Result`.
- Owns helpers: `parseProps`/`parsePropsOrThrow`, `defineError`, `defineEvent`,
  `InvariantViolation`, `createFixedClock`.
- Accepts only primitives reused across contexts and free of context meaning.

## Boundaries

- Depends on `es-toolkit` and `zod`.
- No `@repo/*`, drivers, I/O, frameworks, or context-specific types.
- `Tenant` and `Clock` qualify; an `Event` aggregate or `InvalidEvent` error does not.
