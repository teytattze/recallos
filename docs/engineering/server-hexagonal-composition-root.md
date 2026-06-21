# Composition Root Pattern

## Intent

- Wire use cases to concrete adapters.
- Keep deployable apps as composition-only runtimes.

## Pattern

- Lives in `apps/*`.
- Owns dependency injection per app runtime.
- Owns the deployable's complete configuration schema, environment profiles, and
  environment-variable mapping.
- Validates configuration at startup and passes typed namespace values to
  adapters; adapters never read environment variables.
- Names concrete inbound and outbound adapter classes and wires them to core use cases.
- Wire transport changes here after their inbound adapter contract is implemented.

## Boundaries

- May depend on everything needed for wiring.
- No business logic or transport translation.
- Apps never import each other.
