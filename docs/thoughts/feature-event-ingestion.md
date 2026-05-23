# RecallOS — Event Ingestion (Domain & Application)

Designs the **Domain** and **Application** layers for the first feature RecallOS
captures: **event ingestion**. Builds on the layout in
[`project-structure.md`](./project-structure.md) and the storage decisions in
[`database-tradeoffs.md`](./database-tradeoffs.md). This is the first concrete
*bounded context*, so it also fixes a name the structure doc deliberately deferred:
**`ingestion`** (`@repo/ingestion` + `@repo/ingestion-infra`). Scope here is the pure
core only — the domain model, the inbound port, the outbound persistence port, and
the use case that ties them together. Adapters (Postgres, HTTP) are named as seams in
§7 but not built.

---

## 1. Where this fits in the product

RecallOS is org-wide memory modelled as a **knowledge graph** — "everything relates
to everything." It is tempting to make ingestion smart, but events are **not** the
graph: they are the **raw substrate it is built from**. The product is a pipeline:

```
capture  →  enrich  →  relate  →  recall
 (this)     Worker      Worker     Service
```

- **Capture (this feature).** The `Service` receives an event from an external source
  and appends it, unchanged, to an append-only log (the TimeseriesDB of
  `database-tradeoffs.md` §1/§6). Fast, generic, opinion-free.
- **Enrich / relate.** The `Worker` later drains that log and derives the knowledge
  graph from it — entities, embeddings (VectorDB), and relationships (GraphDB).
- **Recall.** The `Service` reads that graph to answer humans and AI agents.

> **Principle:** ingestion is the **dumb capture front door**. It stores an opaque
> payload tagged with metadata and **does not interpret it or touch the graph**.
> Interpretation is the downstream enrichment context's job. Keeping intake thin —
> and graph-building a separate concern — is the entire reason for this boundary.

This shapes every decision below: the event is **immutable** (a fact that happened),
the body is **opaque** (not parsed at capture time), and the only outbound dependency
is "append this to the log."

> **Naming nuance:** the `Event` *aggregate* defined here is a **captured
> occurrence** — a domain noun. It is **not** the kernel `DomainEvent` (the
> publish/subscribe building block in `@repo/kernel`). The two share a word, not a
> concept; §7 notes where a real `DomainEvent` (`EventRecorded`) would later appear.

---

## 2. The Event domain model

Lives in `packages/ingestion/src/domain/`, depends only on `@repo/kernel`. The
aggregate is **immutable once recorded** — this context offers no update or delete,
because you cannot un-happen a fact. Corrections are new events.

| Field | Type | Meaning |
|---|---|---|
| `id` | `EventId` | Identity, generated at capture. |
| `occurredAt` | `Date` | When the event happened **at the source** (from the payload). |
| `recordedAt` | `Date` | When RecallOS **captured** it (from the `Clock` port — §4). |
| `tags` | `Tags` | Key→value **metadata** envelope: `source`, `type`, …. What the Worker routes on. |
| `body` | `EventBody` | The **opaque** source payload; stored, not interpreted. |

**`EventId`** — value object wrapping a kernel `Id`, generated on creation.
```ts
// packages/ingestion/src/domain/event-id.value-object.ts
import { Id } from "@repo/kernel";

export class EventId extends Id {
  static generate(): EventId {
    return new EventId(Id.generate());
  }
}
```

**`Tags`** — value object over a normalized `Record<string, string>`. This is the
metadata carrier (no separate `source`/`type` fields on the aggregate); the Worker
reads it to decide how to interpret the body and where to attach it in the graph.
```ts
// packages/ingestion/src/domain/tags.value-object.ts
export class Tags {
  private constructor(private readonly entries: Readonly<Record<string, string>>) {}

  static create(input: Record<string, string>): Tags {
    const normalized: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(input)) {
      const key = rawKey.trim().toLowerCase();
      if (key === "") throw new InvalidEventError("tag keys must be non-empty");
      normalized[key] = rawValue.trim();
    }
    return new Tags(normalized);
  }

  get(key: string): string | undefined {
    return this.entries[key.trim().toLowerCase()];
  }

  toRecord(): Record<string, string> {
    return { ...this.entries };
  }
}
```

**`EventBody`** — value object holding the raw structured payload. It validates only
that something is present; it **deliberately does not validate the shape**, because
ingestion is generic across sources (messages, documents, processes) and shape is the
enrichment context's concern.
```ts
// packages/ingestion/src/domain/event-body.value-object.ts
export class EventBody {
  private constructor(private readonly value: Readonly<Record<string, unknown>>) {}

  static create(value: Record<string, unknown>): EventBody {
    if (Object.keys(value).length === 0) {
      throw new InvalidEventError("event body must not be empty");
    }
    return new EventBody(value);
  }

  toJSON(): Record<string, unknown> {
    return { ...this.value };
  }
}
```

**`Event`** — the aggregate root. A single static factory `record(...)` enforces the
invariants; there is no public constructor and no setters.
```ts
// packages/ingestion/src/domain/event.aggregate.ts
import { AggregateRoot } from "@repo/kernel";
import { EventId } from "./event-id.value-object";
import { Tags } from "./tags.value-object";
import { EventBody } from "./event-body.value-object";
import { InvalidEventError } from "./invalid-event.error";

export interface RecordEventProps {
  occurredAt: Date;
  tags: Record<string, string>;
  body: Record<string, unknown>;
}

export class Event extends AggregateRoot<EventId> {
  private constructor(
    readonly id: EventId,
    readonly occurredAt: Date,
    readonly recordedAt: Date,
    readonly tags: Tags,
    readonly body: EventBody,
  ) {
    super(id);
  }

  // `recordedAt` is passed in (from the Clock port) — the domain never reads the wall clock.
  static record(props: RecordEventProps, recordedAt: Date): Event {
    if (Number.isNaN(props.occurredAt.getTime())) {
      throw new InvalidEventError("occurredAt is not a valid date");
    }
    if (props.occurredAt.getTime() > recordedAt.getTime()) {
      throw new InvalidEventError("occurredAt cannot be in the future");
    }
    return new Event(
      EventId.generate(),
      props.occurredAt,
      recordedAt,
      Tags.create(props.tags),
      EventBody.create(props.body),
    );
  }
}
```

`InvalidEventError` (`invalid-event.error.ts`) extends the kernel `DomainError`, so
every invariant violation is a typed domain failure — the inbound adapter maps it to
a transport response (§3).

---

## 3. Inbound port — `IngestEvent`

The **driving port**: the one thing the world can ask this context to do. It accepts
the event input payload and returns **`void`** — the caller does not get an id back,
because capture is fire-and-forget from the source's perspective. Lives with its
implementation in `packages/ingestion/src/application/use-cases/`.

```ts
// packages/ingestion/src/application/use-cases/ingest-event.use-case.ts
export interface IngestEventInput {
  occurredAt: Date;                 // source time, supplied by the caller
  tags: Record<string, string>;     // metadata: source, type, …
  body: Record<string, unknown>;    // opaque payload
}

export interface IngestEvent {       // driving port
  execute(input: IngestEventInput): Promise<void>;
}
```

> **Note — `void`, not `Result`.** project-structure.md's `CaptureItem` example
> returned `Result<MemoryItemId>`; ingestion intentionally returns `void`. The
> happy path produces nothing the caller needs; invariant violations throw a kernel
> `DomainError`, and the inbound HTTP adapter (§7) translates that into a `4xx`.
> `IngestEventInput` is transport-agnostic: the HTTP adapter validates the raw
> request (zod) and maps it into this shape, so the use case never sees a `Request`.

---

## 4. Outbound ports

The **driven ports**: what this context needs from the outside, declared as
interfaces in `packages/ingestion/src/application/ports/outbound/` and implemented in
`@repo/ingestion-infra`. The domain sees interfaces only — never a database name.

**`EventLogRepository`** — the append-only persistence port. It accepts the domain
model and returns `void`. The name matches the `EventLogRepository` already mapped to
the TimeseriesDB in project-structure.md §7.
```ts
// packages/ingestion/src/application/ports/outbound/event-log.repository.ts
import type { Event } from "../../../domain/event.aggregate";

export interface EventLogRepository {
  append(event: Event): Promise<void>;
}
```
`append` (not `save`) names the contract honestly: this is an immutable log, not a
mutable store. Its Postgres implementation (§7) inserts one row into the
time-partitioned `events` table.

**`Clock`** — supplied by `@repo/kernel` (listed there as a building block and an
example outbound port). It exists so the domain stays pure: the use case reads
`recordedAt` from the clock instead of the domain calling `Date.now()`.
```ts
// from @repo/kernel
export interface Clock {
  now(): Date;
}
```
Tests inject a fixed clock; production wires the platform `SystemClock`. Splitting it
out is what lets §2's `Event.record` take `recordedAt` as a parameter.

---

## 5. Use-case implementation — `IngestEventUseCase`

The application service that implements the inbound port. It creates the domain model
(which enforces invariants) and inserts it via the outbound port — nothing more. It
depends only on **interfaces**, so it has no idea Postgres, HTTP, or the system clock
exist.

```ts
// packages/ingestion/src/application/use-cases/ingest-event.use-case.ts
import type { Clock } from "@repo/kernel";
import { Event } from "../../domain/event.aggregate";
import type { EventLogRepository } from "../ports/outbound/event-log.repository";

export class IngestEventUseCase implements IngestEvent {
  constructor(
    private readonly events: EventLogRepository,   // outbound PORT, not a DB
    private readonly clock: Clock,                  // outbound PORT, not Date.now()
  ) {}

  async execute(input: IngestEventInput): Promise<void> {
    const event = Event.record(input, this.clock.now()); // domain enforces invariants
    await this.events.append(event);                     // persist via port
  }
}
```

The flow is exactly three steps: read the capture time from the clock, build a valid
`Event`, append it. Any invalid input throws inside `Event.record` before a row is
ever written.

---

## 6. File placement

Following the naming suffixes (project-structure.md §9) and layout (§4). Everything
here is inside the pure `@repo/ingestion` package, whose `package.json` lists **only**
`@repo/kernel` — the dependency rule is mechanically enforced (§8 of the structure
doc).

| Artifact | Path |
|---|---|
| `Event` aggregate root | `packages/ingestion/src/domain/event.aggregate.ts` |
| `EventId` value object | `packages/ingestion/src/domain/event-id.value-object.ts` |
| `Tags` value object | `packages/ingestion/src/domain/tags.value-object.ts` |
| `EventBody` value object | `packages/ingestion/src/domain/event-body.value-object.ts` |
| `InvalidEventError` | `packages/ingestion/src/domain/invalid-event.error.ts` |
| `IngestEvent` port + `IngestEventUseCase` | `packages/ingestion/src/application/use-cases/ingest-event.use-case.ts` |
| `EventLogRepository` port | `packages/ingestion/src/application/ports/outbound/event-log.repository.ts` |
| `Clock` port | `@repo/kernel` (shared) |
| Public surface | `packages/ingestion/src/index.ts` (exports the use case, ports, and domain types) |

---

## 7. Out of scope / next steps

Named here so the seams are visible, but **not** built in this feature:

- **Persistence adapter** — `PgEventLogRepository` in
  `packages/ingestion-infra/src/persistence/event-log.repository.pg.ts`, implementing
  `EventLogRepository.append` against the time-partitioned `events` JSONB table
  (`database-tradeoffs.md` §6). Maps the aggregate → one row.
- **Inbound HTTP adapter** — a webhook route in `apps/service/src/http/` that
  validates the raw request with `zod`, maps it to `IngestEventInput`, calls
  `IngestEvent`, and translates `InvalidEventError` → `4xx`.
- **Composition root** — `apps/service/src/composition/` wires
  `new IngestEventUseCase(new PgEventLogRepository(db), systemClock)` and hands the
  port to the HTTP layer.
- **`EventRecorded` domain event** — the seam to the rest of the pipeline. When
  capture later needs to *notify* the Worker that a fact landed, the aggregate raises
  a kernel `DomainEvent` (`EventRecorded`) and the use case publishes it through an
  `EventPublisher` outbound port. That is what kicks off **enrich → relate** and
  turns raw events into the knowledge graph — a separate context, a separate
  discovery.

---

## Closing notes

- **What this feature is:** a pure, minimal capture core — an immutable `Event`, one
  inbound port that returns `void`, one append-only outbound port, and a three-line
  use case. No I/O, no framework, no graph logic.
- **Why it stays small:** every line obeys the dependency rule, so the storage and
  transport choices (Postgres today, something else later; HTTP today, a queue later)
  remain adapter-local. The domain never moves.
- **This doc is design, not code on disk** — like its siblings in `thoughts/`, it
  is the contract the `@repo/ingestion` package should converge toward.
