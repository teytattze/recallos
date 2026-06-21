# Engineering Patterns

Source of truth for RecallOS engineering patterns.

`.claude/rules/` contains path-routing stubs only. They keep `paths` frontmatter and point here.

## Patterns

- [Decision records](./decision-record.md): committed decisions.
- [Application layer](./server-hexagonal-application-layer.md): use cases and ports.
- [Composition root](./server-hexagonal-composition-root.md): dependency wiring in apps.
- [Domain layer](./server-hexagonal-domain-layer.md): pure model, invariants, factories, errors.
- [Error handling](./server-error-handling.md): expected `Result`, thrown faults, boundary mapping.
- [E2E server testing](./e2e-server-testing.md): behavior scenarios, resource ownership, and infrastructure boundaries.
- [Inbound adapters](./server-hexagonal-inbound-adapter.md): HTTP, cron, and queue entrypoints.
- [Shared kernel](./server-hexagonal-kernel.md): reusable DDD primitives.
- [Outbound adapters](./server-hexagonal-outbound-adapter.md): persistence and gateway implementations.
- [Platform](./server-hexagonal-platform.md): cross-cutting infrastructure primitives.
- [Unit testing](./server-unit-testing.md): test structure and naming.
