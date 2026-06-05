# Knowledge Graph Processing — Event Consumption & Cross-Context Integration

Sub-document of [`feature-knowledge-graph-processing.md`](./feature-knowledge-graph-processing.md). Covers **how enrichment is triggered** and **how it reads events that belong to the ingestion context**. Sibling sub-docs: [extraction](./feature-knowledge-graph-processing-extraction.md), [resolution & embedding](./feature-knowledge-graph-processing-resolution.md), [idempotency & consistency](./feature-knowledge-graph-processing-idempotency.md).

---

## 1. How this context consumes events

Enrichment must be _triggered_ and must _know which events to process_. When this design was first drafted the upstream publisher did not exist, so the only buildable option was a cron batch-pull with a cursor. **That has changed.** Ingestion now publishes recorded events through a transactional outbox into Amazon SQS ([`feature-event-publication.md`](./feature-event-publication.md); ADR [`20260524-outbox-sqs-event-publication`](../../decision-records/server/20260524-outbox-sqs-event-publication.md)), so enrichment is driven entirely off that queue.

**Decision: SQS push is the only trigger.** One recorded event → one SQS message `{ eventId, occurredAt, recordedAt, tags, body }` → `EnrichEvents.execute({ entries })`. There is **no cursor/reconcile path**:

- **The message carries the extraction payload**, so the hot path does not re-read the event body before extracting (§2).
- **The consumer runs in `apps/server-knowledge-worker`** as a long-poll loop over SQS. Correctness comes from the **resource, not the tick**: SQS visibility-timeout + competing-consumer semantics give one in-flight delivery at a time, and the `ProcessedEventLedger`'s `eventId` idempotency (idempotency sub-doc) absorbs at-least-once redelivery.
- **Poison messages** that fail repeatedly land in the SQS **DLQ** (`feature-event-publication.md` §7) for inspection — they never block the stream.

> **What about completeness without a reconcile poll?** Delivery guarantees rest on SQS at-least-once, the relay's own at-least-once publish (`feature-event-publication.md` §7), and the DLQ. The `events` table remains the source of truth (`feature-event-publication.md` §2), so if a gap is ever discovered, re-enqueuing from it is a manual/operational backfill — not a standing cursor loop. A scheduled reconciler can be added later behind a **new driving adapter over the same `EnrichEvents` core** if evidence demands it; it is deliberately out of scope now.

---

## 2. Cross-context integration (context mapping)

The consumer ultimately needs the event's **`body`** (and `tags`, `occurredAt`) to extract anything — and that data belongs to the **ingestion** bounded context. The SQS message now carries a knowledge-owned event-entry payload. The canonical source remains the immutable `events` row; the relay joins that row when publishing and ingest rejects payloads whose serialized SQS message would exceed 256 KiB. Three integration styles (DDD context-mapping terms in parentheses):

|                     | Payload-in-event _(Published Language)_                                                                 | Shared-DB read via ACL port _(Shared Database)_                                                                                   | Sync read API _(Open-Host / Customer-Supplier)_                 |
| ------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **How**             | The message carries `{ eventId, occurredAt, recordedAt, tags, body }`; the worker consumes it directly. | A `server-knowledge-infra` adapter `SELECT`s the `events` table directly, behind an `EventSourceReader` port, mapping rows → DTO. | We call an ingestion HTTP/RPC endpoint to fetch event payloads. |
| **Buildable now**   | **Yes** — the relay already claims outbox rows and can join immutable `events` by id before publishing. | Yes (one consolidated Aurora cluster — ADR `20260523-consolidated-aurora-postgresql`).                                            | No (no such endpoint; both runtimes already share the DB).      |
| **Coupling**        | Low — contexts share a message contract.                                                                | Highest — two contexts share a table. Mitigated by an ACL if needed for replay/backfill.                                          | Low — contexts share only an API contract.                      |
| **Latency / cost**  | No consumer-side query; message size is bounded by ingest validation.                                   | One local query per event.                                                                                                        | Network hop + ingestion serving load.                           |
| **Fit for Phase 0** | **Best** — direct hot path with explicit SQS size guard.                                                | Useful as a future replay/backfill adapter, but unnecessary on the hot path.                                                      | Pointless indirection (same DB, two of our own runtimes).       |

**Decision: payload-in-event for the hot path.** The SQS message is the published language consumed by `server-knowledge-worker`. The relay reads the canonical `events.body` at publish time, while the outbox table stays metadata-only.

1. The worker receives a **knowledge-owned DTO** (`EventEntry`, §3), **never** the ingestion `Event` aggregate. `@repo/server-knowledge` does not depend on `@repo/server-ingestion`.
2. Treat the SQS payload — `{ eventId, occurredAt, recordedAt, tags, body }` — as the **published-language contract**. Ingest enforces the SQS size limit up front.
3. The `events` table remains the canonical replay/backfill source. If a backfill path is needed, add an `EventSourceReader` adapter over the same DTO rather than changing the hot-path use case.

Because the contract is the DTO, graduating replay/backfill from shared-DB reads to a read API is a **new adapter** — zero domain change. This is the "keep it behind an interface, graduate by evidence" discipline of `database-tradeoffs.md` and `project-structure.md`.

---

## 3. Outbound ports

```ts
export interface EventEntry {
  // KG-owned DTO, NOT ingestion's Event aggregate
  id: EventId;
  occurredAt: Date;
  recordedAt: Date;
  tags: Record<string, string>;
  body: Record<string, unknown>;
}
```

The SQS consumer maps message JSON into `EventEntry`. A future replay/backfill adapter may read raw `events` rows into the same DTO. (There is no `readSince`/cursor — the reconcile path was dropped, §1.)

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
  execute(input: { entries: EventEntry[] }): Promise<Result<EnrichmentReport>>;
}
```

`EnrichEvents` is **agnostic to its driver**: the SQS consumer drives it today, but a manual backfill or a test can call it with any event-entry set. `EmbedNodes` and `MergeDuplicateNodes` (resolution sub-doc) are separate inbound ports on their own jittered loops.

---

## 5. Enrichment orchestration (shared by both drivers)

`EnrichEvents` runs one routine over the `EventEntry` set named by an SQS batch. Cross-cutting concerns it relies on — the ledger guard, `graphId` resolution, the transaction boundary, ordering by `occurredAt` — are detailed in the [idempotency & consistency sub-doc](./feature-knowledge-graph-processing-idempotency.md); extraction in the [extraction sub-doc](./feature-knowledge-graph-processing-extraction.md); resolution in the [resolution sub-doc](./feature-knowledge-graph-processing-resolution.md).

```
EnrichEvents.execute({ entries }):
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
