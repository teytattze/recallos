# Composition Root Pattern

## Intent

- Wire use cases to concrete adapters.
- Keep deployable apps as composition-only runtimes.

## Pattern

- Lives in `apps/*`.
- Owns dependency injection per app runtime.
- Names concrete inbound and outbound adapter classes and wires them to core use cases.
- Datastore changes require one `-outbound-adapter` change and one wiring change here.
- Transport changes require one `-inbound-adapter` change and one wiring change here.

## Boundaries

- May depend on everything needed for wiring.
- No business logic or transport translation.
- Apps never import each other.
