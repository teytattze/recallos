# Transactional outbox into SQS for ingest → knowledge-graph event publication

- **Status:** Accepted
- **Date:** 20260524
- **Deciders:** Liam Tat Tze Tey
- **Scope:** The communication seam between the ingestion and knowledge-graph bounded contexts — how a recorded event is published from the `Service` runtime to the `Worker` runtime. Constrains the `EventPublisher` outbound port and its adapter; does not change either context's domain model.

---

## Context

- Two runtimes share one core: the `Service` captures an event and appends it to the append-only `events` table; the `Worker`, in a separate runtime, later enriches it into the knowledge graph. The event must cross asynchronously — the `Service` must return the moment the event is durable and never block on enrichment.
- The core problem is the **dual-write**: appending to Postgres and notifying the `Worker` are two systems with no spanning transaction. A failure between them either **loses** the notification (event stored, `Worker` never told → silently absent from the graph) or creates a **phantom** (`Worker` told of an event whose insert rolled back). Reordering only swaps which side leaks.
- Requirement that falls out: **at-least-once delivery**, with the **`events` table as the single source of truth**, consumed by an **idempotent** `Worker`. Exactly-once is explicitly not pursued — idempotent at-least-once is simpler and sufficient.
- Fixed constraints: deployment is AWS-bound (managed-first); all stores already run on one consolidated Aurora PostgreSQL cluster; small team favours minimal operational surface.

## Decision

> Publish recorded events via a transactional outbox written in the same Postgres transaction as the event insert, with a relay that forwards them to Amazon SQS for the `Worker` to consume.

- The outbox adapter writes one `event_outbox` row in the **same transaction** (shared unit-of-work) as the `events` insert. This makes "the event is recorded" and "the `Worker` will be told" a **single atomic Postgres fact**, closing the dual-write entirely inside the database we already run.
- A **relay** process claims pending rows with `SELECT … FOR UPDATE SKIP LOCKED`, publishes each to **SQS**, and marks them `sent`. The relay is itself at-least-once (crash after publish, before mark-sent → re-publish → consumer dedups).
- Published messages are **thin**: `eventId`, timestamps, and routing `tags` only — **not** the `body`. The `Worker` re-reads the body from the `events` table (the source of truth) when it processes the message, since the body can be large (SQS caps a message at 256 KB) and would go stale if duplicated.
- The `Worker`'s enrich consumer is **idempotent on `eventId`** — cheap here because graph writes already dedup via provenance (re-attaching the same `eventId`, reinforcing an existing edge) — with an **SQS DLQ** for poison messages.
- The whole seam stays behind the `EventPublisher` outbound port, so the broker remains swappable without touching the domain.
- First-principle reasoning: the outbox is the **only** option that makes capture and notification atomic **without standing up CDC infrastructure**; SQS is the **minimal managed broker** for a single `Worker` consumer — managed retries plus DLQ, near-zero ops, pennies at this scale.

## Consequences

- **Positive:** no lost or phantom events; the `Service` returns as soon as the event is durable and never blocks on graph-building; a broker outage loses no data (the relay retries through it); adds exactly **one** managed service (SQS) to the consolidated-Postgres posture; the domain stays adapter-agnostic behind `EventPublisher`.
- **Trade-offs:** we take on an `event_outbox` table, a relay process, and an idempotent consumer to build and operate; events reach the `Worker` only after the relay runs (small lag); at-least-once means **duplicate deliveries** the consumer must dedup; `event_outbox` needs pruning/partitioning so `sent` rows don't bloat the hot path.
- **Follow-ups:** choose **FIFO** (`MessageGroupId = tags.source`) vs **standard + app-side dedup** against expected ingest rate; provision the SQS queue + DLQ (IaC) and the `event_outbox` migration; build the relay job and the enrich consumer; decide outbox retention/partitioning up front; confirm `FOR UPDATE … SKIP LOCKED` behaviour on the target Aurora engine version.

## Alternatives considered

- **In-process direct publish** — use case calls SQS right after `append`; simplest and lowest latency, but leaves the dual-write unsolved (a crash between append and publish loses the event). This is precisely the failure mode the decision exists to avoid.
- **Postgres-as-queue (Worker polls the outbox with `SKIP LOCKED`, no broker)** — leanest possible, zero new infrastructure; loses because it couples `Worker` scaling to the `Service` DB and forces us to reimplement retry/DLQ/visibility ourselves. A legitimate fallback, and swappable behind the same `EventPublisher` port if SQS proves premature.
- **`LISTEN`/`NOTIFY`** — DB-native push, very low latency; loses because a notification fired while no one is listening is gone (at-most-once), so it must be paired with a catch-up poll — degenerating into the Postgres-as-queue option while adding a sticky connection.
- **CDC / logical replication (Debezium)** — no application code, captures every commit exactly as persisted, replayable; loses on operational weight (replication slots, connector, stream) — overkill for a small team. A later graduation if maintaining the outbox + relay ever becomes a burden.
- **Cron batch-pull with a cursor (no publication at all)** — the `Worker` reads new `events` rows directly on a schedule; buildable with no publisher seam and batches model calls naturally, but gives minutes-latency polling instead of the prompt push this decision chooses. Remains viable as a safety-net reconciler behind the same consumer.
- **Richer brokers (SNS→SQS fan-out, Kinesis, MSK)** — fan-out, replay, and high sustained throughput; loses today because there is a single consumer and the `events` table already serves as the replay log (re-enqueue from it). Each maps cleanly behind the same port when a concrete trigger (a second consumer, replay at scale) appears.
