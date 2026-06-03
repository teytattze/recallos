# Inbound Adapter Pattern

## Intent

- Translate external triggers into use-case calls.

## Pattern

- Owns HTTP, cron, and queue input translation.
- Validates transport input before calling inbound ports.
- Keeps apps thin: inbound adapters plus composition root only.

## Boundaries

- Depends on `@repo/server-<context>`, `@repo/server-platform`, and transport frameworks like `hono`.
- Avoid business logic.
- Apps never import each other.
