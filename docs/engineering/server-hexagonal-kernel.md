# Shared Kernel Pattern

## Intent

- Provide reusable DDD primitives shared by bounded contexts.
- Stay framework-free, context-free, and zero I/O.

## Pattern

- Owns base classes: `Entity`, `AggregateRoot`, `ValueObject`, `TenantAwareAggregateRoot`.
- Owns identity and ownership primitives: `Id`, `Tenant`/`TenantType`, `EntityMetadata`.
- Owns contracts and primitives: `DomainEvent`, `DomainError`, `Clock`, `Result`.
- Owns validation and factory helpers: `parseProps`/`parsePropsOrThrow`,
  `defineError`, `defineEvent`, `InvariantViolation`, `createFixedClock`.
- Accepts primitives only when reused across contexts and free of context-specific meaning.

## Boundaries

- Depends on `es-toolkit` and `zod`.
- Avoid `@repo/*`, drivers, I/O, frameworks, and context-specific types.
- `Tenant` and `Clock` qualify; an `Event` aggregate or `InvalidEvent` error does not.
