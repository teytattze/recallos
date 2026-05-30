# Knowledge Graph Processing — Idempotency, Consistency & Multi-Tenancy

Sub-document of [`feature-knowledge-graph-processing.md`](./feature-knowledge-graph-processing.md). Covers at-least-once safety, the transaction boundary, failure handling, and resolving a `graphId` per event. Sibling sub-docs: [event consumption](./feature-knowledge-graph-processing-event-consumption.md), [extraction](./feature-knowledge-graph-processing-extraction.md), [resolution & embedding](./feature-knowledge-graph-processing-resolution.md).

---

## 1. Idempotency & delivery semantics

Processing is **at-least-once** by design (`feature-event-publication.md` §2; ADR [`20260524`](../../decision-records/server/20260524-outbox-sqs-event-publication.md)): the relay re-publishes after a crash and SQS redelivers, so the same event can reach `EnrichEvents` more than once. Therefore **writes must be idempotent**.

The domain _gives_ us idempotent writes — **but only if resolution is stable**:

- Re-asserting an edge triple `(from, to, relationship)` **reinforces** instead of duplicating.
- `attachEvents` unions provenance — re-adding an `eventId` is a no-op.

The threat: **LLM extraction is non-deterministic** (extraction sub-doc §1), so the _same_ event reprocessed can yield slightly different candidates, which could resolve to _different_ nodes and break that stability.

**Decision: anchor idempotency on the deterministic `eventId`, not on extractor output, via a processed-events ledger:**

| Mechanism                   | Question it answers                          | Key                                                        | Why it works                                                                       |
| --------------------------- | -------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Processed-events ledger** | "Was this event's _effect_ already applied?" | `(eventId, extractorVersion) → status, factHash, attempts` | **Exactly-once effect.** Skip an already-processed event regardless of LLM jitter or how many times SQS delivers it. |

Layered guards beneath the ledger: **deterministic candidate keys** (normalized name+type — resolution sub-doc §1/§3) so even a re-extraction resolves to the _same_ node; and **`factHash`** of `(eventId, normalized-fact)` to skip re-asserting a fact already recorded (avoids confidence churn).

**Extractor versioning is a feature, not a bug.** Bumping `extractorVersion` (returned by the gateway — extraction sub-doc §3) makes the ledger _miss_, so events are legitimately reprocessed under the better extractor — provenance grows, edges reinforce, nothing duplicates. That is exactly the desired "the graph improves as the extractor improves" behavior.

---

## 2. Cross-cutting consistency & failure

- **Transaction boundary.** Per Approach A of the domain, node and edge are separate aggregates. A run wraps its writes — **nodes + edges + ledger rows** — in a **context-owned unit-of-work** (§4), so an SQS batch commits atomically while we are still on one Aurora Postgres (ADR [`20260523-consolidated-aurora-postgresql`](../../decision-records/server/20260523-consolidated-aurora-postgresql.md)). When the graph store later splits out (e.g. Neptune), this degrades to _accepted eventual consistency_ (domain §8) — the "no dangling edge / no duplicate edge" guarantees are also backed by a DB FK + unique constraint, so a race can't corrupt the store.
- **Ordering — relate by `occurredAt`.** An edge's **`observedAt` must be the source event's `occurredAt`** (the built `KnowledgeGraphEdge` stores `observedAt`), and `reinforce` keeps the _latest_ `observedAt`. SQS delivers unordered (`feature-event-publication.md` §7) and events can arrive late, so delivery order ≠ `occurredAt` order. So: **sort each SQS batch by `occurredAt` before the relate step**. Mapping is explicit: `edge.observedAt = entry.occurredAt`.
- **Poison events.** A body that can't be parsed/extracted must **not wedge the stream**. Record it in the ledger as `failed` with an attempt count; after N attempts the SQS message is parked in the **DLQ** (`feature-event-publication.md` §7) and a human/alert handles the backlog. One bad event never blocks the pipeline.
- **Back-pressure & cost.** The cost center is extraction + embedding. Controls: a **bounded SQS batch size** (and consumer concurrency), the SQS **visibility timeout sized above worst-case LLM+embedding latency** (ADR `20260529` follow-up), a **per-run budget** (max events / max model calls), and batching extractor/embedder calls across a message batch. Embedding is off the hot path (resolution sub-doc), so its rate limits don't back-pressure enrichment. These are non-functional constraints, not afterthoughts.

---

## 3. `graphId` resolution / multi-tenancy during enrichment

**The gap the domain deferred but this layer cannot.** Every `KnowledgeGraphNode.create` and `KnowledgeGraphEdge.create` requires a `graphId` (confirmed in the built aggregates), yet an event entry carries only `tags` + `body`. _Which graph does an event belong to?_ The domain doc **explicitly defers** multi-tenancy/scope (§10) while namespacing everything by `graphId`. The application layer **must** resolve a concrete `graphId` for every event just to call the domain at all — so it _completes_ the deferred decision (not contradicts it).

**Decision: a `GraphResolution` policy/port** mapping `event.tags` (e.g. an `org` / `workspace` tag) → `KnowledgeGraphId`, with a **Phase-0 default of a single well-known graph**. Keeping it a port means that when real multi-tenancy/isolation arrives (its own discovery), it's a policy swap — the enrichment use cases don't change. Resolution happens **once per event**, before extraction, and the resolved `graphId` flows into every node/edge created from that event.

---

## 4. Outbound ports

```ts
// processed-event.ledger.ts — exactly-once effect (§1)
export type ProcessStatus = "done" | "failed";
export interface ProcessedEventLedger {
  seen(eventId: EventId, extractorVersion: string): Promise<boolean>;
  record(
    eventId: EventId,
    extractorVersion: string,
    status: ProcessStatus,
    factHash: string,
    attempts: number,
  ): Promise<void>;
}

// graph-resolution.policy.ts — §3, the multi-tenancy gap
export interface GraphResolution {
  resolve(tags: Record<string, string>): KnowledgeGraphId;
}

// unit-of-work.ts — context-owned, mirroring @repo/server-ingestion's UnitOfWork
export interface KnowledgeContext {
  nodes: KnowledgeGraphNodeRepository; // resolution sub-doc §4
  edges: KnowledgeGraphEdgeRepository; // resolution sub-doc §4
  ledger: ProcessedEventLedger;
}
export interface UnitOfWork {
  // commit when `work` resolves, roll back if it throws
  transaction<T>(work: (ctx: KnowledgeContext) => Promise<T>): Promise<T>;
}
```

> **Unit-of-work is a context-owned outbound port, not a platform import.** The ingestion context already establishes this pattern — `@repo/server-ingestion`'s `UnitOfWork` exposes an `IngestionContext { events, publisher }` and runs `transaction(ctx => …)`, implemented by `UnitOfWorkPg` in `-infra`. The KG layer mirrors it with a `KnowledgeContext`. (`@repo/server-platform` is documented as eventually owning a shared UoW primitive — "to come" — but today each context declares its own port and `-infra` adapter.)

The enrichment routine (event consumption sub-doc §5) enlists these in one `transaction`: `ctx.nodes.saveMany(...)` + `ctx.edges.saveMany(...)` + `ctx.ledger.record(...)`. Atomicity here is what makes at-least-once redelivery safe — a crash before commit leaves no partial graph and no ledger row, so the event is cleanly reprocessed on the next SQS delivery.
</content>
