# Knowledge Graph Processing — Event Consumption & Cross-Context Integration

Sub-document of [`feature-knowledge-graph-processing.md`](./feature-knowledge-graph-processing.md). Covers **how enrichment is triggered** and **how it reads events that belong to the ingestion context**. Sibling sub-docs: [extraction](./feature-knowledge-graph-processing-extraction.md), [resolution & embedding](./feature-knowledge-graph-processing-resolution.md), [idempotency & consistency](./feature-knowledge-graph-processing-idempotency.md).

---

## 1. How this context consumes events

Enrichment must be _triggered_ and must _know which events to process_. When this design was first drafted the upstream publisher did not exist, so the only buildable option was a cron batch-pull with a cursor. **That has changed.** Ingestion now publishes recorded events through a transactional outbox into Amazon SQS ([`feature-event-publication.md`](./feature-event-publication.md); ADR [`20260524-outbox-sqs-event-publication`](../../decision-records/server/20260524-outbox-sqs-event-publication.md)), so enrichment is driven entirely off that queue.

**Decision: SQS push is the only trigger.** One recorded event → one thin SQS message `{ eventId, occurredAt, recordedAt, tags }` → `EnrichEvents.execute({ eventIds })`. There is **no cursor/reconcile path**:

- **The message is thin**, so the consumer re-reads the body by id (`EventSourceReader.findByIds`) before extracting (§2).
- **The consumer runs in `apps/server-knowledge-worker`** as a long-poll loop over SQS. Correctness comes from the **resource, not the tick**: SQS visibility-timeout + competing-consumer semantics give one in-flight delivery at a time, and the `ProcessedEventLedger`'s `eventId` idempotency (idempotency sub-doc) absorbs at-least-once redelivery.
- **Poison messages** that fail repeatedly land in the SQS **DLQ** (`feature-event-publication.md` §7) for inspection — they never block the stream.

> **What about completeness without a reconcile poll?** Delivery guarantees rest on SQS at-least-once, the relay's own at-least-once publish (`feature-event-publication.md` §7), and the DLQ. The `events` table remains the source of truth (`feature-event-publication.md` §2), so if a gap is ever discovered, re-enqueuing from it is a manual/operational backfill — not a standing cursor loop. A scheduled reconciler can be added later behind a **new driving adapter over the same `EnrichEvents` core** if evidence demands it; it is deliberately out of scope now.

---

## 2. Cross-context integration (context mapping)

The consumer ultimately needs the event's **`body`** (and `tags`, `occurredAt`) to extract anything — and that data belongs to the **ingestion** bounded context. The SQS message is deliberately **thin** (`feature-event-publication.md` §3: body omitted because it is opaque, can exceed SQS's 256 KB cap, and would go stale), so the body is **re-read** from the source of truth. Three integration styles (DDD context-mapping terms in parentheses):

|                     | Shared-DB read via ACL port _(Shared Database)_                                                                                        | Payload-in-event _(Published Language)_                                                        | Sync read API _(Open-Host / Customer-Supplier)_                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **How**             | A `server-knowledge-infra` adapter `SELECT`s the `events` table directly, behind our `EventSourceReader` port, mapping rows → our DTO. | The message carries the full `{occurredAt, tags, body}`; we consume the payload off the queue. | We call an ingestion HTTP/RPC endpoint to fetch event payloads. |
| **Buildable now**   | **Yes** (one consolidated Aurora cluster — ADR `20260523-consolidated-aurora-postgresql`).                                             | No — the published event is thin by deliberate design (§1, `feature-event-publication.md` §3). | No (no such endpoint; both runtimes already share the DB).      |
| **Coupling**        | **Highest** — two contexts share a table. Mitigated by the ACL (below).                                                                | Low — contexts share only a message contract.                                                  | Low — contexts share only an API contract.                      |
| **Latency / cost**  | One local query per event.                                                                                                             | None extra, but fat messages risk the 256 KB cap and staleness.                                | Network hop + ingestion serving load.                           |
| **Fit for Phase 0** | **Best** — pragmatic on a consolidated DB.                                                                                             | Rejected upstream (thin events).                                                               | Pointless indirection (same DB, two of our own runtimes).       |

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
  findByIds(ids: EventId[]): Promise<EventEntry[]>; // re-read bodies for the ids named in an SQS batch
}
```

`findByIds` maps raw `events` rows to the KG-owned `EventEntry` for the ids named in an SQS message batch. (There is no `readSince`/cursor — the reconcile path was dropped, §1.)

## 4. Inbound (driving) ports

```ts
export interface EnrichmentReport {
  processed: number;
  skipped: number;
  failed: number;
  nodesUpserted: number;
  edgesWritten: number;
}

// enrich-events.use-case.ts — driven by the SQS consumer
export interface EnrichEvents {
  execute(input: { eventIds: EventId[] }): Promise<Result<EnrichmentReport>>;
}
```

`EnrichEvents` is **agnostic to its driver**: the SQS consumer drives it today, but a manual backfill or a test can call it with any set of ids. `EmbedNodes` and `MergeDuplicateNodes` (resolution sub-doc) are separate inbound ports on their own jittered loops.

---

## 5. Enrichment orchestration (shared by both drivers)

`EnrichEvents` runs one routine over the `EventEntry` set named by an SQS batch. Cross-cutting concerns it relies on — the ledger guard, `graphId` resolution, the transaction boundary, ordering by `occurredAt` — are detailed in the [idempotency & consistency sub-doc](./feature-knowledge-graph-processing-idempotency.md); extraction in the [extraction sub-doc](./feature-knowledge-graph-processing-extraction.md); resolution in the [resolution sub-doc](./feature-knowledge-graph-processing-resolution.md).

```
EnrichEvents.execute({ eventIds }):
  entries ← EventSourceReader.findByIds(eventIds)
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
  in ONE UnitOfWork: nodeRepo.saveMany + edgeRepo.saveMany + ledger.record(...)
```

> **Note — the domain factories mint ids.** `KnowledgeGraphNode.create` / `KnowledgeGraphEdge.create` take only `{ …, now }` and mint `NodeId`/`EdgeId` internally (kernel UUID v7). There is no `IdGenerator` port; the app supplies `now` from the `Clock`.

> **Note — node birth is unembedded.** `KnowledgeGraphNode.create` always sets `embedding: null`. Embeddings are assigned later by `EmbedNodes` (resolution sub-doc), so an embedding outage never blocks this routine.
> </content>
