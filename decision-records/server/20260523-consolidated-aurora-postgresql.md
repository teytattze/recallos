# Consolidated Aurora PostgreSQL for all three data stores

- **Status:** Accepted
- **Date:** 20260523
- **Deciders:** Liam Tat Tze Tey
- **Scope:** The data layer for all three logical stores the architecture defines — TimeseriesDB (ingest log), VectorDB (semantic recall), GraphDB (entity relationships) — written by the Worker and read by the Service.

---

## Context

- The architecture commits to three distinct stores with different workload shapes: a write-heavy append-only event log, low-latency ANN reads over embeddings, and relationship traversals. Treating each as a separate purpose-built engine is the obvious literal reading.
- Fixed constraints: deployment is **AWS-bound** (CI builds and pushes to AWS ECR), so AWS-managed services are preferred over self-hosting or non-AWS SaaS. The project is **greenfield with a small team and no data layer yet**, so operational simplicity outweighs ceiling-at-scale.
- Assumed: early-stage scale is small/medium — embedding counts, traversal depth, and ingest rate do not justify dedicated infrastructure. The core workload is RAG (semantic recall + shallow relationship expansion), so the Service read path matters more than analytical throughput.
- Managed-extension reality narrows the options: Aurora supports **pgvector** but **neither TimescaleDB nor Apache AGE** — so "graph/time-series inside Postgres" means Postgres-native partitioning and recursive CTEs, not hypertables or openCypher. Hypertables would pin us to RDS-for-PostgreSQL; AGE would force self-hosting.

## Decision

> Serve all three stores from a single Aurora PostgreSQL cluster.

- **VectorDB** — `pgvector` with HNSW indexes, co-located with relational metadata so recall is one query, one transaction, one backup.
- **TimeseriesDB** — a time-partitioned `events` table with a JSONB payload, treated as the append-only ingest log the Worker drains (not a metrics TSDB).
- **GraphDB** — a relational edge table traversed with recursive CTEs, sufficient for the shallow 1–2 hop context expansion early recall needs.
- The first-principle reasoning: at small/medium scale the dominant cost is **operational surface and cross-store sync**, not the per-store performance ceiling. One engine collapses three data planes into one connection pool, one backup/restore, and cross-store transactions — and removes the Worker→store sync problem entirely.
- Keep the three stores **logically separate behind small repository interfaces** (Worker write side, Service read side), so business logic never binds to Postgres specifics.

## Consequences

- **Positive:** fastest time-to-first-feature, lowest ops burden, and lowest cost at small scale; cross-store consistency is transactional rather than app-managed; low lock-in (portable Postgres); trivial local dev (one engine). The repository-interface seam keeps business logic decoupled from the store.
- **Trade-offs:** we accept a lower ceiling — a single instance becomes the bottleneck at high vector counts, deep traversals, or heavy ingest. We give up hypertables (TimescaleDB) and in-Postgres openCypher (Apache AGE), since neither runs on managed Aurora; time-series and graph stay Postgres-native (partitioning + CTEs). Partition maintenance and HNSW index build/memory cost are ours to manage.
- **Follow-ups:** define the repository interfaces that isolate each store; implement declarative time partitioning + a retention policy for `events`. Re-confirm Aurora extension availability against the current AWS list before building, as it shifts by engine version.

## Alternatives considered

- **Specialized best-fit per store** (Timestream-for-InfluxDB + OpenSearch/S3 Vectors + Neptune) — each store purpose-built and independently scalable; loses because it means three data planes to provision, secure, monitor, and keep in sync from the Worker, with more failure modes, more lock-in, no cross-store transactions, and slower iteration for a small team — paying for a ceiling we have no evidence of needing.
- **RDS-for-PostgreSQL with TimescaleDB** — keeps consolidation while adding hypertables/continuous aggregates/compression for the event log; loses because it forgoes Aurora's managed benefits to buy time-series machinery the ingest-log workload does not need.
- **Self-hosted Postgres with Apache AGE** — preserves the single-DB dream including in-Postgres openCypher graph queries; loses because it abandons managed hosting (and the AWS-managed-first driver) to operate Postgres ourselves, for graph depth early recall does not require.
- **DynamoDB for the event log** — serverless massive write scale; loses because its limited query model (no ad-hoc scans/joins) fights the Worker's time-ordered drain and adds a high-lock-in engine off the Postgres path.
- **Bedrock Knowledge Bases for recall** — fastest path to working RAG; loses because it abstracts away chunking/retrieval control and the store itself, with high lock-in, when co-located pgvector keeps the read path simple and owned.
