---
paths:
  - "apps/service/src/composition/**/*"
  - "apps/worker/src/composition/**/*"
---

# Rules: Composition root

- Contains: the only place that names concrete adapters and wires them to use cases (DI).
- May depend on: everything.
- Must NOT contain: business rules.
- Graduating a datastore = one new class in -infra + one line here.
