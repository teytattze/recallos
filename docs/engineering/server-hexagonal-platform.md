# Platform Pattern

## Intent

- Provide infrastructure used by apps and adapters.

## Pattern

- Owns cross-cutting primitives: pg pool, zod config, pino logger, event bus, unit of work.
- Supports infrastructure concerns without depending on domain concepts.

## Boundaries

- May depend on drivers.
- No domain types or business logic.
- Domain packages never import platform.
