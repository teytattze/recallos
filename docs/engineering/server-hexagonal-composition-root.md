# Composition Root Pattern

## Intent

- Wire use cases to concrete adapters in one explicit place.

## Pattern

- Owns dependency injection for each app runtime.
- Names concrete adapter classes and passes them into use cases.
- Graduating a datastore means one new `-infra` class plus one wiring change here.

## Boundaries

- May depend on everything needed for wiring.
- Avoid business logic.
