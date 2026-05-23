# RecallOS — Knowledge Graph Processing (Application Layer)

Designs the **application layer** of the knowledge-graph context: the use cases, ports, and orchestration that take raw **event entries** from the ingest log and **enrich the graph** out of them — extract → resolve → upsert nodes → embed → relate. This is the **"enrich → relate"** stage of the product pipeline (`capture → enrich → relate → recall`), driven by the cron `Worker` (`apps/worker`, a driving adapter — [`project-structure.md`](./project-structure.md) §6).

It is the discovery that two siblings explicitly deferred to "later":

- [`feature-knowledge-graph.md`](./feature-knowledge-graph.md) designed the **domain** of this context (Approach A — node/edge as independent aggregate roots, a thin graph root, the `GraphRelation` domain service, closed `NodeType`/`RelationshipType` vocabularies, `DUPLICATE_OF` + `mergeNodes` for entity resolution) and ended with *"`application/` — use cases + ports — separate discovery."* **This is that discovery.**
- [`feature-event-ingestion.md`](./feature-event-ingestion.md) §7 named the seam that *kicks off* enrichment — a future `EventRecorded` domain event published via an `EventPublisher` port — calling it *"a separate context, a separate discovery."* This doc consumes that seam (and copes with the fact that it isn't built yet, §3).

Scope is the **pure application core**: inbound (driving) ports + their use-case implementations, and outbound (driven) port interfaces. Adapters (the LLM extractor, the embedder, the Postgres repositories, the `pgvector` resolution index, the event-log reader, the checkpoint/ledger tables) are named as seams in §15 but **not built** — they live in `@repo/knowledge-graph-infra`. Like its siblings, this is a **design contract the package should converge toward**, not code on disk.

---

## 1. Where this fits

The product is a pipeline; this context owns the middle two arrows:

```
capture  →  enrich  →  relate  →  recall
 Service    Worker      Worker     Service
            └────── this doc ──────┘
```

`Service` appends opaque events to an append-only log; this application layer **drains that log and distills the graph from it** — entities become **nodes** (with embeddings), assertions become **typed edges** — so that `recall` can later traverse trustworthy, time-aware relationships.

> **The framing that shapes everything below.** The *domain* model is deliberately blind to event payloads: a node references the events it was derived from **by `EventId` only** and *"never dereferences them"* (`feature-knowledge-graph.md` §2/§4.1). But **enrichment cannot be blind** — to extract entities and relationships it must read the event's opaque **`body`**, its routing **`tags`**, and its **`occurredAt`**. So the *application* layer needs a cross-context **event-read port** that returns payloads, while the *domain* keeps storing only `EventId`s as provenance. The read port is an **anti-corruption layer**: it returns a knowledge-graph-owned DTO and **never imports the ingestion `Event` aggregate**. Holding this line — payload-reading in the app, id-only provenance in the domain — is the spine of the design.

This doc is **write-side only.** The recall/read path (`RelationshipGraph` traversal, ranking, GraphRAG) is a separate discovery; the `RelationshipGraph` port named in the domain doc is *not* exercised here.

---

## 2. Ubiquitous language

| Term | Meaning in this layer |
|---|---|
| **Event entry** | A read DTO `{ id, occurredAt, tags, body }` returned by the event-read port. The app's view of a raw log item — distinct from the domain's id-only `EventId`. |
| **Candidate** | A *proposed* entity or relationship emitted by the extractor from one event entry, **before** resolution. Not yet a node/edge. |
| **Resolution** | Deciding whether a candidate entity **is** an existing node, is **new**, or is **ambiguous** (defer). Produces a `NodeId`. |
| **Enrichment run** | One execution of the `EnrichEvents` use case over a bounded page of events. |
| **Checkpoint / cursor** | The high-water mark of *progress* through the log — "events up to here have been pulled." Keyed on `recordedAt`. |
| **Processed-events ledger** | The record of *effect* — "this `eventId` was processed by this extractor version." The idempotency guard. Distinct from the cursor (§9). |
| **factHash** | A content hash of `(eventId, normalized-fact)` used to detect "same fact, already asserted" and skip redundant work. |
| **Extractor version** | A monotonically-bumped tag for the extraction logic/prompt/model. Reprocessing under a new version is legitimate (§9). |

> **Naming caution (three things called "event").** *Event entry* = a raw item in the ingest log (the thing we read). *Domain event* = the kernel pub/sub building block (`NodeCreated`, `NodesRelated`, …) recorded on aggregates and published after commit. *`EventRecorded`* = the specific (future) domain event ingestion will raise to notify us a fact landed (§3). They share a word, not a concept.

---

## 3. Central decision — how this context consumes events

Enrichment must be *triggered* and must *know which events are new*. Two shapes:

### Approach A — cron batch-pull with a cursor

The `Worker`'s cron fires `EnrichEvents`; the use case **pulls** a bounded page of events from the read port (`WHERE recordedAt > cursor ORDER BY recordedAt, id`), processes them, and advances the cursor. Triggering (cron) and progress (cursor) are owned here.

### Approach B — event-driven queue push

Ingestion publishes `EventRecorded` to a queue; a `Worker` consumer drives `EnrichEvents` per event (or per micro-batch) in near-real-time.

| | Approach A — pull + cursor | Approach B — queue push |
|---|---|---|
| **Buildable today** | **Yes** — only needs to read the existing `events` table. | **No** — depends on an upstream seam that doesn't exist yet (see below). |
| **Latency** | Minutes (cron cadence). | Seconds. |
| **LLM/embedding economics** | **Batches naturally** — a page of events amortizes model calls; bounded page = bounded cost/run. | Per-event calls unless the consumer re-batches; worse unit economics. |
| **Infra** | A cron trigger + a cursor row. **Minimal.** | A queue/bus, a consumer, DLQ, visibility-timeout tuning. **More moving parts.** |
| **Back-pressure** | Trivial — non-overlapping cron + bounded page (§10). | Needs explicit consumer concurrency/back-pressure control. |
| **Ordering** | We sort each page deterministically (§10). | At-least-once, out-of-order delivery to reason about. |

**The constraint that decides it:** the ingestion `Event` aggregate as designed has **no `EventRecorded` domain event and no `EventPublisher`** — `feature-event-ingestion.md` §7 lists them as *future* work (*"when capture later needs to notify the Worker…"*). **So Approach B literally cannot be built until ingestion adds that seam.** That isn't a reason to prefer A on its own, but combined with A's better batch economics and minimal infra for a small team on one Aurora cluster, it's decisive.

**Recommendation: Approach A for Phase 0.** Crucially, **shape the inbound port so a queue consumer can drive it later without touching the app layer** — `EnrichEvents.execute({ batchSize })` is agnostic to *who* calls it. When ingestion grows the `EventRecorded`/`EventPublisher` seam, a queue-driving adapter in `apps/worker/src/jobs/` becomes a new driving adapter over the *same* use case; the cursor degrades to a safety-net reconciler. Graduation is an adapter, not a rewrite.

---

## 4. Central decision — cross-context integration (context mapping)

Approach A still has to *read* events that belong to the **ingestion** bounded context. Three integration styles (DDD context-mapping terms in parentheses):

| | Shared-DB read via ACL port *(Shared Database)* | Payload-in-event *(Published Language)* | Sync read API *(Open-Host / Customer-Supplier)* |
|---|---|---|---|
| **How** | A `knowledge-graph-infra` adapter `SELECT`s the `events` table directly, behind our `EventSourceReader` port, mapping rows → our DTO. | `EventRecorded` carries the full `{occurredAt, tags, body}`; we consume the payload off the bus. | We call an ingestion HTTP/RPC endpoint to fetch event payloads. |
| **Buildable now** | **Yes** (one Aurora cluster). | No (no publisher seam yet — §3). | No (no such endpoint; both runtimes already share the DB). |
| **Coupling** | **Highest** — two contexts share a table. Mitigated by the ACL (below). | Low — contexts share only a message contract. | Low — contexts share only an API contract. |
| **Latency / cost** | One local query per page. | Bus delivery; payload duplicated into messages. | Network hop + ingestion serving load. |
| **Fit for Phase 0** | **Best** — pragmatic on a consolidated DB. | Premature (infra we don't have). | Pointless indirection (same DB, two of our own runtimes). |

**Recommendation: shared-DB read behind an anti-corruption `EventSourceReader` port.** Name the coupling honestly — it *is* the most-coupled option — and contain it:

1. The adapter returns a **knowledge-graph-owned DTO** (`EventEntry`, §13), **never** the ingestion `Event` aggregate. The KG package does not depend on `@repo/ingestion`.
2. Treat the columns we read — `{ id, occurredAt, tags, body }` — as a **published-language read contract**. As long as ingestion preserves those, our adapter is stable.

Because the contract is the port, graduating to payload-in-event (once the upstream publisher exists) or to a read API is a **new adapter for the same port** — zero app-layer change. This is exactly the "keep it behind an interface, graduate by evidence" discipline of `database-tradeoffs.md` and `project-structure.md`.

---

## 5. Building blocks reused

This layer writes **no new domain types** — it orchestrates existing ones.

- **From the KG domain (`feature-knowledge-graph.md`):** `KnowledgeGraphNode.create / attachEvents / assignEmbedding / reviseBody`; `KnowledgeGraphEdge.create / reinforce`; the pure domain service `GraphRelation.relate(...)`; the thin `KnowledgeGraph.accepts(embedding)` policy; value objects `NodeBody`, `Embedding`, `Confidence`, the ids; and the **closed vocabularies** `NodeType` / `RelationshipType`. The edge-dedup rule — identity is the triple `(fromId, toId, relationship)` per graph, re-assertion **reinforces** — and the provenance-set semantics (`eventIds` only grow) are the backbone of idempotency (§9).
- **From `@repo/kernel`:** `Result<T>` (use-case outcomes are values, not throws), `Id`, `Clock`, `DomainEvent`, `DomainError`.
- **From `@repo/platform`:** the **unit-of-work** (atomic multi-aggregate writes while still one Postgres — §10), the **eventBus** (publish-after-commit), the pg pool, the `pino` logger, `zod` config.

The domain stays pure precisely *because* this layer owns the impure inputs it needs: **ids and timestamps are generated here** (via `IdGenerator` and `Clock` ports) and passed *into* the domain factories, as the domain doc requires.

---

## 6. Pipeline shape & use-case decomposition

Enrichment is a multi-stage pipeline:

```
read events → extract candidates → resolve to nodes → upsert nodes → relate (edges)
                                                              ↓
                                                      embed node bodies
```

The decision is **where to cut it into use cases**. Recommendation: **one cohesive write use case, with embedding and merging split out.**

| Use case (inbound port) | Responsibility | Driven by |
|---|---|---|
| **`EnrichEvents`** | The hot path: read a page → extract → resolve → upsert nodes → relate edges → advance cursor → publish domain events. One transactional run. | Cron (today); queue later (§3). |
| **`EmbedNodes`** | Assign/refresh embeddings for nodes that need one. Calls the embedding gateway, then `node.assignEmbedding(...)`. | `NodeCreated` / body-revision / model-drift (§12). |
| **`MergeDuplicateNodes`** | Drain `DUPLICATE_OF` edges: fold provenance into the survivor (`attachEvents`) and re-point incident edges. Reuses the domain's merge semantics. | Cron (async reconciler). |

**Why split embedding out** (rather than embedding inline in `EnrichEvents`):

| | Embedding split into `EmbedNodes` | Embedding inline in `EnrichEvents` |
|---|---|---|
| **Domain signal** | The domain *already* makes embedding **optional at birth** and assigns it later via `assignEmbedding`, recording a *separate* `NodeEmbedded` event. The model is telling us it's a distinct lifecycle phase. | Fights the domain — forces a node to be born embedded. |
| **Failure isolation** | An embedding-API outage **does not block graph construction**; nodes are born `embedding: null` by design and get embedded on the next `EmbedNodes` run. | An embedding outage wedges the whole enrichment run. |
| **Cost / rate limits** | The most expensive, most rate-limited call is isolated and independently retriable/batchable. | Couples graph mutation throughput to embedding throughput. |
| **Reuse** | The same job handles **re-embedding** on body revision / model change (§12). | Re-embedding needs separate plumbing anyway. |

**Why *not* split further** (separate extract / resolve / relate jobs) in Phase 0: it buys decoupling we don't need, multiplies the idempotency surface, and breaks the natural per-event atomicity that makes a run easy to reason about. `MergeDuplicateNodes` is split out only because it is inherently *asynchronous and cross-aggregate* (it rewrites edges of two nodes at once).

---

## 7. Extraction — opaque body → typed candidates

The extractor turns an event entry's **opaque** body into **candidates** already typed to the closed vocabulary. It is pure I/O (a model/parse call), so it is an **outbound gateway port** (`EntityExtractorGateway`); the use case never embeds extraction logic.

**Recommendation: hybrid extraction, routed on `tags`.** `tags` is explicitly *"what the Worker routes on"* (ingestion §2):

- **Deterministic rules** for known *structured* sources (a Slack message, a GitHub PR, a calendar invite). Cheap, exact, **deterministic** — and the only reliable source of *structural* relationships.
- **LLM structured-output** for *free-text* bodies, constrained to emit only `NodeType`/`RelationshipType` members.

| | Rules (structured sources) | LLM (free-text) | Hybrid (recommended) |
|---|---|---|---|
| **Accuracy on known shapes** | **High** | Medium | **High** |
| **Coverage of unknown shapes** | Low | **High** | **High** |
| **Cost / latency** | **Negligible** | High | Pay LLM cost **only** for free-text |
| **Determinism / idempotency** | **Deterministic** | Non-deterministic (§9) | Deterministic where it matters most |

> **Vocabulary is enforced in the gateway adapter, not the orchestrator.** The gateway's *output type* is already `NodeType`/`RelationshipType`; mapping an un-classifiable relation to `RELATED_TO` (or dropping it) happens **inside the adapter** (e.g. via a structured-output schema/grammar). If the gateway returned free strings and the use case mapped them, vocabulary governance would leak into the application layer. The closed vocabulary is the domain's contract; the adapter honors it.

**Where the typed relationships actually come from** — a mapping the doc makes explicit so adapters are consistent:

| Source signal | Candidate relationship | Notes |
|---|---|---|
| message `author` field | `AUTHORED_BY` / `SENT_BY` | Deterministic, from structured metadata. |
| thread `parent`/`in_reply_to` | `REPLIES_TO` | Deterministic. |
| document → its section/attachment | `PART_OF` | Deterministic structural composition. |
| task `assignee` | `ASSIGNED_TO` | Deterministic. |
| free-text naming a person/org/topic | `MENTIONS`, `INVOLVES`, `RELATED_TO` | LLM; default to the weakest accurate type. |
| explicit "see also" / citation | `REFERENCES` | Either, depending on source. |

> **Do not conflate `DERIVED_FROM` with `eventIds` provenance.** A node's link back to the **events** that justify it is the node's `eventIds` set — **not** an edge. `DERIVED_FROM` is a **node→node** lineage edge (e.g. a summary node derived from a document node). The extractor must keep these separate; emitting `DERIVED_FROM` edges to represent event provenance would double-model the data and corrupt traversal.

---

## 8. Entity resolution / dedup

The hardest stage: deciding a candidate entity **is** an existing node. **Recommendation: a conservative hybrid with deferred merge**, and a clean **split of responsibility** between an I/O port and a pure decision.

1. **Deterministic natural key first.** Normalize `(type, key)` (e.g. `PERSON` + canonical email/handle) and look it up. Exact, cheap, deterministic.
2. **Vector ANN second.** If no key hit, embed the candidate body and ask the resolution index for similar same-type nodes above a threshold.
3. **Defer the hard cases.** If matches are ambiguous (near-threshold, multiple plausible), **do not guess in the hot path** — create the node *and* record a `DUPLICATE_OF` candidate that `MergeDuplicateNodes` reconciles later (reusing the domain's `mergeNodes`). Provenance is never lost, so deferring is safe.

**Port vs domain service — split by responsibility** (mirroring how `GraphRelation.relate` takes already-loaded aggregates):

- The **I/O** — natural-key lookup, ANN search — is an outbound port (`NodeResolutionIndex` + repo lookups).
- The **decision** — *"this candidate is `Resolved(nodeId)` / `New` / `Ambiguous`"* — is a **pure domain service** `EntityResolution.classify(candidate, matches)`, operating on already-fetched matches. This keeps the *threshold policy* pure and unit-testable instead of buried in an adapter.

| Strategy | Pro | Con |
|---|---|---|
| Deterministic key only | Fast, deterministic, no model cost | Misses fuzzy duplicates ("Alice" vs "Alice Smith") → fragmentation |
| Vector similarity only | Catches fuzzy duplicates | Threshold tuning; risk of **over-merging** distinct entities; model cost |
| LLM canonicalization | Highest recall | Cost, latency, non-determinism, hardest to make idempotent |
| **Hybrid + deferred merge (chosen)** | Deterministic where possible, fuzzy where needed, **never over-merges synchronously** | Two passes; the merge backlog must be drained |

The bias is **conservative**: prefer transient fragmentation (fixable by a later merge) over irreversible over-merging in the hot path.

---

## 9. Idempotency & delivery semantics

Processing is **at-least-once** (a run can crash after writing but before advancing the cursor; a redelivered queue message can repeat). Therefore **writes must be idempotent**.

The domain *gives* us idempotent writes — **but only if resolution is stable**:

- Re-asserting an edge triple `(from, to, relationship)` **reinforces** instead of duplicating.
- `attachEvents` unions provenance — re-adding an `eventId` is a no-op.

The threat: **LLM extraction is non-deterministic**, so the *same* event reprocessed can yield slightly different candidates, which could resolve to *different* nodes and break that stability.

**Recommendation: anchor idempotency on the deterministic `eventId`, not on extractor output. Keep two distinct mechanisms:**

| Mechanism | Question it answers | Key | Why separate |
|---|---|---|---|
| **Checkpoint / cursor** | "How far have we *pulled*?" | `recordedAt` high-water mark | Progress only. Append-only log ⇒ monotonic, safe. |
| **Processed-events ledger** | "Was this event's *effect* already applied?" | `(eventId, extractorVersion) → status, factHash, attempts` | **Exactly-once effect.** Skip an already-processed event regardless of LLM jitter. |

Layered guards beneath the ledger: **deterministic candidate keys** (normalized name+type) so that even a re-extraction resolves to the *same* node; and **`factHash`** of `(eventId, normalized-fact)` to skip re-asserting a fact already recorded (avoids confidence churn).

**Extractor versioning is a feature, not a bug.** Bumping `extractorVersion` makes the ledger *miss*, so events are legitimately reprocessed under the better extractor — provenance grows, edges reinforce, nothing duplicates. That is exactly the desired "the graph improves as the extractor improves" behavior.

---

## 10. Cross-cutting consistency & failure

- **Transaction boundary.** Per Approach A of the domain, node and edge are separate aggregates. A run wraps its writes — **nodes + edges + ledger rows + checkpoint** — in the platform **unit-of-work**, so a page commits atomically while we are still on one Postgres. When the graph store later splits out (Neptune), this degrades to *accepted eventual consistency* (domain §8) — the "no dangling edge / no duplicate edge" guarantees are also backed by a DB FK + unique constraint, so a race can't corrupt the store.
- **Ordering tension — pull by `recordedAt`, relate by `occurredAt`.** We *checkpoint* on `recordedAt` (monotonic capture order — safe progress for an append-only log). But an edge's **`observedAt` must be the source event's `occurredAt`**, and `reinforce` keeps the *latest* `observedAt`. Late-arriving events mean `recordedAt` order ≠ `occurredAt` order. So: **pull/checkpoint by `recordedAt`, but sort the in-memory page by `occurredAt` before the relate step.** Mapping is explicit: `edge.observedAt = entry.occurredAt`.
- **Poison events.** A body that can't be parsed/extracted must **not wedge the cursor**. Record it in the ledger as `failed` with an attempt count; after N attempts it's parked (dead-lettered), the cursor moves past it, and a human/alert handles the backlog. One bad event never blocks the pipeline.
- **Back-pressure & cost.** The cost center is extraction + embedding. Controls: a **bounded page size**, **non-overlapping cron** (a run won't start if one is in flight), a **per-run budget** (max events / max model calls), and the fact that batch-pull (§3) lets the extractor/embedder **batch** calls. These are stated as non-functional constraints, not afterthoughts.

---

## 11. `graphId` resolution / multi-tenancy during enrichment

**The gap the domain deferred but this layer cannot.** Every `KnowledgeGraphNode.create` and `KnowledgeGraphEdge.create` requires a `graphId`, yet an event entry carries only `tags` + `body`. *Which graph does an event belong to?* The domain doc **explicitly defers** multi-tenancy/scope (§10) while namespacing everything by `graphId`. The application layer **must** resolve a concrete `graphId` for every event just to call the domain at all — so it resolves the tension the domain left open (this is *completing* the deferred decision, **not** contradicting it).

**Recommendation: a `GraphResolution` policy/port** mapping `event.tags` (e.g. an `org` / `workspace` tag) → `KnowledgeGraphId`, with a **Phase-0 default of a single well-known graph**. Keeping it a port means that when real multi-tenancy/isolation arrives (its own discovery), it's a policy swap — the enrichment use cases don't change. Resolution happens **once per event**, before extraction, and the resolved `graphId` flows into every node/edge created from that event.

---

## 12. Re-embedding & body canonicalization

**`EmbedNodes` triggers** — embedding is not a one-shot at birth:

1. **`NodeCreated`** — a new node has `embedding: null`; embed it.
2. **Body revised** — `reviseBody` changes the canonical text, so the existing embedding is **stale**; re-embed.
3. **Model drift** — a node whose embedding model ≠ the graph's policy model (`KnowledgeGraph.accepts` returns false) must be **re-embedded** to satisfy the graph-wide embedding policy.

**Node body canonicalization is a real decision, not a detail.** The `NodeBody` text drives *both* the embedding *and* the natural key for resolution (§8) — so it silently governs over/under-merge. ("Alice", "alice@corp", "Alice Smith" → one node or three?) **Recommendation: a conservative Phase-0 canonicalization policy** at the extractor/resolution boundary (trim, case-fold, prefer a stable identifier like an email/handle as the key when present; keep a human-readable display body). Make it explicit so fragmentation is a tuning knob, not an accident.

---

## 13. Port & use-case sketches

Names follow `project-structure.md` §9 (`*.use-case.ts` for app service + inbound port, `*.repository.ts` for outbound port interfaces, gateways for external systems). All outbound types are **interfaces**; implementations live in `@repo/knowledge-graph-infra`.

### Inbound (driving) ports

```ts
// enrich-events.use-case.ts
export interface EnrichmentReport {
  pulled: number; processed: number; skipped: number; failed: number;
  nodesUpserted: number; edgesWritten: number; cursor: Checkpoint;
}
export interface EnrichEvents {                       // driving port
  execute(input: { batchSize: number }): Promise<Result<EnrichmentReport>>;
}

// embed-nodes.use-case.ts
export interface EmbedNodes {                         // driving port
  execute(input: { nodeIds?: NodeId[]; limit: number }): Promise<Result<void>>;
}

// merge-duplicate-nodes.use-case.ts
export interface MergeDuplicateNodes {                // driving port
  execute(input: { limit: number }): Promise<Result<void>>;
}
```

### Outbound (driven) ports

```ts
// event-source.reader.ts — anti-corruption read into the ingestion log
export interface EventEntry {                         // KG-owned DTO, NOT ingestion's Event
  id: EventId; occurredAt: Date; tags: Record<string, string>; body: Record<string, unknown>;
}
export interface EventSourceReader {
  readSince(cursor: Checkpoint, limit: number): Promise<EventEntry[]>;  // ORDER BY recordedAt, id
}

// entity-extractor.gateway.ts — opaque body → candidates already typed to the closed vocab
export interface CandidateNode { type: NodeType; body: string; naturalKey?: string; }
export interface CandidateEdge { from: CandidateRef; to: CandidateRef; relationship: RelationshipType; confidence: number; }
export interface ExtractionResult { nodes: CandidateNode[]; edges: CandidateEdge[]; extractorVersion: string; }
export interface EntityExtractorGateway {
  extract(entry: EventEntry): Promise<ExtractionResult>;   // vocabulary enforced in the adapter
}

// embedding.gateway.ts
export interface EmbeddingGateway {
  embed(texts: string[], model: string): Promise<number[][]>;   // batched
}

// knowledge-graph-node.repository.ts
export interface KnowledgeGraphNodeRepository {
  findById(id: NodeId): Promise<KnowledgeGraphNode | null>;
  findByNaturalKey(graphId: KnowledgeGraphId, type: NodeType, key: string): Promise<KnowledgeGraphNode | null>;
  saveMany(nodes: KnowledgeGraphNode[]): Promise<void>;
}

// knowledge-graph-edge.repository.ts
export interface KnowledgeGraphEdgeRepository {
  findByTriple(graphId: KnowledgeGraphId, fromId: NodeId, toId: NodeId, rel: RelationshipType): Promise<KnowledgeGraphEdge | null>;
  saveMany(edges: KnowledgeGraphEdge[]): Promise<void>;
  repointIncidentEdges(from: NodeId, to: NodeId): Promise<void>;   // for merge
}

// node-resolution.index.ts — ANN over node embeddings (may share the pgvector adapter)
export interface NodeMatch { id: NodeId; score: number; }
export interface NodeResolutionIndex {
  findSimilar(graphId: KnowledgeGraphId, type: NodeType, vector: number[], threshold: number, k: number): Promise<NodeMatch[]>;
}

// graph-resolution.policy.ts — §11, the multi-tenancy gap
export interface GraphResolution { resolve(tags: Record<string, string>): KnowledgeGraphId; }

// checkpoint.store.ts — progress
export interface Checkpoint { recordedAt: Date; lastEventId: EventId; }
export interface CheckpointStore {
  load(name: string): Promise<Checkpoint>;
  save(name: string, cursor: Checkpoint): Promise<void>;
}

// processed-event.ledger.ts — exactly-once effect (§9)
export type ProcessStatus = "done" | "failed";
export interface ProcessedEventLedger {
  seen(eventId: EventId, extractorVersion: string): Promise<boolean>;
  record(eventId: EventId, extractorVersion: string, status: ProcessStatus, factHash: string, attempts: number): Promise<void>;
}

// from @repo/kernel / @repo/platform
export interface IdGenerator { nodeId(): NodeId; edgeId(): EdgeId; }
// Clock, EventPublisher (eventBus), UnitOfWork — shared infra
```

### `EnrichEvents` orchestration (the main flow)

```
load cursor (CheckpointStore)
page ← EventSourceReader.readSince(cursor, batchSize)        // ordered by recordedAt
drop entries already in ProcessedEventLedger (current extractorVersion)
sort page by occurredAt                                       // §10 — for correct observedAt
for each entry:
  graphId ← GraphResolution.resolve(entry.tags)              // §11
  result  ← EntityExtractorGateway.extract(entry)
  for each candidate node:
     matches  ← node repo natural-key lookup + NodeResolutionIndex.findSimilar
     decision ← EntityResolution.classify(candidate, matches)   // pure domain service
     New        → KnowledgeGraphNode.create({ id: ids.nodeId(), graphId, …, eventIds:[entry.id], now })
     Resolved   → node.attachEvents([entry.id], now)
     Ambiguous  → create + queue a DUPLICATE_OF for MergeDuplicateNodes
  for each candidate edge:
     load from/to nodes; existing ← edge repo.findByTriple(...)
     edge ← GraphRelation.relate({ …, observedAt: entry.occurredAt, existing, now })  // create or reinforce
in ONE UnitOfWork: node repo.saveMany + edge repo.saveMany + ledger.record(...) + CheckpointStore.save
after commit: EventPublisher.publish(recorded domain events)  // NodeCreated → triggers EmbedNodes
```

---

## 14. Decisions, alternatives, and deferred work

**Decisions taken (with the rejected alternative):**

- **Consume events → cron batch-pull + cursor** (§3), not queue push. Buildable today (no upstream publisher), better batch economics, minimal infra; the inbound port is shaped so a queue adapter can drive the same use case later.
- **Integration → shared-DB read behind an ACL port** (§4), not payload-in-event or a read API. Pragmatic on one Aurora cluster; coupling contained by a KG-owned DTO + a published-language read contract.
- **Pipeline → one `EnrichEvents` use case; `EmbedNodes` and `MergeDuplicateNodes` split out** (§6), not a single fat job and not fully fragmented per-stage jobs. Follows the domain's "embedding is a later phase" signal; isolates expensive/retriable I/O.
- **Extraction → hybrid, vocabulary enforced in the gateway** (§7), not LLM-only and not rules-only. Deterministic where possible, fuzzy where needed; governance stays in the adapter.
- **Resolution → conservative hybrid + deferred merge; decision is a pure domain service** (§8), not synchronous fuzzy merging. Prefers transient fragmentation over irreversible over-merge.
- **Idempotency → deterministic-`eventId`-anchored ledger, separate from the cursor** (§9), not "cursor is enough." Survives non-deterministic extraction; extractor versioning re-processes by design.
- **`graphId` → a resolution policy/port with a Phase-0 single-graph default** (§11). Completes the multi-tenancy decision the domain deferred, behind a swappable port.

**Deferred on purpose:**

- **Real-time queue path** — awaits ingestion's `EventRecorded`/`EventPublisher` seam (§3).
- **Advanced entity resolution** — blocking/clustering, LLM canonicalization, active-learning thresholds; Phase 0 is key + ANN + deferred merge.
- **Full multi-tenancy & isolation** — RLS/scoping enforcement; the policy port reserves the seam.
- **Recall / read path** — `RelationshipGraph` traversal, ranking, GraphRAG (write-side only here).
- **Cost/usage metering & autoscaling** — beyond the bounded-page/budget guards of §10.

---

## 15. Where this lives

Per `project-structure.md` §4/§9, the application layer is `application/` inside the pure `@repo/knowledge-graph` package; adapters are in `@repo/knowledge-graph-infra`; wiring is in `apps/worker`.

```
packages/knowledge-graph/src/
├─ domain/                                  # designed in feature-knowledge-graph.md
│  └─ entity-resolution.domain-service.ts   # NEW pure service (classify) — §8
└─ application/
   ├─ use-cases/
   │  ├─ enrich-events.use-case.ts           # EnrichEvents (inbound port + impl)
   │  ├─ embed-nodes.use-case.ts             # EmbedNodes
   │  └─ merge-duplicate-nodes.use-case.ts   # MergeDuplicateNodes
   └─ ports/outbound/
      ├─ event-source.reader.ts              # EventSourceReader (ACL read)
      ├─ entity-extractor.gateway.ts         # EntityExtractorGateway
      ├─ embedding.gateway.ts                # EmbeddingGateway
      ├─ knowledge-graph-node.repository.ts  # node repo port
      ├─ knowledge-graph-edge.repository.ts  # edge repo port
      ├─ node-resolution.index.ts            # NodeResolutionIndex
      ├─ graph-resolution.policy.ts          # GraphResolution — §11
      ├─ checkpoint.store.ts                 # CheckpointStore
      └─ processed-event.ledger.ts           # ProcessedEventLedger

packages/knowledge-graph-infra/src/          # adapters (NOT built here)
├─ persistence/                              #   *.repository.pg.ts, checkpoint/ledger tables, pgvector resolution index
├─ gateways/                                 #   LLM extractor, embedder
└─ read/                                     #   event-table reader implementing EventSourceReader

apps/worker/src/
├─ jobs/                                      # cron triggers for EnrichEvents / EmbedNodes / MergeDuplicateNodes
└─ composition/                              # DI: wire use cases ← infra adapters
```

`@repo/knowledge-graph` still lists **only** `@repo/kernel` as a dependency — every line above touching I/O is an interface, satisfied by `-infra`. The dependency rule stays mechanically enforced (`project-structure.md` §8).

---

## Closing notes

- This is a **pure application layer over an already-decided domain**: it generates the ids/timestamps the domain refuses to invent, reads the event payloads the domain refuses to dereference, and orchestrates `create`/`attachEvents`/`reinforce`/`relate` — adding no new domain rules.
- It resolves the **one judgment call the domain left open** — `graphId` per event (§11) — behind a swappable policy, and honors the **one hard boundary the domain set** — provenance is `eventIds`, never a `DERIVED_FROM` edge (§7).
- Idempotency is anchored on the deterministic **event id** (ledger), kept distinct from **progress** (cursor), so the pipeline is safe under at-least-once delivery *and* non-deterministic extraction (§9).
- Everything impure — trigger, event source, extractor, embedder, store — is **behind a port**, so the trigger graduation (cron → queue), the integration graduation (shared-DB → published event), and the store graduations of `database-tradeoffs.md` all stay **adapter-local**. The application core never moves.
