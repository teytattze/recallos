---
paths:
  - "packages/server-ingestion-infra/src/**/*"
  - "packages/server-knowledge-infra/src/**/*"
---

# Rules: Outbound adapters (driven)

- Contains: implementations of outbound ports against real tech (Postgres, pgvector, graph, external APIs).
- May depend on: @repo/server-<context>, @repo/server-platform, drivers (pg, SDK clients).
- Must NOT contain: business rules.
- Adapters never talk to each other directly — only through the application layer.
- Files: \*.repository.pg.ts; split into persistence/ (DB) and gateways/ (external APIs).
