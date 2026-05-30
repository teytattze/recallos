# Knowledge Graph Processing — Implementation Tasks (use-case by use-case)

The implementation breakdown for the enrichment application layer designed in [`feature-knowledge-graph-processing.md`](./feature-knowledge-graph-processing.md) and its sub-docs ([consumption](./feature-knowledge-graph-processing-event-consumption.md), [extraction](./feature-knowledge-graph-processing-extraction.md), [resolution & embedding](./feature-knowledge-graph-processing-resolution.md), [idempotency](./feature-knowledge-graph-processing-idempotency.md)). This is the **task list**, not new design — every "why" lives in those docs; here we only say _what to build, where, in what order, and how to know it's done_.

**How to read this.** Work is split into a **Shared foundation** (domain mutators + ports that more than one use case needs) and then **one section per use case**. Each use case lists its sub-tasks across the layers it touches (domain → ports → use-case → infra → worker → tests), names the foundation tasks it depends on, and states a verification check per the goal-driven discipline in `AGENTS.md`.

**Legend.** `[ ]` not started · `D#` domain · `P#` port · `EE#` EnrichEvents · `EN#` EmbedNodes · `MD#` MergeDuplicateNodes. Paths follow `project-structure.md` §9 and the layout in the parent doc §7.

---

## Status snapshot (2026-05)

- **Domain (`@repo/server-knowledge`):** the three aggregates + value objects + closed vocabularies + `Invalid*` errors exist. Shared-foundation domain layer (D1–D6) now landed on the aggregates themselves — no domain services: node/edge mutators (`attachEvents`/`assignEmbedding`/`reviseBody`/`absorb`, `reinforce`), the `NodeCreated`/`NodeEmbedded`/`NodesRelated` events, and `KnowledgeGraph.accepts`. The "relate" create-or-reinforce decision (former D4) is deferred to the `EnrichEvents` use case (EE7) as application orchestration.
- **Application layer:** none (`packages/server-knowledge/src/application/` does not exist).
- **Infra (`@repo/server-knowledge-infra`):** stub only.
- **Enricher app (`apps/server-knowledge-worker`):** stub (health route only).

So almost everything below is greenfield. The one structural pattern to copy is the **ingestion** context — `@repo/server-ingestion` already shows the use-case + `UnitOfWork` + `EventPublisher` shape, and `@repo/server-ingestion-infra` shows the `*.repository.pg.ts` + outbox/relay adapters.

---

## Shared foundation

These are dependencies for more than one use case; build them first.

### Domain prerequisites (owed by `feature-knowledge-graph.md`)

These are **domain-layer** tasks (mutators/events/services the domain doc designed but never shipped). They live in `@repo/server-knowledge`, follow `.claude/rules/server-hexagonal-domain-layer.md` (zod schema, `parseProps`/`parsePropsOrThrow`, `defineError`, `Result` from expected failures), and must land before the use cases that call them.

- [x] **D1 — Node mutators.** Add to `knowledge-graph-node.aggregate.ts`: `attachEvents(eventIds, now)` (union into `eventIds`, no-op on duplicates, `metadata.touch`), `assignEmbedding(embedding)`, `reviseBody(body, now)`. → _verify:_ unit tests prove `attachEvents` is idempotent on a repeated `eventId` and that `assignEmbedding` flips `embedding` from `null`.
- [x] **D2 — Edge mutator.** Add `reinforce({ confidence, observedAt, sourceEventIds, now })` to `knowledge-graph-edge.aggregate.ts`: union `sourceEventIds`, keep the **latest** `observedAt`, update confidence. → _verify:_ reinforcing keeps the max `observedAt` and unions provenance.
- [x] **D3 — Domain events.** Add `NodeCreated`, `NodeEmbedded`, `NodesRelated` (kernel `DomainEvent`) and record them on the matching factory/mutator via `AggregateRoot.record(...)`. → _verify:_ `pullDomainEvents()` returns the expected event after `create`/`assignEmbedding`/`relate`.
- [ ] **D4 — ~~`GraphRelation` domain service~~ → folded into the `EnrichEvents` use case (EE7).** "Relate" (create a new edge vs `reinforce` an existing one for a re-asserted `(fromId, toId, relationship)` triple) is **application orchestration**, not domain behaviour, so there is no domain service. The use case composes the edge aggregate's existing `KnowledgeGraphEdge.create` (D-foundation) and `reinforce` (D2) primitives. → _verify:_ covered by EE7's use-case test (new triple ⇒ `create`; re-asserted triple ⇒ `reinforce`).
- [x] **D5 — `KnowledgeGraph.accepts(embedding)`.** Policy on the graph root comparing an embedding's `model`/`dimensions` to the graph's `embeddingModel`/`embeddingDimensions`. → _verify:_ false on model/dimension mismatch.
- [x] **D6 — Merge semantics.** `KnowledgeGraphNode.absorb(duplicate, now)` folds a duplicate into a survivor (provenance via `attachEvents`); the edge re-point is I/O (P-layer). → _verify:_ survivor gains the duplicate's `eventIds`.

> If the team prefers, D1–D6 can be tracked in `feature-knowledge-graph.md`'s own task list instead; they are listed here because the use cases below are blocked on them.

### Shared ports (pure, `application/ports/outbound/`)

Interfaces only — no implementations (`.claude/rules/server-hexagonal-application-layer.md`). Exact signatures are in the design sub-docs.

- [ ] **P1 — `KnowledgeGraphNodeRepository`** (`knowledge-graph-node.repository.ts`): `findById`, `findByNaturalKey`, `findNeedingEmbedding`, `saveMany`. (resolution sub-doc §4)
- [ ] **P2 — `KnowledgeGraphEdgeRepository`** (`knowledge-graph-edge.repository.ts`): `findByTriple`, `findDuplicateOf`, `saveMany`, `repointIncidentEdges`. (resolution sub-doc §4)
- [ ] **P3 — `UnitOfWork` + `KnowledgeContext`** (`unit-of-work.ts`): `transaction(ctx => …)` exposing `{ nodes, edges, ledger }`. Mirror `@repo/server-ingestion`'s `UnitOfWork`. (idempotency sub-doc §4)
- [ ] **P4 — `EmbeddingGateway`** (`embedding.gateway.ts`): `embed(texts, model)`. (resolution sub-doc §4)

---

## Use case 1 — `EnrichEvents` (SQS push)

The hot path: one SQS message batch → read bodies → extract → resolve → upsert nodes → relate edges → record ledger, in one transaction. **Depends on:** D1, D2, D3, D4, P1, P2, P3.

### Domain

- [ ] **EE1 — `EntityResolution` domain service.** `entity-resolution.domain-service.ts`: `classify(candidate, matches) → Resolved(nodeId) | New | Ambiguous`. Pure decision over already-fetched matches; the only new domain type this layer adds. (resolution sub-doc §1) → _verify:_ key-hit ⇒ `Resolved`; no match ⇒ `New`; near-threshold/multiple ⇒ `Ambiguous`.

### Ports (pure)

- [ ] **EE2 — `EventSourceReader`** (`event-source.reader.ts`): `findByIds(ids)` returning the KG-owned `EventEntry` DTO. ACL — never imports ingestion's `Event`. (consumption sub-doc §3)
- [ ] **EE3 — `EntityExtractorGateway`** (`entity-extractor.gateway.ts`): `extract(entry) → ExtractionResult` with `CandidateNode`/`CandidateEdge`/`extractorVersion`. (extraction sub-doc §3)
- [ ] **EE4 — `NodeResolutionIndex`** (`node-resolution.index.ts`): `findSimilar(graphId, type, vector, threshold, k)`. (resolution sub-doc §4)
- [ ] **EE5 — `GraphResolution`** (`graph-resolution.policy.ts`): `resolve(tags) → KnowledgeGraphId`. (idempotency sub-doc §4)
- [ ] **EE6 — `ProcessedEventLedger`** (`processed-event.ledger.ts`): `seen(eventId, version)`, `record(...)`. (idempotency sub-doc §4)

### Use case (pure)

- [ ] **EE7 — `EnrichEvents` inbound port + `EnrichEventsUseCase`** (`enrich-events.use-case.ts`): `execute({ eventIds }) → Result<EnrichmentReport>`. Implements the orchestration in consumption sub-doc §5: ledger filter → sort by `occurredAt` → per-entry resolve/relate → one `UnitOfWork.transaction` (nodes + edges + ledger). → _verify:_ a use-case test with in-memory fakes (no DB) proves: new entity ⇒ `create`; repeated `eventId` ⇒ `attachEvents` no-op; re-asserted triple ⇒ `reinforce`; already-in-ledger ⇒ skipped.

### Infra (`@repo/server-knowledge-infra`)

- [ ] **EE8 — Event-table reader** (`read/event-source.reader.pg.ts`): `SELECT id, occurred_at, tags, body FROM events WHERE id = ANY(...)` → `EventEntry`. (consumption sub-doc §2)
- [ ] **EE9 — Node & edge pg repos** (`persistence/*.repository.pg.ts`) implementing P1/P2 against Prisma; new `knowledge_graph_node` / `knowledge_graph_edge` tables + unique constraint on the edge triple + FK to nodes (`server-database` migration).
- [ ] **EE10 — `UnitOfWorkPg`** (`persistence/unit-of-work.pg.ts`) implementing P3; copy the ingestion `UnitOfWorkPg` transaction-context shape.
- [ ] **EE11 — Processed-events ledger** adapter + table (`persistence/processed-event.ledger.pg.ts` + migration): `(event_id, extractor_version)` PK, `status`, `fact_hash`, `attempts`.
- [ ] **EE12 — `GraphResolution` policy adapter** (`gateways/graph-resolution.single-graph.ts`): Phase-0 single well-known `graphId`. (idempotency sub-doc §3)
- [ ] **EE13 — LLM extractor gateway** (`gateways/entity-extractor.llm.ts`): hybrid rules + structured-output, vocabulary enforced **in the adapter**; returns `extractorVersion`. (extraction sub-doc §1–§3)
- [ ] **EE14 — pgvector resolution index** (`persistence/node-resolution.index.pg.ts`) implementing EE4 (may share the embedding column / HNSW index).

### Worker (`apps/server-knowledge-worker`)

- [ ] **EE15 — SQS consumer job** (`jobs/enrich-events.job.ts`): long-poll loop → map message batch to `eventIds` → `EnrichEvents.execute` → delete on success; rely on visibility-timeout + DLQ for failures. (consumption sub-doc §1)
- [ ] **EE16 — Composition wiring** (`composition/`): construct adapters from config and inject into `EnrichEventsUseCase`; size the SQS visibility timeout above worst-case LLM+embedding latency (idempotency sub-doc §2, ADR `20260529` follow-up).
- [ ] **EE17 — End-to-end test:** enqueue → consume → graph rows written; redeliver same message ⇒ no duplicate nodes/edges (ledger + provenance hold). → _verify:_ second delivery changes nothing.

---

## Use case 2 — `EmbedNodes`

Assign/refresh embeddings for nodes that need one, off the hot path. **Depends on:** D1 (`assignEmbedding`), D5 (`accepts`), P1 (`findNeedingEmbedding`/`saveMany`), P3, P4.

### Use case (pure)

- [ ] **EN1 — `EmbedNodes` inbound port + use case** (`embed-nodes.use-case.ts`): `execute({ nodeIds?, limit }) → Result<void>`. No `nodeIds` ⇒ scan `findNeedingEmbedding(model, limit)`; embed via P4; `node.assignEmbedding(...)`; save. Handles the three triggers (new node, body revised, model drift via D5). (resolution sub-doc §2) → _verify:_ a node born `embedding: null` becomes embedded; a node already matching the graph's model is left untouched.

### Infra

- [ ] **EN2 — Embedder gateway** (`gateways/embedding.openai.ts` or chosen provider) implementing P4, batched.
- [ ] **EN3 — `findNeedingEmbedding` query** in the node pg repo (EE9): `WHERE embedding IS NULL OR embedding_model <> $policyModel LIMIT n`.

### Worker

- [ ] **EN4 — Jittered loop job** (`jobs/embed-nodes.job.ts`): `do work → sleep(interval + jitter) → repeat`, non-overlapping (ADR `20260529`).
- [ ] **EN5 — Wiring** in `composition/`.
- [ ] **EN6 — Test:** outage of the embedder leaves graph construction unaffected and nodes simply embed on the next run. → _verify:_ failure isolation holds.

---

## Use case 3 — `MergeDuplicateNodes`

Drain `DUPLICATE_OF` candidates: fold provenance into the survivor and re-point incident edges. Inherently async + cross-aggregate. **Depends on:** D1 (`attachEvents`), D6 (merge semantics), P1, P2 (`findDuplicateOf`/`repointIncidentEdges`), P3.

### Use case (pure)

- [ ] **MD1 — `MergeDuplicateNodes` inbound port + use case** (`merge-duplicate-nodes.use-case.ts`): `execute({ limit }) → Result<void>`. For each `DUPLICATE_OF`: load both nodes, `survivor.attachEvents(duplicate.eventIds)`, `repointIncidentEdges(duplicate, survivor)`, retire the duplicate — one `UnitOfWork.transaction` per merge. (resolution sub-doc §5) → _verify:_ survivor gains provenance; no edge is left pointing at the retired node; re-running is a no-op.

### Infra

- [ ] **MD2 — `findDuplicateOf` + `repointIncidentEdges`** in the edge pg repo (EE9), in one transaction; respect the edge unique constraint when re-pointing (merge can collide into an existing triple ⇒ reinforce instead of insert).

### Worker

- [ ] **MD3 — Jittered reconciler loop** (`jobs/merge-duplicate-nodes.job.ts`).
- [ ] **MD4 — Wiring** in `composition/`.
- [ ] **MD5 — Test:** a `DUPLICATE_OF` pair merges cleanly and a re-point that collides with an existing triple reinforces rather than violating the unique constraint.

---

## Suggested sequencing

1. **Shared foundation** — D1–D6, P1–P4. Nothing else compiles without the domain mutators and core ports.
2. **`EnrichEvents`** (EE1–EE17) — the spine; delivers a working capture→graph path end to end.
3. **`EmbedNodes`** (EN1–EN6) — turns nodes searchable; independent once EnrichEvents writes nodes.
4. **`MergeDuplicateNodes`** (MD1–MD5) — drains the deferred-merge backlog EnrichEvents produces.

EmbedNodes and MergeDuplicateNodes are independent of each other and can proceed in parallel after EnrichEvents lands. Throughout, keep `@repo/server-knowledge` dependency-clean (only `@repo/server-kernel` + `zod`); every adapter task lives in `-infra` or the worker app.
</content>
