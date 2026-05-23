# RecallOS — Event Publication (Capture → Worker hand-off)

Designs the seam between **capture** and **enrichment**: how an `Event` that has
just been appended to the TimeseriesDB reaches an **intermediary layer** so the
cron/queue-driven `Worker` can later turn it into the knowledge graph. Builds on
[`feature-event-ingestion.md`](./feature-event-ingestion.md) (which records the
`Event` and names this seam in its §7), [`project-structure.md`](./project-structure.md)
§6–§7 (two runtimes over one core; outbound ports → `-infra` adapters), and
[`database-tradeoffs.md`](./database-tradeoffs.md) §1/§6 (consolidated Aurora
Postgres today; the Worker drains the event log). Scope: the **domain seam**
(`EventRecorded` + `EventPublisher` port), the **delivery patterns** that move an
event reliably off the box, and the **intermediary technology** itself. Like its
siblings this is design, not code on disk — adapters are named as seams, not built.

---

## 1. Where this fits in the product

RecallOS is a pipeline; ingestion only owns the first step:

```
capture  →  enrich  →  relate  →  recall
 Service     Worker     Worker     Service
 [done]      (needs the event)     
            ▲
            └── this doc: how the event crosses from Service to Worker
```

`feature-event-ingestion.md` deliberately stops at "append the event to the log."
But the `Worker` lives in a **separate runtime** (`project-structure.md` §6) and
does the expensive work — entity extraction, embeddings, relating nodes. The
Service must hand the event off **without blocking on any of that**, and the
hand-off must not drop facts on the floor.

> **Principle:** publishing **decouples capture from enrichment**. The Service
> returns the moment the event is durably recorded; the Worker is notified
> asynchronously. The **events table is the source of truth** — the intermediary
> carries a *notification that a fact landed*, never the only copy of it.

This is the seam named in `feature-event-ingestion.md` §7: the aggregate raises a
kernel `EventRecorded` `DomainEvent`, the use case publishes it through an
`EventPublisher` outbound port, and that kicks off **enrich → relate**.

> **Naming nuance (carried over from ingestion §2):** the `Event` *aggregate* is a
> captured occurrence; `EventRecorded` is a kernel `DomainEvent` — the
> publish/subscribe building block. The aggregate is *what happened*; the domain
> event is *the announcement that we recorded it*.

---

## 2. The core problem — the dual-write

The naive use case does two writes to two systems:

```ts
await events.append(event);          // (1) Postgres: durable
await publisher.publish(recorded);   // (2) the broker: durable elsewhere
```

There is no transaction spanning both. Two failure modes follow:

- **(1) commits, (2) fails** (process crash, broker timeout) → the event is stored
  but the Worker is **never told**: a **lost** fact, silently absent from the graph.
- **(2) succeeds, (1) rolls back** (later constraint error, retry) → the Worker is
  told about an event that **does not exist**: a **phantom** the Worker can't load.

Reordering does not help — it only swaps which side leaks. The requirement that
falls out of this:

> **Requirement:** **at-least-once** delivery, with the **events table as the
> single source of truth**, consumed by an **idempotent** Worker. We accept
> *duplicate* deliveries (cheap to dedup) and refuse *lost* ones. Exactly-once is
> explicitly **not** pursued (§9).

Every solution in §4 is judged on how it closes this gap.

---

## 3. The domain seam (hexagonal, adapter-agnostic)

What changes in the **pure core** — independent of which broker we pick. The
domain still names no technology (`project-structure.md` §2).

**`EventRecorded`** — a kernel `DomainEvent`, collected on the aggregate when it is
recorded. It is **thin** on purpose (see the note below).

```ts
// packages/ingestion/src/domain/events/event-recorded.event.ts
import { DomainEvent } from "@repo/kernel";
import type { EventId } from "../event-id.value-object";

export class EventRecorded extends DomainEvent {
  constructor(
    readonly eventId: EventId,
    readonly occurredAt: Date,
    readonly recordedAt: Date,
    readonly tags: Record<string, string>, // routing only: source, type, …
  ) {
    super();
  }
}
```

The `Event` aggregate records it inside the existing factory, so capture and
announcement are one indivisible domain step:

```ts
// packages/ingestion/src/domain/event.aggregate.ts  (addition to §2 of ingestion)
static record(props: RecordEventProps, recordedAt: Date): Event {
  // …existing invariant checks…
  const event = new Event(/* …as before… */);
  event.record(new EventRecorded(event.id, event.occurredAt, recordedAt, props.tags));
  return event; // AggregateRoot.record() buffers domain events for the use case to drain
}
```

> **Note — thin event, not fat.** `EventRecorded` carries the `eventId`,
> timestamps, and `tags` (what the Worker **routes** on), but **not** the `body`.
> The body is opaque at capture (ingestion §2), can be large (SQS caps a message at
> **256 KB**, §10), and would go stale if duplicated. The Worker re-reads the body
> from the `EventLogRepository` (the source of truth) when it processes the
> message. Fat events are an option later if a re-read becomes the bottleneck.

**`EventPublisher`** — the new outbound port. It speaks domain events, never a
queue. Lives beside `EventLogRepository` (ingestion §4).

```ts
// packages/ingestion/src/application/ports/outbound/event-publisher.ts
import type { DomainEvent } from "@repo/kernel";

export interface EventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}
```

**`IngestEventUseCase`** — append, then hand the buffered domain events to the
publisher. The use case still has no idea *how* publishing is made reliable; that
is the adapter's job (§4/§6).

```ts
// packages/ingestion/src/application/use-cases/ingest-event.use-case.ts
async execute(input: IngestEventInput): Promise<void> {
  const event = Event.record(input, this.clock.now());
  await this.events.append(event);                 // (1) source of truth
  await this.publisher.publish(event.pullDomainEvents()); // (2) announce
}
```

**Worker side (the consumer).** A *driving* adapter in `apps/worker/src/jobs/`
receives the message and drives a new `EnrichEvent` use case, which loads the full
`Event` from the `EventLogRepository` and builds the graph via the knowledge-graph
context's `CreateNode` / `GraphRelation.relate` (see
[`feature-knowledge-graph.md`](./feature-knowledge-graph.md) §5–§7). The
extraction logic itself is out of scope here (§9).

```
SQS message {eventId, tags} → apps/worker/src/jobs/enrich-event.job.ts
  → EnrichEvent.execute({eventId})        (inbound port, @repo/knowledge-graph)
      → EventLogRepository.findById(eventId)   (re-read the body)
      → CreateNode / GraphRelation.relate      (write nodes + edges)
```

The whole §3 surface is pure or app-level. **Which** publisher implementation gets
wired (§4) is a one-line composition-root decision (`project-structure.md` §5).

---

## 4. Solutions — how a recorded event reliably reaches the Worker

Five ways to satisfy the §2 requirement. These are about **reliability/topology**;
the broker technology is orthogonal and compared in §5.

| Option | Where it runs | Strengths | Trade-offs / risks | Delivery |
|---|---|---|---|---|
| **S1 — In-process direct publish** | use case calls broker right after `append` | Trivial; no extra table or relay; lowest latency | **Dual-write (§2) unsolved** — crash between append and publish loses the event; broker outage fails ingest or drops the notice | ~at-most-once |
| **S2 — Transactional Outbox + relay** *(recommended)* | `event_outbox` row written in the **same tx** as the `events` insert; a separate **relay** publishes it | Atomic with the event (one Postgres tx) → **no lost events**; broker can be down without losing data; relay retries freely | Needs an outbox table, a relay process, and an idempotent consumer; events visible to Worker only after relay runs (small lag) | at-least-once |
| **S3 — Postgres-as-queue** | no broker; Worker polls `event_outbox`/`events` with `SELECT … FOR UPDATE SKIP LOCKED` | **Zero new infrastructure** — leanest possible; same engine, same backup; trivial local dev | Couples Worker scaling to the Service DB; polling adds latency/load; you reimplement retry/DLQ/visibility yourself | at-least-once |
| **S4 — LISTEN/NOTIFY** | `NOTIFY` in the tx; Worker holds a `LISTEN` connection | DB-native push; very low latency; no broker | **At-most-once** — a notification fired while no one listens is **gone**; payload size limited; needs a sticky connection ⇒ **must** be paired with a catch-up poll (degenerates into S3) | at-most-once (alone) |
| **S5 — CDC** (logical replication / Debezium) | stream the `events` table WAL → Kinesis/MSK | **No application change**; captures every commit exactly as persisted; replayable from the log | Heavy ops (replication slots, connector, stream); schema-change handling; biggest moving part for a small team | at-least-once |

> **Why S2.** The outbox is the only option that makes "the event is recorded" and
> "the Worker will be told" a **single atomic fact** without standing up CDC
> infrastructure. It lives entirely inside the Aurora Postgres we already run
> (`database-tradeoffs.md` §6), turns the §2 dual-write into one local transaction,
> and isolates the broker behind a relay that can retry through outages. S1 is the
> thing we are explicitly avoiding; S3 is S2 minus the broker (a fine *fallback*,
> §6); S4 alone is unsafe; S5 is a Phase-2 graduation when app-side publishing
> becomes a burden.

The outbox write is itself an outbound adapter, sharing the unit-of-work with the
event insert (`@repo/platform`, `project-structure.md` §7):

```ts
// packages/ingestion-infra/src/persistence/event-outbox.repository.pg.ts
export class OutboxEventPublisher implements EventPublisher {
  constructor(private readonly db: Db) {} // same tx/UoW as PgEventLogRepository
  async publish(events: DomainEvent[]): Promise<void> {
    // INSERT one row per event into event_outbox(id, payload jsonb, status='pending', created_at)
    // committed in the SAME transaction as the events insert → atomic, no dual-write
  }
}
```

---

## 5. The intermediary itself — broker comparison

Given S2/S3 put a durable, ordered record in Postgres, the broker's job is
**fan-out + back-pressure + retry/DLQ** to the Worker. Bias is AWS-managed first
(`database-tradeoffs.md` preamble), OSS/SaaS noted.

| Option | Hosting | Strengths | Trade-offs / risks | AWS lock-in |
|---|---|---|---|---|
| **Amazon SQS** (standard / FIFO) | AWS-managed | Dead simple; cheap; managed retries + **DLQ**; standard = high throughput, FIFO = ordering + 5-min dedup; perfect single-consumer fit | One logical consumer per queue (fan-out needs SNS); no replay/history; FIFO has throughput limits | Medium |
| **Amazon SNS → SQS fan-out** | AWS-managed | One publish → many independent SQS queues (graph builder, embeddings, audit), each with its own retry/DLQ | Two services to wire; still no long replay; per-message size limits | Medium |
| **Amazon Kinesis Data Streams** | AWS-managed | Ordered per-shard; **replayable** within retention; multiple consumers; high sustained throughput | Shard capacity planning; consumer checkpointing; pricier/heavier than SQS | Medium-High |
| **Amazon MSK (managed Kafka)** | AWS-managed | Durable log + long retention + replay; rich ecosystem; natural CDC sink (S5) | Heaviest ops + cost; overkill at small scale | Medium |
| Redis Streams / **BullMQ** | OSS / self-host / Elasticache | Fits the **Bun/Node** stack; great DX; consumer groups, retries, delayed jobs | You run Redis; persistence/HA is on you; another data plane | None / vendor |
| NATS JetStream | OSS / SaaS | Lightweight, fast, at-least-once with replay | Smaller ecosystem; another system to operate | None / vendor |
| RabbitMQ | OSS / SaaS (MQ) | Mature routing/topologies; flexible | Broker to operate (or Amazon MQ cost); heavier than SQS | None / vendor |

> **Why SQS first.** A single Worker consumer draining recorded events is exactly
> the SQS sweet spot: managed, near-zero ops, built-in retry + DLQ, pennies at our
> scale. We don't yet need replay (the **events table already is the replay log** —
> re-enqueue from it) or multi-consumer fan-out (one consumer today). Those wants
> map cleanly onto SNS, Kinesis, or MSK *later*, behind the same port.

---

## 6. Recommendation for RecallOS today

**Start with an outbox into SQS; graduate by evidence.**

**Phase 0 (now): Transactional Outbox (S2) → Amazon SQS.**
- `OutboxEventPublisher` writes an `event_outbox` row in the **same transaction**
  as the `events` insert (shared `@repo/platform` unit-of-work) — closing the §2
  dual-write entirely inside the Aurora Postgres we already run.
- A **relay** job (`apps/worker/src/jobs/outbox-relay.job.ts`) claims pending rows
  with `SELECT … FOR UPDATE SKIP LOCKED`, publishes each to **SQS** (FIFO with
  `MessageGroupId = tags.source` if per-source ordering matters, else standard),
  and marks them `sent`.
- The Worker's `enrich-event` consumer is **idempotent on `eventId`**, with an
  **SQS DLQ** for poison messages (§7).
- This adds exactly **one** managed service (SQS) to the consolidated-Postgres
  posture and keeps every storage decision from `database-tradeoffs.md` intact.

> **Leanest fallback (S3).** If even SQS feels premature, skip the broker: have the
> Worker poll `event_outbox` directly with `SKIP LOCKED`. Zero new infra. We
> *recommend SQS over this* because it decouples Worker scaling from the Service DB
> and gives retry + DLQ for free — but S3 is a legitimate day-one shortcut, and
> because the seam is the `EventPublisher` port, moving S3 → SQS is an adapter swap.

**Phase 1+ (graduate the hand-off, each behind a concrete trigger):**
- **SNS → SQS fan-out** — *trigger:* a **second independent consumer** appears
  (e.g. embeddings pipeline separate from graph building, or an audit sink).
- **Kinesis / MSK** — *trigger:* need to **replay/reprocess** historical events
  through new enrichment logic at scale, or sustained throughput where SQS+relay
  lag hurts.
- **CDC (S5)** — *trigger:* maintaining the outbox + relay becomes a burden and we
  want publishing to fall out of the WAL with no app code.

Because the contract is the `EventPublisher` port (and a thin `EventConsumer` on
the Worker), each graduation is **one new class in `-infra` + one line in a
composition root** (`project-structure.md` §5/§7) — the domain never moves.

---

## 7. Delivery semantics & failure handling

- **At-least-once + idempotent consumer.** Dedup on `eventId`. This is cheap here
  because graph writes are **already idempotent via provenance**: re-processing an
  event re-attaches the same `eventId` (`KnowledgeGraphNode.attachEvents`) or
  reinforces an existing edge (`KnowledgeGraphEdge.reinforce`) rather than
  duplicating — see `feature-knowledge-graph.md` §5–§6. A processed-events table or
  the SQS dedup window backstops the rest.
- **DLQ.** Messages that fail repeatedly (un-loadable event, extractor bug) move to
  a dead-letter queue for inspection instead of blocking the stream.
- **Ordering.** Two acceptable stances: (a) **FIFO** with
  `MessageGroupId = tags.source` for per-source order; or (b) **unordered** — every
  event carries `occurredAt`, and the graph reconciles by event time
  (`KnowledgeGraphEdge.observedAt`), so global broker order isn't required. Prefer
  (b) unless a source demands strict sequencing.
- **Relay & outbox hygiene.** The relay is at-least-once (crash after publish,
  before mark-sent → re-publish → consumer dedups). Prune/partition `event_outbox`
  on `sent` rows so it doesn't grow unbounded.

---

## 8. File placement

Following the suffixes (`project-structure.md` §9) and layout (§4). The pure core
gains only interfaces + a domain event; all technology lives in `-infra`, the apps,
or `@repo/platform`.

| Artifact | Path | Layer |
|---|---|---|
| `EventRecorded` domain event | `packages/ingestion/src/domain/events/event-recorded.event.ts` | domain (pure) |
| `EventPublisher` outbound port | `packages/ingestion/src/application/ports/outbound/event-publisher.ts` | application (pure) |
| `IngestEventUseCase` (publish after append) | `packages/ingestion/src/application/use-cases/ingest-event.use-case.ts` | application (pure) |
| `OutboxEventPublisher` (writes outbox in UoW tx) | `packages/ingestion-infra/src/persistence/event-outbox.repository.pg.ts` | `-infra` adapter |
| `event_outbox` table DDL | ingestion-infra migration | `-infra` |
| SQS publisher (used by the relay) | `packages/ingestion-infra/src/gateways/sqs-event-publisher.ts` | `-infra` adapter |
| Outbox relay (poll → SQS → mark sent) | `apps/worker/src/jobs/outbox-relay.job.ts` | worker (driving) |
| Enrich consumer (SQS → use case) | `apps/worker/src/jobs/enrich-event.job.ts` | worker (driving) |
| `EnrichEvent` use case + inbound port | `packages/knowledge-graph/src/application/use-cases/enrich-event.use-case.ts` | application (pure) |
| Unit-of-work, SQS client config | `packages/platform/src/` | platform |

---

## 9. Out of scope / next steps

Named so the seams are visible, but **not** designed here:

- **SQS / outbox infrastructure** — queue + DLQ provisioning (IaC), relay
  scheduling/deployment, `event_outbox` migration.
- **`EnrichEvent` extraction logic** — turning a `body` into nodes/edges (entity
  extraction, embedding calls). Its own enrichment discovery; this doc only
  delivers the *event* to it.
- **Exactly-once** — intentionally not pursued; idempotent at-least-once is simpler
  and sufficient (§2/§7).
- **Published-event contract & versioning** — the on-the-wire schema of
  `EventRecorded` and how it evolves once external/independent consumers exist.
- **Multi-tenant routing** — carrying/segmenting by `graphId` once knowledge graphs
  are per-tenant.

---

## Verify-before-build

- **SQS limits:** max message size **256 KB** (reinforces thin events, §3); **FIFO**
  has per-group throughput limits and a **5-minute dedup window** — confirm against
  expected ingest rate before choosing FIFO over standard + app-side dedup.
- **`SELECT … FOR UPDATE SKIP LOCKED`** is the right primitive for both the relay
  and the S3 fallback; confirm behavior/locking on the target Postgres version.
- **CDC later:** Aurora PostgreSQL logical replication / `wal_level` and Debezium
  connector support shift by engine version — verify before committing to S5.
- **Outbox growth:** decide retention/partitioning for `event_outbox` up front so
  `sent` rows don't bloat the hot path.

## Sources

- [Amazon SQS — message size & quotas](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html)
- [Amazon SQS — FIFO queues (ordering & dedup)](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues.html)
- [Amazon SQS — dead-letter queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html)
- [Fanout to Amazon SQS queues (SNS)](https://docs.aws.amazon.com/sns/latest/dg/sns-sqs-as-subscriber.html)
- [Amazon Kinesis Data Streams — concepts](https://docs.aws.amazon.com/streams/latest/dev/key-concepts.html)
- [Amazon MSK — what is it](https://docs.aws.amazon.com/msk/latest/developerguide/what-is-msk.html)
- [Transactional outbox pattern (microservices.io)](https://microservices.io/patterns/data/transactional-outbox.html)
- [PostgreSQL — `SELECT … FOR UPDATE … SKIP LOCKED`](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [PostgreSQL — `LISTEN` / `NOTIFY`](https://www.postgresql.org/docs/current/sql-notify.html)

---

## Closing notes

- **What this feature is:** the asynchronous hand-off from capture to enrichment —
  an `EventRecorded` domain event, an `EventPublisher` outbound port, and a
  transactional outbox that publishes to SQS so the Worker is reliably notified
  without the Service ever blocking on graph-building.
- **Why the outbox:** it is the only Phase-0 option that closes the dual-write
  (lost/phantom events) inside the Postgres we already run, while keeping the broker
  swappable behind a port.
- **Why it stays adapter-local:** the events table is the source of truth and the
  hand-off is a port, so "SQS today, SNS/Kinesis/MSK/CDC later" is an `-infra`
  change — the domain never moves (`project-structure.md` §7).
- **This doc is design, not code on disk** — like its siblings in `discoveries/`,
  it is the contract the ingestion/worker packages should converge toward.
