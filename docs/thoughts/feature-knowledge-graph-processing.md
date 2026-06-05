# RecallOS — Knowledge Graph Processing (Application Layer)

Designs the **application layer** of the knowledge context (`@repo/server-knowledge`): the use cases, ports, and orchestration that take raw **event entries** from the ingest log and **enrich the graph** out of them — extract → resolve → upsert nodes → embed → relate. This is the **"enrich → relate"** stage of the product pipeline (`capture → enrich → relate → recall`), driven by the enricher runtime (`apps/server-knowledge-worker`, a driving adapter — [`project-structure.md`](./project-structure.md) §6).

It is the discovery that two siblings explicitly deferred to "later":

- [`feature-knowledge-graph.md`](./feature-knowledge-graph.md) designed the **domain** of this context (Approach A — node/edge as independent aggregate roots, a thin graph root, the `GraphRelation` domain service, closed `NodeType`/`RelationshipType` vocabularies, `DUPLICATE_OF` + `mergeNodes` for entity resolution) and ended with _"`application/` — use cases + ports — separate discovery."_ **This is that discovery.**
- [`feature-event-ingestion.md`](./feature-event-ingestion.md) §7 named the seam that _kicks off_ enrichment. That seam has since been designed in [`feature-event-publication.md`](./feature-event-publication.md) and **built** (outbox → SQS, see §1 below) — so this layer now consumes a seam that exists, not one it has to cope around.

Scope is the **pure application core**: inbound (driving) ports + their use-case implementations, and outbound (driven) port interfaces. Adapters (the LLM extractor, the embedder, the Postgres repositories, the `pgvector` resolution index, the event-log reader, the processed-events ledger table) are named as seams but **not built** — they live in `@repo/server-knowledge-infra`.

> **State of the code (2026-05).** The KG **domain** is on disk: `KnowledgeGraph`, `KnowledgeGraphNode`, `KnowledgeGraphEdge` aggregates, their value objects, the closed `NodeType`/`RelationshipType` vocabularies, and the `Invalid*` errors — currently exposing **`create`/`restore` only**. The mutators and services this layer orchestrates (`attachEvents`, `assignEmbedding`, `reviseBody`, `reinforce`, `GraphRelation.relate`, `EntityResolution.classify`, `mergeNodes`, `KnowledgeGraph.accepts`) are the domain contract from `feature-knowledge-graph.md` and are **not all implemented yet**. The KG **application layer** (everything below) and `@repo/server-knowledge-infra` are still empty. So this remains **a design contract the package should converge toward**, not code on disk.

---

## 1. Where this fits

The product is a pipeline; this context owns the middle two arrows:

```
capture  →  enrich  →  relate  →  recall
 Service    Worker      Worker     Service
            └────── this doc ──────┘
```

`Service` (`apps/server-api-service`) appends opaque events to an append-only log and, in the same transaction, writes an **outbox** row; a relay (`apps/server-outbox-worker`) forwards each as an SQS message carrying `eventId`, timestamps, routing `tags`, and `body` ([`feature-event-publication.md`](./feature-event-publication.md), ADR [`20260524-outbox-sqs-event-publication`](../../decision-records/server/20260524-outbox-sqs-event-publication.md)). This application layer **drains that stream and distills the graph from it** — entities become **nodes** (with embeddings), assertions become **typed edges** — so that `recall` can later traverse trustworthy, time-aware relationships.

> **The framing that shapes everything below.** The _domain_ model is deliberately blind to event payloads: a node references the events it was derived from **by `EventId` only** and _"never dereferences them"_ (`feature-knowledge-graph.md` §2/§4.1). But **enrichment cannot be blind** — to extract entities and relationships it must read the event's opaque **`body`**, its routing **`tags`**, and its **`occurredAt`**. The published SQS message therefore carries those fields as a knowledge-owned event-entry payload. Holding this line — payload-reading in the app, id-only provenance in the domain — is the spine of the design.

This doc is **write-side only.** The recall/read path (`RelationshipGraph` traversal, ranking, GraphRAG) is a separate discovery; the `RelationshipGraph` port named in the domain doc is _not_ exercised here.

---

## 2. Ubiquitous language

| Term                        | Meaning in this layer                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Event entry**             | A read DTO `{ id, occurredAt, tags, body }` returned by the event-read port. The app's view of a raw log item — distinct from the domain's id-only `EventId`. |
| **Candidate**               | A _proposed_ entity or relationship emitted by the extractor from one event entry, **before** resolution. Not yet a node/edge.                                |
| **Resolution**              | Deciding whether a candidate entity **is** an existing node, is **new**, or is **ambiguous** (defer). Produces a `NodeId`.                                    |
| **Enrichment run**          | One execution of the enrichment core over the event entries named by one SQS message batch.                                                                   |
| **Processed-events ledger** | The record of _effect_ — "this `eventId` was processed by this extractor version." The idempotency guard against SQS redelivery.                              |
| **factHash**                | A content hash of `(eventId, normalized-fact)` used to detect "same fact, already asserted" and skip redundant work.                                          |
| **Extractor version**       | A monotonically-bumped tag for the extraction logic/prompt/model. Reprocessing under a new version is legitimate.                                             |

> **Naming caution (three things called "event").** _Event entry_ = a raw item in the ingest log (the thing we read). _Domain event_ = the kernel pub/sub building block (`NodeCreated`, `NodesRelated`, …) recorded on aggregates. _`EventRecorded`_ = the specific domain event ingestion raises (now built) to announce a fact landed. They share a word, not a concept.

---

## 3. Building blocks reused

This layer writes **no new domain types** — it orchestrates existing ones.

- **From the KG domain (`@repo/server-knowledge`, `feature-knowledge-graph.md`):** `KnowledgeGraphNode.create / attachEvents / assignEmbedding / reviseBody`; `KnowledgeGraphEdge.create / reinforce`; the pure domain service `GraphRelation.relate(...)`; the thin `KnowledgeGraph.accepts(embedding)` policy; value objects `NodeBody`, `Embedding`, `Confidence`, the ids; and the **closed vocabularies** `NodeType` / `RelationshipType`. The edge-dedup rule — identity is the triple `(fromId, toId, relationship)` per graph, re-assertion **reinforces** — and the provenance-set semantics (`eventIds`/`sourceEventIds` only grow) are the backbone of idempotency ([idempotency sub-doc](./feature-knowledge-graph-processing-idempotency.md)).
- **From `@repo/server-kernel`:** `Result<T>` (use-case outcomes are values, not throws — ADR [`20260523-result-vs-throw`](../../decision-records/server/20260523-result-vs-throw-hexagonal-backend.md)), `Id` (mints UUID v7), `Clock`, `DomainEvent`, `DomainError`.
- **From `@repo/server-platform`:** the `pino` logger and `zod` config. (The pg pool / event bus are still "to come"; the **unit-of-work is a context-owned outbound port**, mirroring `@repo/server-ingestion` — see §4 and the [idempotency sub-doc](./feature-knowledge-graph-processing-idempotency.md).)

> **Ids are minted inside the domain factories, not by an app-layer port.** `KnowledgeGraphNode.create` / `KnowledgeGraphEdge.create` already call `NodeId.create()` / `EdgeId.create()` (kernel UUID v7) internally and take only `now: Date`. So this layer passes the `Clock`'s `now` into the factories and lets the domain mint the id — there is **no `IdGenerator` port**. (An earlier draft of this doc proposed one; the built domain made it unnecessary.)

The domain stays pure precisely _because_ this layer owns the impure inputs it needs: **timestamps are generated here** (via the `Clock` port) and passed _into_ the domain factories.

---

## 4. Pipeline shape & use-case decomposition

Enrichment is a multi-stage pipeline:

```
read events → extract candidates → resolve to nodes → upsert nodes → relate (edges)
                                                              ↓
                                                      embed node bodies
```

**One cohesive write core, two drivers, embedding and merging split out.**

| Use case (inbound port)   | Responsibility                                                                                                                          | Driven by                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **`EnrichEvents`**        | Given event entries from SQS, extract → resolve → upsert nodes → relate edges → record ledger. One transactional run.                   | **SQS push** (`apps/server-knowledge-worker` consumer).              |
| **`EmbedNodes`**          | Assign/refresh embeddings for nodes that need one. Calls the embedding gateway, then `node.assignEmbedding(...)`.                       | Jittered loop scanning nodes needing embedding (resolution sub-doc). |
| **`MergeDuplicateNodes`** | Drain `DUPLICATE_OF` edges: fold provenance into the survivor (`attachEvents`) and re-point incident edges. Reuses the merge semantics. | Jittered reconciler loop.                                            |

Enrichment is driven solely by **SQS push** — one recorded event per message, consumed by `apps/server-knowledge-worker`. The **processed-events ledger** guard makes at-least-once redelivery safe: a message re-delivered by SQS is a no-op. There is **no cursor/reconcile path** — completeness rests on SQS at-least-once delivery plus a DLQ for poison messages, and the `events` table stays the source of truth for any future manual backfill. `EmbedNodes` and `MergeDuplicateNodes` run on their own in-process **sleep + jitter** loops (ADR [`20260529-in-process-sleep-jitter-worker-trigger`](../../decision-records/server/20260529-in-process-sleep-jitter-worker-trigger.md)), not cron.

**Why split embedding out** (rather than embedding inline in `EnrichEvents`): the domain makes embedding **optional at birth** (`create` always sets `embedding: null`) and assigns it later via `assignEmbedding`, recording a separate `NodeEmbedded` event — a distinct lifecycle phase. An embedding-API outage then **does not block graph construction**, the most expensive/rate-limited call is isolated and independently retriable, and the same job handles **re-embedding** on body revision / model change. Full reasoning in the [resolution & embedding sub-doc](./feature-knowledge-graph-processing-resolution.md).

`MergeDuplicateNodes` is split out only because it is inherently _asynchronous and cross-aggregate_ (it rewrites edges of two nodes at once). Splitting extract/resolve/relate into separate jobs is **not** done in Phase 0: it buys decoupling we don't need, multiplies the idempotency surface, and breaks the natural per-event atomicity that makes a run easy to reason about.

---

## 5. The four sub-documents

The depth lives in four focused sub-docs. Read in pipeline order:

1. **[Event consumption & cross-context integration](./feature-knowledge-graph-processing-event-consumption.md)** — how enrichment is triggered (SQS push) and how the SQS payload carries the knowledge-owned event entry. Inbound `EnrichEvents`; the enrichment orchestration.
2. **[Extraction](./feature-knowledge-graph-processing-extraction.md)** — opaque `body` → candidates already typed to the closed vocabulary; hybrid rules + LLM routed on `tags`; vocabulary enforced in the gateway; the source-signal → relationship mapping; `DERIVED_FROM` vs `eventIds`. Port: `EntityExtractorGateway`.
3. **[Entity resolution & embedding](./feature-knowledge-graph-processing-resolution.md)** — deciding a candidate **is** an existing node (deterministic key → vector ANN → defer); the pure `EntityResolution.classify` decision; `EmbedNodes` triggers; node-body canonicalization. Ports: `NodeResolutionIndex`, `EmbeddingGateway`, the node/edge repositories.
4. **[Idempotency, consistency & multi-tenancy](./feature-knowledge-graph-processing-idempotency.md)** — at-least-once safety (the processed-events ledger, `factHash`, extractor versioning); the transaction boundary (context-owned unit-of-work); ordering / poison events / back-pressure; resolving a `graphId` per event. Ports: `ProcessedEventLedger`, `GraphResolution`, `UnitOfWork`.

For the build-out, the **[implementation tasks](./feature-knowledge-graph-processing-tasks.md)** doc decomposes this design use-case by use-case (`EnrichEvents` / `EmbedNodes` / `MergeDuplicateNodes`) into ordered sub-tasks with verification checks.

---

## 6. Decisions, alternatives, and deferred work

**Decisions taken (with the rejected alternative):**

- **Consume events → SQS push only** ([consumption](./feature-knowledge-graph-processing-event-consumption.md)). The original draft chose cron batch-pull because the publisher seam did not exist; it now does (outbox → SQS, ADR `20260524`), so enrichment is driven per-event off the queue. No cursor/reconcile path — at-least-once delivery, a DLQ, and the `eventId` ledger cover redelivery and poison messages; the `events` table stays the source of truth for any manual backfill. A scheduled reconciler can be added later behind a new driving adapter over the same use case if evidence demands it.
- **Integration → payload-in-event for the hot path** ([consumption](./feature-knowledge-graph-processing-event-consumption.md)), with the immutable `events` table remaining the canonical replay/backfill source. The outbox table stays metadata-only; the relay joins `events` to publish the body.
- **Pipeline → one enrichment core (two drivers); `EmbedNodes` and `MergeDuplicateNodes` split out** (§4), not a single fat job and not fully fragmented per-stage jobs.
- **Extraction → hybrid, vocabulary enforced in the gateway** ([extraction](./feature-knowledge-graph-processing-extraction.md)), not LLM-only and not rules-only.
- **Resolution → conservative hybrid + deferred merge; the decision is a pure domain service** ([resolution](./feature-knowledge-graph-processing-resolution.md)), not synchronous fuzzy merging. Prefers transient fragmentation over irreversible over-merge.
- **Idempotency → deterministic-`eventId`-anchored ledger** ([idempotency](./feature-knowledge-graph-processing-idempotency.md)), not keyed on extractor output. Survives SQS redelivery and non-deterministic extraction; extractor versioning re-processes by design.
- **`graphId` → a resolution policy/port with a Phase-0 single-graph default** ([idempotency](./feature-knowledge-graph-processing-idempotency.md)). Completes the multi-tenancy decision the domain deferred, behind a swappable port.
- **No `IdGenerator` port** (§3) — the domain factories mint ids; the app passes only `now`.

**Deferred on purpose:**

- **Advanced entity resolution** — blocking/clustering, LLM canonicalization, active-learning thresholds; Phase 0 is key + ANN + deferred merge.
- **Full multi-tenancy & isolation** — RLS/scoping enforcement; the policy port reserves the seam.
- **Recall / read path** — `RelationshipGraph` traversal, ranking, GraphRAG (write-side only here).
- **Richer broker topologies** — SNS→SQS fan-out, Kinesis/MSK replay; each is an adapter swap behind the same seam once a concrete trigger appears (`feature-event-publication.md` §6).
- **Cost/usage metering & autoscaling** — beyond the bounded-page/budget guards of the idempotency sub-doc.

---

## 7. Where this lives

Per `project-structure.md` §4/§9, the application layer is `application/` inside the pure `@repo/server-knowledge` package; adapters are in `@repo/server-knowledge-infra`; wiring is in `apps/server-knowledge-worker` (the enricher).

```
packages/server-knowledge/src/
├─ domain/                                  # built (create/restore today) — feature-knowledge-graph.md
│  └─ entity-resolution.domain-service.ts   # NEW pure service (classify) — resolution sub-doc
└─ application/
   ├─ use-cases/
   │  ├─ enrich-events.use-case.ts           # EnrichEvents (SQS push)
   │  ├─ embed-nodes.use-case.ts             # EmbedNodes
   │  └─ merge-duplicate-nodes.use-case.ts   # MergeDuplicateNodes
   └─ ports/outbound/
      ├─ entity-extractor.gateway.ts         # EntityExtractorGateway
      ├─ embedding.gateway.ts                # EmbeddingGateway
      ├─ knowledge-graph-node.repository.ts  # node repo port
      ├─ knowledge-graph-edge.repository.ts  # edge repo port
      ├─ node-resolution.index.ts            # NodeResolutionIndex
      ├─ graph-resolution.policy.ts          # GraphResolution
      ├─ processed-event.ledger.ts           # ProcessedEventLedger
      └─ unit-of-work.ts                     # KG-owned UnitOfWork + KnowledgeContext

packages/server-knowledge-infra/src/         # adapters (NOT built here)
├─ persistence/                              #   *.repository.pg.ts, ledger table, pgvector resolution index, UoW
├─ gateways/                                 #   LLM extractor, embedder
└─ read/                                     #   optional event-table readers for replay/backfill

apps/server-knowledge-worker/src/
├─ jobs/                                      # SQS consumer (enrich) + jittered loops (embed / merge)
└─ composition/                              # DI: wire use cases ← infra adapters
```

`@repo/server-knowledge` still lists **only** `@repo/server-kernel` (and `zod`) as dependencies — every line above touching I/O is an interface, satisfied by `-infra`. The dependency rule stays mechanically enforced (`project-structure.md` §8; [`docs/engineering/server-hexagonal-application-layer.md`](../engineering/server-hexagonal-application-layer.md)).

---

## Closing notes

- This is a **pure application layer over an already-decided domain**: it reads the event payloads the domain refuses to dereference, and orchestrates `create`/`attachEvents`/`reinforce`/`relate` — adding no new domain rules. Timestamps enter via the `Clock`; ids are minted inside the domain factories.
- It resolves the **one judgment call the domain left open** — `graphId` per event — behind a swappable policy, and honors the **one hard boundary the domain set** — provenance is `eventIds`, never a `DERIVED_FROM` edge.
- Idempotency is anchored on the deterministic **event id** (ledger), so the pipeline is safe under at-least-once SQS delivery _and_ non-deterministic extraction.
- Everything impure — trigger, extractor, embedder, store — is **behind a port**, so a future trigger graduation (adding a reconciler over the same use case), replay/backfill source changes, and the store graduations of `database-tradeoffs.md` all stay **adapter-local**. The application core never moves.
  </content>
