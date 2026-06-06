# Composition Root Pattern

## Intent

- Wire use cases to concrete adapters.

## Pattern

- Owns dependency injection per app runtime.
- Names concrete adapter classes and passes them into use cases.
- Datastore changes require one `-infra` adapter and one wiring change here.

## Boundaries

- May depend on everything needed for wiring.
- No business logic.
