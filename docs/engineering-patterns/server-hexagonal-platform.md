# Platform Pattern

## Intent

- Provide infrastructure used by apps and adapters.

## Pattern

- Owns cross-cutting HTTP, configuration, and logging primitives shared by server runtimes.
- Supports infrastructure concerns without depending on domain concepts.
- Used by composition roots and infrastructure packages that need these primitives.

## Boundaries

- May depend on drivers.
- Does not own deployable configuration schemas or read environment variables on
  behalf of apps.
- No domain types or business logic.
- `server-<context>-core` packages never import platform.
