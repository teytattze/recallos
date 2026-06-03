# Engineering Patterns

This directory is the source of truth for RecallOS engineering patterns.

`.claude/rules/` contains Claude-specific path-routing stubs only. Those stubs preserve their `paths` frontmatter and point back to these documents.

## Patterns

- [Decision records](./decision-record.md): committed decisions and naming.
- [Application layer](./server-hexagonal-application-layer.md): use cases and ports.
- [Composition root](./server-hexagonal-composition-root.md): dependency wiring in apps.
- [Domain layer](./server-hexagonal-domain-layer.md): pure model, invariants, factories, and errors.
- [Inbound adapters](./server-hexagonal-inbound-adapter.md): HTTP, cron, and queue entrypoints.
- [Shared kernel](./server-hexagonal-kernel.md): reusable DDD primitives.
- [Outbound adapters](./server-hexagonal-outbound-adapter.md): persistence and gateway implementations.
- [Platform](./server-hexagonal-platform.md): cross-cutting infrastructure primitives.
- [Unit testing](./server-unit-testing.md): test structure and naming.
