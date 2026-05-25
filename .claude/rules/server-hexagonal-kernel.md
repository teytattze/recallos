---
paths:
  - "packages/server-kernel/**/*"
---

# Rules: Kernel

- Contains: DDD building blocks — Entity, AggregateRoot, ValueObject, DomainEvent, Id, Result, DomainError, Clock.
- May depend on: zod only.
- Must NOT contain: I/O, context-specific types.
