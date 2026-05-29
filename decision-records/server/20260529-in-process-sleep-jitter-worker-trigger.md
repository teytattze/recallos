# In-process sleep + jitter loop for worker triggering

- **Status:** Accepted
- **Date:** 20260529
- **Deciders:** Liam Tat Tze Tey
- **Scope:** How the two worker runtimes — `server-outbox-worker` (the outbox relay) and `server-knowledge-worker` (the enricher) — schedule their periodic work. Constrains the driving (scheduling) adapter in each worker app only; does not touch either bounded context's domain.

---

## Context

- The architecture has a `Cron → Trigger → Worker` seam. Two separate worker runtimes need periodic work driven: the **relay** drains `event_outbox` rows to SQS, and the **enricher** processes the event log into the knowledge graph (SQS push is the hot path; a scheduled catch-up/reconcile poll backs it up).
- Deployment is **container images on AWS** (Bun images → ECR); the workers are **long-running containers**, not Lambdas. Fixed constraints: small team, managed-first, single consolidated Aurora cluster.
- A worker may run as **N replicas**. The risk this decision addresses: a trigger firing on every replica at the same instant causes (a) **double-read** of the same work — the same outbox rows or the same event-log page — and (b) a **thundering herd** of synchronized queries hitting one Aurora cluster.
- Already committed in [outbox → SQS](./20260524-outbox-sqs-event-publication.md): **at-least-once** delivery with an **idempotent** consumer (idempotent on `eventId`). That invariant — not the trigger — is what makes duplicate processing safe.

## Decision

> Each worker schedules its own work with a **simple in-process loop that sleeps between runs**, and offsets each instance's tick by a **randomized jitter delay** so replicas don't fire in lockstep; resource-level coordination remains the correctness boundary.

- A self-scheduling loop lives inside each worker container — no external scheduler, no cron library, just `do work → sleep(interval + jitter) → repeat`. The relay drains on a short interval; the enricher runs its catch-up batch-pull on a longer interval.
- Each instance applies a **random offset** to its tick (initial delay and/or per-tick jitter) so N replicas spread their work across the interval instead of all firing at once.
- **Jitter's job is to spread load and shrink the contention window — not to guarantee single processing.** Correctness comes from the resource being read, regardless of tick timing:
  - **Relay:** `SELECT … FOR UPDATE SKIP LOCKED` — concurrent relays lock disjoint rows; an already-claimed row is skipped.
  - **Enricher via SQS:** competing consumers + visibility timeout (one in-flight delivery at a time), with idempotency on `eventId` covering at-least-once redelivery.
  - **Enricher via catch-up poll:** `SKIP LOCKED` (or a Postgres advisory lock) over the event-log page.
- First-principle reasoning: the workers are already always-on containers, so a sleep loop adds **zero new infrastructure** and keeps local dev identical to prod (`bun --watch`). A plain `sleep` loop is the least machinery that drives periodic work — no scheduler, no cron-expression parsing. Because the dedup invariant already exists **at the resource**, the trigger only has to avoid wasteful synchronized contention — it does not need to enforce exclusivity — and jitter is the cheapest way to break lockstep.

## Consequences

- **Positive:** no new infrastructure (no EventBridge/Lambda/RunTask) for the MVP; identical local and prod scheduling; N replicas are safe to run; jitter removes synchronized DB spikes; the relay can tick at sub-minute cadence that a managed 1-minute-floor scheduler cannot.
- **Trade-offs:**
  - Requires an **always-on container** — we pay for it even while idle (no scale-to-zero).
  - The loop is a **fixed interval**, not calendar-accurate scheduling; not suited to "run at 02:00 daily" style jobs.
  - Jitter **reduces but does not eliminate** race windows; correctness rests entirely on the row-lock / visibility-timeout / idempotency mechanisms — if one of those is wrong, jitter will not save us.
  - Scheduling reliability equals **process uptime** — nothing external guarantees a tick ran.
- **Follow-ups:**
  - Pick the interval and jitter bounds per worker.
  - Ensure the enricher's SQS **visibility timeout exceeds worst-case processing** (LLM + embedding latency), or heartbeat it with `ChangeMessageVisibility`.
  - Keep runs **non-overlapping** — `await` the work before sleeping, so the interval starts after the previous run finishes.
  - Confirm `FOR UPDATE … SKIP LOCKED` behaviour on the target Aurora engine version.
  - Revisit **EventBridge Scheduler → ECS RunTask** if calendar-accurate scheduling or scale-to-zero ever outweighs the always-on cost.

## Alternatives considered

- **EventBridge Scheduler → ECS RunTask (scheduled Fargate task)** — managed, scale-to-zero, real cron expressions, reuses the image; loses for the MVP on extra IaC, per-run startup latency, local-dev divergence, and a 1-minute floor too laggy for the relay.
- **EventBridge → SQS/HTTP "tick" into the running worker** — managed-cron reliability while the container stays warm; loses by paying for both a schedule **and** an always-on container, plus exposing and securing a trigger endpoint.
- **Single-instance workers (no concurrency)** — sidesteps double-read entirely; loses availability and throughput headroom, and turns every deploy into a processing gap.
- **Leader election / distributed lock for the tick** — one instance ticks per interval; loses as unnecessary machinery — resource-level dedup already makes concurrent ticks safe, so coordinating the trigger adds cost without buying correctness.
