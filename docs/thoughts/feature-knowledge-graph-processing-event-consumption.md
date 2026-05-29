# Knowledge Graph Processing — Event Consumption & Cross-Context Integration

Sub-document of [`feature-knowledge-graph-processing.md`](./feature-knowledge-graph-processing.md). Covers **how enrichment is triggered** and **how it reads events that belong to the ingestion context**. Sibling sub-docs: [extraction](./feature-knowledge-graph-processing-extraction.md), [resolution & embedding](./feature-knowledge-graph-processing-resolution.md), [idempotency & consistency](./feature-knowledge-graph-processing-idempotency.md).

---

## 1. How this context consumes events

Enrichment must be _triggered_ and must _know which events are new_. When this design was first drafted, the upstream publisher did not exist, so the only buildable option was a cron batch-pull with a cursor. **That has changed.** Ingestion now publishes recorded events through a transactional outbox into Amazon SQS ([`feature-event-publication.md`](./feature-event-publication.md); ADR [`20260524-outbox-sqs-event-publication`](../../decision-records/server/20260524-outbox-sqs-event-publication.md)), and the worker trigger model is settled (ADR [`20260529-in-process-sleep-jitter-worker-trigger`](../../decision-records/server/20260529-in-process-sleep-jitter-worker-trigger.md)).

So the two shapes that were once "buildable today vs blocked on a future seam" are now **both available**, and we use them together:

|                             | SQS push (hot path)                                                                 | Cursor reconcile (safety net)                                                       |
| --------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **What drives it**          | A thin SQS message `{ eventId, occurredAt, recordedAt, tags }` per recorded event. | A jittered catch-up loop reading `WHERE recordedAt > cursor ORDER BY recordedAt, id`. |
| **Latency**                 | Seconds (relay cadence + push).                                                     | Minutes (reconcile interval).                                                       |
| **Body**                    | Re-read locally by `eventId` (the message is thin — §2).                            | Read in the page query.                                                             |
| **Role**                    | Primary — most events flow through here.                                            | Backstop — catches anything SQS dropped, a relay gap, or a poison-message replay.  |
| **Idempotency**             | `ProcessedEventLedger` (idempotency sub-doc).                                       | Same ledger — a reconciled event already pushed is a no-op.                         |

**Decision: SQS push as the hot path, cursor reconcile as the safety net — both driving the same use-case core.** This is exactly the graduation the first draft anticipated ("when ingestion grows the publisher seam, a queue-driving adapter becomes a new driving adapter over the same use case; the cursor degrades to a safety-net reconciler"). It is now realized rather than deferred:

- **Triggering is a sleep + jitter loop, not cron** (ADR `20260529`). The enricher (`apps/server-knowledge-worker`) is a long-running container that polls SQS on a short jittered interval and runs the reconcile pull on a longer one. Correctness comes from the **resource**, not the tick: SQS visibility-timeout + competing-consumer semantics for the push path, `SELECT … FOR UPDATE SKIP LOCKED` (or an advisory lock) over the page for the reconcile path, and the ledger's `eventId` idempotency covering at-least-once redelivery on both.
- **The inbound ports are agnostic to _who_ calls them** (§4). The SQS consumer maps a message batch to `EnrichEvents.execute({ eventIds })`; the reconcile loop calls `ReconcileEnrichment.execute({ batchSize })`. Both funnel into one internal enrichment routine (§5).

> **Why keep the cursor at all now that push exists?** SQS is at-least-once but not at-_least_-once-_forever_: a message can be dropped past its DLQ, a relay can fall behind, a deploy can race. The `events` table is the source of truth (`feature-event-publication.md` §2), and a cheap periodic `WHERE recordedAt > cursor` sweep guarantees **eventual completeness** independent of broker health. It is the same reconciler the ADR calls "a scheduled catch-up/reconcile poll [that] backs it up."

---

## 2. Cross-context integration (context mapping)

Both drivers ultimately need the event's **`body`** (and `tags`, `occurredAt`) to extract anything — and that data belongs to the **ingestion** bounded context. The SQS message is deliberately **thin** (`feature-event-publication.md` §3: body omitted because it is opaque, can exceed SQS's 256 KB cap, and would go stale), so the body is **re-read** from the source of truth. Three integration styles (DDD context-mapping terms in parentheses):

|                     | Shared-DB read via ACL port _(Shared Database)_                                                                              | Payload-in-event _(Published Language)_                                          | Sync read API _(Open-Host / Customer-Supplier)_                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **How**             | A `server-knowledge-infra` adapter `SELECT`s the `events` table directly, behind our `EventSourceReader` port, mapping rows → our DTO. | The message carries the full `{occurredAt, tags, body}`; we consume the payload off the queue. | We call an ingestion HTTP/RPC endpoint to fetch event payloads. |
| **Buildable now**   | **Yes** (one consolidated Aurora cluster — ADR `20260523-consolidated-aurora-postgresql`).                                  | No — the published event is thin by deliberate design (§1, `feature-event-publication.md` §3). | No (no such endpoint; both runtimes already share the DB).      |
| **Coupling**        | **Highest** — two contexts share a table. Mitigated by the ACL (below).                                                     | Low — contexts share only a message contract.                                   | Low — contexts share only an API contract.                     |
| **Latency / cost**  | One local query per event/page.                                                                                             | None extra, but fat messages risk the 256 KB cap and staleness.                 | Network hop + ingestion serving load.                          |
| **Fit for Phase 0** | **Best** — pragmatic on a consolidated DB.                                                                                  | Rejected upstream (thin events).                                                | Pointless indirection (same DB, two of our own runtimes).      |

**Decision: shared-DB read behind an anti-corruption `EventSourceReader` port.** Name the coupling honestly — it _is_ the most-coupled option — and contain it:

1. The adapter returns a **knowledge-owned DTO** (`EventEntry`, §3), **never** the ingestion `Event` aggregate. `@repo/server-knowledge` does not depend on `@repo/server-ingestion`.
2. Treat the columns we read — `{ id, occurredAt, tags, body }` — as a **published-language read contract**. As long as ingestion preserves those, our adapter is stable.

Because the contract is the port, graduating to payload-in-event (if fat events ever become worthwhile) or to a read API is a **new adapter for the same port** — zero app-layer change. This is the "keep it behind an interface, graduate by evidence" discipline of `database-tradeoffs.md` and `project-structure.md`.

---

## 3. Outbound ports

```ts
// event-source.reader.ts — anti-corruption read into the ingestion log
export interface EventEntry {
  // KG-owned DTO, NOT ingestion's Event aggregate
  id: EventId;
  occurredAt: Date;
  tags: Record<string, string>;
  body: Record<string, unknown>;
}
export interface EventSourceReader {
  findByIds(ids: EventId[]): Promise<EventEntry[]>; // SQS push: re-read bodies for a message batch
  readSince(cursor: Checkpoint, limit: number): Promise<EventEntry[]>; // reconcile: ORDER BY recordedAt, id
}

// checkpoint.store.ts — progress (the reconcile cursor)
export interface Checkpoint {
  recordedAt: Date;
  lastEventId: EventId;
}
export interface CheckpointStore {
  load(name: string): Promise<Checkpoint>;
  save(name: string, cursor: Checkpoint): Promise<void>;
}
```

`findByIds` serves the push path (re-read bodies for the ids named in an SQS batch); `readSince` serves the reconcile path. Both map raw `events` rows to the KG-owned `EventEntry`.

## 4. Inbound (driving) ports

```ts
export interface EnrichmentReport {
  pulled: number;
  processed: number;
  skipped: number;
  failed: number;
  nodesUpserted: number;
  edgesWritten: number;
}

// enrich-events.use-case.ts — driven by the SQS consumer (hot path)
export interface EnrichEvents {
  execute(input: { eventIds: EventId[] }): Promise<Result<EnrichmentReport>>;
}

// reconcile-enrichment.use-case.ts — driven by the jittered catch-up loop (safety net)
export interface ReconcileEnrichment {
  execute(input: { batchSize: number }): Promise<Result<EnrichmentReport & { cursor: Checkpoint }>>;
}
```

Both are **agnostic to their driver**: a queue consumer, a cron, a manual backfill, or a test can call either. `EmbedNodes` and `MergeDuplicateNodes` (resolution sub-doc) are separate inbound ports on their own jittered loops.

---

## 5. Enrichment orchestration (shared by both drivers)

Both use cases funnel into one internal routine over a set of `EventEntry`. Cross-cutting concerns it relies on — the ledger guard, `graphId` resolution, the transaction boundary, ordering by `occurredAt` — are detailed in the [idempotency & consistency sub-doc](./feature-knowledge-graph-processing-idempotency.md); extraction in the [extraction sub-doc](./feature-knowledge-graph-processing-extraction.md); resolution in the [resolution sub-doc](./feature-knowledge-graph-processing-resolution.md).

```
EnrichEvents.execute({ eventIds }):
  entries ← EventSourceReader.findByIds(eventIds)
  enrichEntries(entries)

ReconcileEnrichment.execute({ batchSize }):
  cursor  ← CheckpointStore.load(name)
  entries ← EventSourceReader.readSince(cursor, batchSize)   // ORDER BY recordedAt, id
  enrichEntries(entries, advanceCursorTo: last(entries))

enrichEntries(entries, advanceCursorTo?):
  drop entries already in ProcessedEventLedger (current extractorVersion)
  sort entries by occurredAt                                  // for correct edge.observedAt
  for each entry:
    graphId    ← GraphResolution.resolve(entry.tags)
    extraction ← EntityExtractorGateway.extract(entry)
    for each candidate node:
       matches  ← nodeRepo.findByNaturalKey(...) + NodeResolutionIndex.findSimilar(...)
       decision ← EntityResolution.classify(candidate, matches)     // pure domain service
       New        → KnowledgeGraphNode.create({ graphId, type, body, eventIds:[entry.id], now })
       Resolved   → node.attachEvents([entry.id], now)
       Ambiguous  → create + queue a DUPLICATE_OF for MergeDuplicateNodes
    for each candidate edge:
       load from/to nodes; existing ← edgeRepo.findByTriple(...)
       edge ← GraphRelation.relate({ …, observedAt: entry.occurredAt, existing, now })   // create or reinforce
  in ONE UnitOfWork: nodeRepo.saveMany + edgeRepo.saveMany + ledger.record(...) + (if advanceCursorTo) CheckpointStore.save
```

> **Note — the domain factories mint ids.** `KnowledgeGraphNode.create` / `KnowledgeGraphEdge.create` take only `{ …, now }` and mint `NodeId`/`EdgeId` internally (kernel UUID v7). There is no `IdGenerator` port; the app supplies `now` from the `Clock`.

> **Note — node birth is unembedded.** `KnowledgeGraphNode.create` always sets `embedding: null`. Embeddings are assigned later by `EmbedNodes` (resolution sub-doc), so an embedding outage never blocks this routine.
</content>
