# Inbound Adapter Pattern

## Intent

- Translate external triggers into use cases.
- Keep transport concerns outside apps and core packages.

## Pattern

- Lives in `packages/server-<context>-inbound-adapter`.
- Owns input translation for entrypoints such as HTTP routes and MongoDB change streams.
- Validates transport input before calling inbound ports.
- Exposes adapter entrypoints that apps wire in the composition root.

## Boundaries

- Depends on `@repo/server-<context>-core` and explicitly declared transport dependencies such as `hono`, `mongodb`, or `zod`.
- No business logic.
- Does not construct outbound adapters or own dependency wiring.
- Apps use inbound adapters; apps do not own transport translation.
