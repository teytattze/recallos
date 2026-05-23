# RecallOS — Database Technology Trade-offs

Derived from `docs/diagrams/architecture.excalidraw`. Bias: **AWS-managed first** (CI builds and pushes to AWS ECR), with OSS/SaaS alternatives noted. Captures the state of AWS offerings as of 2026-05; see *Verify-before-build* at the end, because managed-extension and service availability shifts.

---

## 1. What the diagram commits us to

The architecture defines three distinct data stores fed by a `Service` (Hono on Bun, ingest + API) and a cron-driven `Worker`:

| Store | Written by | Read by | Holds | Workload shape |
|---|---|---|---|---|
| **TimeseriesDB** | `Service` (webhook/API ingest) | `Worker` | Raw captured events — messages, documents, processes — keyed by time | Write-heavy append; time-ordered scans by the Worker |
| **VectorDB** | `Worker` | `Service` | Embeddings for semantic recall | Bulk upsert (Worker); low-latency ANN read (Service) |
| **GraphDB** | `Worker` | `Service` | Entity relationships ("everything relates to everything") | Bulk upsert (Worker); traversal read (Service) |

Flow: `External --webhook--> Service --write--> TimeseriesDB`; `Cron --trigger--> Worker`; the Worker **reads** TimeseriesDB and **read/writes** VectorDB + GraphDB; the Service **reads** VectorDB + GraphDB; `Client <-> Service`.

**Decision drivers**

- **AWS-bound deployment** → prefer AWS-managed services.
- **Greenfield, small team, no data layer yet** → operational simplicity matters most *right now*.
- **Core workload is RAG for AI agents** (semantic recall + relationship expansion) → read-path latency on the Service matters.
- **Scale is unknown** → avoid premature heavy infra; keep an escape hatch.

---

## 2. TimeseriesDB

> **Recommendation:** start with **Aurora/RDS PostgreSQL** (a time-partitioned `events` table). Graduate to **Amazon Timestream for InfluxDB** when sustained ingest/retention outgrows it.

In RecallOS this store is less a metrics TSDB and more an **append-only ingest log** the Worker drains — which favors a flexible record store over a metrics engine.

| Option | Hosting | Strengths | Trade-offs / risks | AWS lock-in |
|---|---|---|---|---|
| **Aurora / RDS PostgreSQL** (partitioned by time) | AWS-managed | Flexible relational + JSONB payloads; transactional; same engine as the vector store; trivial local dev | Manual/declarative partitioning + retention; not built for huge metric cardinality | Low (portable PG) |
| **Amazon Timestream for InfluxDB** | AWS-managed | Purpose-built TSDB; managed InfluxDB 2.x / 3; retention tiers; high ingest rates | InfluxQL/Flux/SQL learning curve; another engine; tuned for metrics over document-shaped events | Medium |
| **Amazon DynamoDB** (time-ordered sort key) | AWS-managed | Serverless, massive write scale, cheap at scale | Limited query model (no ad-hoc scans/joins); range scans need careful key design | High |
| TimescaleDB (RDS-for-PG extension, or self-host) | OSS (on RDS) | Hypertables, continuous aggregates, compression; full SQL | **Aurora does not support the extension** — only RDS-for-PostgreSQL (community features) or self-host | Low |
| ClickHouse / InfluxDB (self-host or Cloud) | OSS / SaaS | Excellent compression + analytical scans | You operate it (or pay SaaS); extra system off the PG path | None / vendor |

**Note:** *Amazon Timestream for LiveAnalytics is closed to new customers (since 2025-06-20)* — not an option for a greenfield project. The AWS-managed purpose-built path is now **Timestream for InfluxDB**.

**Why:** at this stage the "time-series" store is an ingest log; Postgres handles it with the least new machinery and shares an engine with the vector store (see §5). Move to Timestream-for-InfluxDB only when ingest rate / retention volume justifies a purpose-built TSDB. Wanting hypertables specifically pins you to RDS-for-PostgreSQL (not Aurora) or self-hosting.

---

## 3. VectorDB

> **Recommendation:** **Aurora PostgreSQL + pgvector (HNSW)** to start. Graduate to **Amazon OpenSearch Service** (if you want hybrid keyword+vector search) or **Amazon S3 Vectors** (if large-scale RAG cost dominates).

| Option | Hosting | Strengths | Trade-offs / risks | AWS lock-in |
|---|---|---|---|---|
| **Aurora/RDS PostgreSQL + pgvector** | AWS-managed | Vectors live beside relational metadata → one query, one transaction, one backup; HNSW + IVFFlat; trivial ops if you already run PG | Index build/memory cost grows; slower than dedicated ANN at very high vector counts; no native index sharding | Low (portable) |
| **Amazon OpenSearch Service** (k-NN) | AWS-managed | Vector **+ BM25 full-text + rich filtering** (hybrid search); scales to large indexes; managed | Heavier/pricier to run; cluster sizing & tuning; another data plane to sync from the Worker | Medium |
| **Amazon S3 Vectors** | AWS-managed | GA 2026; "storage-first", up to ~2B vectors/index, up to ~90% lower TCO for large RAG; integrates with Bedrock KB & OpenSearch | Higher per-query latency than in-memory ANN (cost-optimized, not latency-optimized); newer | Medium-High |
| **Amazon Bedrock Knowledge Bases** | AWS-managed | Managed end-to-end RAG (chunk → embed → store → retrieve); fastest path to working recall | Less control over chunking/retrieval; abstracts the store; opinionated; cost | High |
| Qdrant / Weaviate / Milvus | OSS / SaaS | Purpose-built ANN; best recall/latency at scale; payload filtering | You run it (or pay SaaS); extra system + sync; ops | None / vendor |
| Pinecone | SaaS | Fully managed; strong DX; scales | Cost; vendor lock-in; data leaves your AWS account boundary | Vendor |

**Why:** co-locating embeddings with metadata in pgvector removes an entire sync problem and keeps the Service read path simple while the corpus is small/medium. As recall quality and latency-under-load become first-order, OpenSearch (org memory likely benefits from hybrid keyword+vector) or S3 Vectors (when cost at large scale dominates) are the natural AWS graduations. Bedrock KB is the shortcut if you'd rather not build the RAG pipeline yourself.

---

## 4. GraphDB

> **Recommendation:** model relationships in **Postgres (foreign keys + recursive CTEs)** at first. Move to **Amazon Neptune (openCypher)** — or **Neo4j** — when traversals get deep/hot enough to hurt in SQL.

| Option | Hosting | Strengths | Trade-offs / risks | AWS lock-in |
|---|---|---|---|---|
| **Postgres edges + recursive CTEs** | AWS-managed (Aurora/RDS) | No new system; fine for shallow 1–2 hop expansion; transactional with everything else | Deep/variable-length traversals get slow and awkward; not a real graph engine | Low |
| **Amazon Neptune** | AWS-managed | Managed property graph; openCypher + Gremlin (+ SPARQL); HA/backups; scales | AWS lock-in; weaker local-dev story; smaller ecosystem than Neo4j; cost when idle | High |
| Neptune Analytics | AWS-managed | Fast in-memory graph algorithms over a snapshot (good for GraphRAG) | Analytics-oriented, not your primary OLTP graph; extra moving part | High |
| **Neo4j** (Aura managed or self-host) | SaaS / OSS | Best-in-class Cypher; tooling (Browser/Bloom); docs; ecosystem; GraphRAG patterns | Aura isn't AWS-native (outside your account); self-host = ops; license tiers | Vendor / none |
| Apache AGE (Postgres extension) | OSS (self-host only) | openCypher inside Postgres → keeps the single-DB dream | **Not available on RDS/Aurora** — self-hosted Postgres only; younger; slower deep traversals | Low |
| ArangoDB | OSS / SaaS | Multi-model (graph + document) | Another system; smaller community; ops | None / vendor |

**Why:** RecallOS's "everything relates to everything" maps to a graph, but early relationship queries are likely shallow (expand context around a recalled item). Recursive CTEs cover that without a new engine. When traversal depth/branching or graph algorithms (path finding, community detection for GraphRAG) become central — and slow in SQL — Neptune is the AWS-native answer; choose Neo4j if Cypher ergonomics/tooling outweigh staying inside AWS. Note Apache AGE can't run on managed Aurora/RDS, so "graph inside Postgres" forces self-hosting.

---

## 5. The big trade-off: three specialized DBs vs. consolidated Postgres

**A) Consolidated (lean) — one Aurora PostgreSQL does (almost) everything**

- Vectors: **pgvector** (fully supported on Aurora).
- Time-series / event log: native declarative **partitioning** + retention.
- Graph: relational **edges + recursive CTEs**.
- One engine, one connection pool, one backup/restore, cross-store transactions, trivial local dev.
- **Honest limits:** Aurora supports **neither** the TimescaleDB **nor** the Apache AGE extension. So consolidation on managed Aurora means *Postgres-native* time-series and graph (partitioning + CTEs) — **not** hypertables or openCypher. Those specific extensions require RDS-for-PostgreSQL (TimescaleDB only) or self-hosting Postgres on EC2/ECS (both), giving up managed benefits. At high vector counts / deep traversals / heavy ingest, a single instance becomes the bottleneck.

**B) Specialized (best-fit) — Timestream-for-InfluxDB + (OpenSearch | S3 Vectors) + Neptune**

- Each store is purpose-built and scales independently.
- **Costs:** three data planes to provision, secure, monitor, and (critically) **keep in sync from the Worker**; more failure modes; more lock-in; slower iteration for a small team; no cross-store transactions.

| | Consolidated PG | Specialized |
|---|---|---|
| Ops burden (now) | **Low** | High |
| Time-to-first-feature | **Fast** | Slow |
| Cost at small scale | **Low** | Higher (idle clusters) |
| Ceiling at large scale | Lower | **Higher** |
| Cross-store consistency | **Transactional** | Eventual / app-managed |
| Lock-in | **Low** | Higher |

---

## 6. Recommendation for RecallOS today

**Start consolidated, graduate by evidence.**

**Phase 0 (now): one Aurora PostgreSQL cluster.**
- `pgvector` (HNSW) for VectorDB.
- Time-partitioned `events` table (JSONB payload) for TimeseriesDB.
- Relational edge table + recursive CTEs for GraphDB.
- Worker writes embeddings/edges; Service reads. Keep the stores logically separate now so they can be split out physically later.

**Phase 1+ (graduate the hottest store first, each behind a concrete trigger):**
- **VectorDB →** OpenSearch (need hybrid keyword+vector) or S3 Vectors (large-scale RAG cost) — *trigger:* ANN p99 latency / index memory pressure under real load, or a hybrid-search requirement.
- **GraphDB →** Neptune (openCypher) or Neo4j — *trigger:* multi-hop / variable-length traversals or graph algorithms that are slow as CTEs.
- **TimeseriesDB →** Timestream for InfluxDB — *trigger:* sustained ingest rate / retention volume where PG partition maintenance hurts.

Keep the Worker's write side and the Service's read side behind small repository interfaces, so each store can be swapped without touching business logic.

---

## Verify-before-build

- **Timestream for LiveAnalytics** is closed to new customers (2025-06-20) — use **Timestream for InfluxDB**.
- **pgvector**: supported on Aurora **and** RDS PostgreSQL. **TimescaleDB**: RDS-for-PostgreSQL only (community features), **not** Aurora. **Apache AGE**: neither managed offering (self-host only). Extension availability changes by engine version — confirm against the current AWS extension list before committing.
- **Amazon S3 Vectors** went GA in 2026 (~2B vectors/index); confirm region availability.

## Sources

- [Extension versions for Amazon Aurora PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Extensions.html)
- [Extension versions for Amazon RDS for PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-extensions.html)
- [Amazon RDS for PostgreSQL now supports pgvector](https://aws.amazon.com/about-aws/whats-new/2023/05/amazon-rds-postgresql-pgvector-ml-model-integration/)
- [What is Timestream for InfluxDB?](https://docs.aws.amazon.com/timestream/latest/developerguide/timestream-for-influxdb.html)
- [Amazon Timestream for InfluxDB (AWS Database Blog)](https://aws.amazon.com/blogs/database/amazon-timestream-for-influxdb-expanding-managed-open-source-time-series-databases-for-data-driven-insights-and-real-time-decision-making/)
- [AWS Time-Series Database: Understanding Your Options (Tiger Data)](https://www.tigerdata.com/learn/aws-time-series-database-understanding-your-options)
- [Amazon S3 Vectors now generally available](https://aws.amazon.com/blogs/aws/amazon-s3-vectors-now-generally-available-with-increased-scale-and-performance/)
- [Using S3 Vectors with Amazon Bedrock Knowledge Bases](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-bedrock-kb.html)
- [Add Support for Apache AGE on Amazon RDS (apache/age #998)](https://github.com/apache/age/issues/998)
