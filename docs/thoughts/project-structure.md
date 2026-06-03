# RecallOS — Project Structure (Hexagonal Architecture + DDD)

Derived from `docs/diagrams/architecture.excalidraw` and built on the storage decisions in [`database-tradeoffs.md`](./database-tradeoffs.md). Defines the **target** monorepo layout RecallOS will grow into. It is the structural blueprint, not yet the code on disk — `apps/service` today is a single Hono `/api/v1/health` route. Concrete bounded-context names are deliberately left for a later discovery; this doc fixes the _shape_, not the _contents_.

---

## 1. Why hexagonal + DDD

RecallOS is org-wide memory: ingest from many external sources, relate everything, and serve recall to humans and AI agents through one API. Two forces make ports & adapters the right fit:

- **The datastores are deliberately undecided.** `database-tradeoffs.md` recommends _starting consolidated on one Postgres (pgvector + partitioned events + edge tables) and graduating the hottest store later_ (→ OpenSearch / Neptune / Timestream). That only stays cheap if business logic never names a database. Hexagonal architecture makes "swap the store" mean "write a new adapter" — the domain doesn't move.
- **Two runtimes share one brain.** The diagram has a `Service` (HTTP ingest + read API) and a cron-driven `Worker`. They must apply the _same_ rules (what an event is, how entities relate, what a valid recall query is). DDD puts those rules in a pure core that both runtimes import; the `Service` and `Worker` are just two different ways to _drive_ it.

> **Principle:** the domain is a pure library with zero I/O. Everything that touches the network, a database, a clock, or a framework is an adapter plugged into a port.

This maps cleanly onto the existing toolchain — a Bun/Turborepo monorepo with `workspace:*` packages and a shared strict `@repo/typescript-config`. The hexagon's layers become packages; the dependency rule becomes the package graph.

---

## 2. The dependency rule

Dependencies point **inward only**. Outer layers know about inner layers; inner layers never know about outer ones.

```
apps (inbound adapters + composition root)
        │  depends on
        ▼
outbound adapters  (server-<context>-infra)
        │
        ▼
application + ports   (server-<context>/application)
        │
        ▼
domain                (server-<context>/domain)
        │
        ▼
shared kernel         (server-kernel)
```

- **`domain` and `application` are pure.** No `hono`, no database driver, no `pino`, no `process.env`, no `Date.now()`. They may depend only on `@repo/server-kernel` and `zod`. If a layer needs the outside world, it declares a **port** (an interface) and lets an adapter satisfy it.
- **Pure packages only import libraries declared in their package manifests.** Context packages use `zod` to express and enforce invariants; `server-kernel` also uses `es-toolkit` for stateless utility helpers. Neither is a framework and neither names infrastructure — importing them keeps the dependency rule intact.
- **`server-platform` is sideways infrastructure**, not an inner layer. Adapters and apps use it; the domain never does.
- **Apps never import each other.** `service` and `worker` are siblings; anything they share lives in a package.

The package graph _is_ the enforcement: an inner package simply does not list an outer package (or a driver) in its `package.json`, so the import is impossible. See §8.

---

## 3. The layers

| Layer                          | Package                                                  | Responsibility                                                                                                       | May depend on                                              | Must NOT contain                                         |
| ------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| **Domain**                     | `@repo/server-<context>` (`domain/`)                     | Entities, value objects, aggregates, domain events, domain services, invariants                                      | `@repo/server-kernel`, `zod`                               | I/O, frameworks, SQL, env, wall-clock reads              |
| **Application**                | `@repo/server-<context>` (`application/`)                | Use cases that orchestrate the domain; transaction boundaries; defines ports                                         | own `domain/`, `@repo/server-kernel`, `zod`                | concrete DBs/HTTP; knowledge of _which_ adapter is wired |
| **Inbound ports** (driving)    | `@repo/server-<context>` (`application/ports/inbound/`)  | Interfaces describing _what the app can do_ — one per use case                                                       | —                                                          | implementation                                           |
| **Outbound ports** (driven)    | `@repo/server-<context>` (`application/ports/outbound/`) | Interfaces the app _needs_ — repositories, gateways, clock, event publisher                                          | —                                                          | implementation                                           |
| **Inbound adapters** (driving) | `apps/service` (`inbound/`), `apps/worker` (`inbound/`)  | Translate HTTP/cron/queue into inbound-port calls; validate transport input                                          | `@repo/server-<context>`, `@repo/server-platform`, `hono`  | business rules                                           |
| **Outbound adapters** (driven) | `@repo/server-<context>-infra`                           | Implement outbound ports against real tech (Postgres, external APIs)                                                 | `@repo/server-<context>`, `@repo/server-platform`, drivers | business rules                                           |
| **Composition root**           | `apps/*` (`composition/`)                                | The _only_ place that knows concrete adapters; wires them to use cases (DI)                                          | everything                                                 | business rules                                           |
| **Shared kernel**              | `@repo/server-kernel`                                    | DDD building blocks: `Entity`, `AggregateRoot`, `ValueObject`, `DomainEvent`, `Id`, `Result`, `DomainError`, `Clock` | `zod`, `es-toolkit`                                       | I/O, context-specific types                              |
| **Platform**                   | `@repo/server-platform`                                  | Cross-cutting infra primitives: pg pool, `zod` config, `pino` logger, event bus, unit-of-work                        | drivers                                                    | domain types, business rules                             |

The split inside the hexagon is the classic one: **driving ports** are how the world calls _in_ (use-case interfaces), **driven ports** are how the app calls _out_ (repositories/gateways). Adapters sit on the two opposite edges of the hexagon and never talk to each other directly — only through the core.

---

## 4. Monorepo layout

```
recallos/
├─ apps/
│  ├─ service/src/                  # DRIVING adapter: HTTP API (Hono) + composition root
│  │  ├─ inbound/                    #   routes, controllers, request/response DTOs, webhook handlers
│  │  ├─ composition/               #   composition root — build use cases from infra adapters (DI)
│  │  └─ index.ts                   #   bootstrap: load config → wire → serve
│  └─ worker/src/                   # DRIVING adapter: cron/event consumers + composition root
│     ├─ inbound/                    #   cron triggers, queue/event consumers
│     ├─ composition/               #   DI wiring
│     └─ index.ts                   #   bootstrap
├─ packages/
│  ├─ server-kernel/src/               # @repo/server-kernel — DDD shared kernel, zod + es-toolkit only
│  │                                #   Entity, AggregateRoot, ValueObject, DomainEvent, Id, Result, DomainError, Clock
│  ├─ server-platform/src/             # @repo/server-platform — cross-cutting infra primitives
│  │                                #   db (pg pool), config (zod env), logger (pino), eventBus, unit-of-work
│  ├─ server-<context>/src/            # @repo/server-<context> — hexagon interior (PURE: @repo/server-kernel + zod only)
│  │  ├─ domain/                    #   entities, value-objects, aggregates, events, domain-services, errors
│  │  ├─ application/
│  │  │  ├─ use-cases/              #   application services orchestrating the domain (implement inbound ports)
│  │  │  └─ ports/
│  │  │     ├─ inbound/             #   DRIVING ports: use-case interfaces
│  │  │     └─ outbound/            #   DRIVEN ports: repository + gateway interfaces
│  │  └─ index.ts                   #   public surface (use cases, ports, domain types)
│  ├─ server-<context>-infra/src/      # @repo/server-<context>-infra — DRIVEN adapters (shared by service + worker)
│  │  ├─ persistence/               #   repository impls (Postgres/pgvector/graph) implementing outbound ports
│  │  ├─ gateways/                  #   external-system clients implementing outbound ports
│  │  └─ index.ts                   #   adapter factories for the composition root
│  └─ typescript-config/            # existing — shared strict tsconfig (@repo/typescript-config)
└─ docs/
   ├─ diagrams/architecture.excalidraw
   └─ thoughts/
      ├─ database-tradeoffs.md
      └─ project-structure.md       # ← this doc
```

`<context>` is a placeholder for each bounded context (e.g. an ingestion context, a recall context, …). One context = one pure package `@repo/server-<context>` **plus** one adapter package `@repo/server-<context>-infra`. Apps stay thin: inbound adapters + a composition root, nothing else.

**Why two packages per context?** The pure package must stay installable with _zero_ infra dependencies so the dependency rule is mechanically guaranteed. Splitting the adapters into `@repo/server-<context>-infra` keeps drivers (`pg`, SDK clients) out of the core's `package.json` entirely, and lets both `service` and `worker` reuse the same outbound adapters.

---

## 5. Worked example (placeholder context)

A use case for _capturing an item into memory_, shown end-to-end. Names are illustrative — substitute real bounded contexts later.

**Outbound port** — `packages/server-<context>/src/application/ports/outbound/memory-item.repository.ts`

```ts
import type { MemoryItem } from "../../../domain/memory-item.aggregate";

export interface MemoryItemRepository {
  save(item: MemoryItem): Promise<void>;
  findById(id: MemoryItemId): Promise<MemoryItem | null>;
}
```

**Inbound port + use case** — `packages/server-<context>/src/application/use-cases/capture-item.use-case.ts`

```ts
export interface CaptureItem {
  // driving port
  execute(input: CaptureItemInput): Promise<Result<MemoryItemId>>;
}

export class CaptureItemUseCase implements CaptureItem {
  constructor(private readonly repo: MemoryItemRepository) {} // outbound PORT, not a DB
  async execute(input: CaptureItemInput) {
    const item = MemoryItem.create(input); // domain enforces invariants
    await this.repo.save(item);
    return Result.ok(item.id);
  }
}
```

Note the use case depends on the **interface** `MemoryItemRepository`. It has no idea Postgres exists.

**Outbound adapter** — `packages/server-<context>-infra/src/persistence/memory-item.repository.pg.ts`

```ts
export class PgMemoryItemRepository implements MemoryItemRepository {
  constructor(private readonly db: Db) {} // from @repo/server-platform
  async save(item: MemoryItem) {
    /* map aggregate → rows, INSERT via pgvector + edges */
  }
  async findById(id: MemoryItemId) {
    /* SELECT → reconstitute aggregate */
  }
}
```

**Composition root** — `apps/service/src/composition/`

```ts
const db = createDb(config); // @repo/server-platform
const repo = new PgMemoryItemRepository(db); // @repo/server-<context>-infra
const captureItem = new CaptureItemUseCase(repo); // @repo/server-<context>
// captureItem is then handed to the HTTP layer
```

This is the _one_ file that names both the use case and the concrete adapter. Swapping Postgres for OpenSearch later is a new class in `-infra` + one line here; §5 of `database-tradeoffs.md` is exactly this swap.

---

## 6. Inbound adapters & runtime flows

Both runtimes are _driving_ adapters over the same core. Mapping the diagram's arrows:

**Service** (`apps/service`) — ingest + read API:

```
External --webhook--> inbound/ adapter --> CaptureItem (inbound port)
                                          └─> MemoryItemRepository (outbound port)
                                                └─> server-<context>-infra --> TimeseriesDB (write)

Client --query--> inbound/ adapter --> RecallItems (inbound port)
                                      └─> Vector/Graph repos (outbound ports)
                                            └─> server-<context>-infra --> VectorDB + GraphDB (read)
```

**Worker** (`apps/worker`) — cron-driven enrichment:

```
Cron --trigger--> inbound/ adapter --> EnrichMemory (inbound port)
                                      └─> reads TimeseriesDB, writes VectorDB + GraphDB
                                            (all via outbound ports → server-<context>-infra)
```

The read/write split per store matches `database-tradeoffs.md` §1: `Service` writes Timeseries and reads Vector/Graph; `Worker` reads Timeseries and read/writes Vector/Graph. None of that directionality lives in the domain — it's expressed by _which ports each runtime's composition root wires_.

---

## 7. Outbound adapters & the three datastores

Outbound ports are declared in `packages/server-<context>/src/application/ports/outbound/`; their implementations live in `packages/server-<context>-infra/src/persistence/`. The domain sees `MemoryItemRepository`, `VectorIndex`, `RelationshipGraph` — never a database name.

| Diagram store    | Outbound port (example) | Adapter today (per `database-tradeoffs.md`)      | Graduation = new adapter only |
| ---------------- | ----------------------- | ------------------------------------------------ | ----------------------------- |
| **TimeseriesDB** | `EventLogRepository`    | Aurora Postgres, time-partitioned `events` table | Timestream for InfluxDB       |
| **VectorDB**     | `VectorIndex`           | Aurora Postgres + `pgvector` (HNSW)              | OpenSearch k-NN / S3 Vectors  |
| **GraphDB**      | `RelationshipGraph`     | Postgres edge table + recursive CTEs             | Neptune (openCypher) / Neo4j  |

> Because the contract is the port, "start consolidated, graduate by evidence" (the DB doc's recommendation) costs **zero** domain changes. Each store is split out by replacing one class in `-infra` and one line in a composition root.

`@repo/server-platform` provides the shared connection pool, config, logger, and a unit-of-work so adapters that must write transactionally across stores (while still one Postgres) can share a transaction.

---

## 8. Enforcing the dependency rule

Three guards, strongest first:

1. **Package boundaries (primary).** The rule is enforced by _what each `package.json` declares_. `@repo/server-<context>` lists only `@repo/server-kernel` — it cannot import `pg` or `@repo/server-platform` because they aren't installed for it. This makes violations a build error, not a review nit.
2. **Lint.** `oxlint.config.ts` already enables the `import` plugin; add `import/no-cycle` and boundary rules so a stray relative import across packages is caught.
3. **TypeScript.** Each package extends `@repo/typescript-config/bun.json` and sets its own `paths` (the `@/*` → `./src/*` alias already used by `apps/service`). Project references keep `domain`/`application` compiling without any infra types in scope.

A quick smell test for any PR: open the `package.json` of a `domain`/`application` package — if it lists a driver, a framework, or `@repo/server-platform`, the hexagon has leaked. `zod` is the only permitted third-party dependency in context packages; `server-kernel` may also use `es-toolkit`.

---

## 9. Naming conventions

- **Files:** kebab-case, with a role suffix so the layer is obvious at a glance:
  | Suffix | Meaning | Layer |
  |---|---|---|
  | `*.aggregate.ts` / `*.entity.ts` | aggregate root / entity | domain |
  | `*.value-object.ts` | value object | domain |
  | `*.event.ts` | domain event | domain |
  | `*.use-case.ts` | application service + its inbound port | application |
  | `*.port.ts` | a driven (outbound) port interface | application/ports/outbound |
  | `*.repository.ts` | repository **port** (interface) | application/ports/outbound |
  | `*.repository.pg.ts` | repository **adapter** (Postgres impl) | `server-<context>-infra` |
- **Packages:** every server workspace package is prefixed `server-` — the convention is `@repo/server-<name>`. So a bounded context is `@repo/server-<context>` (core) plus `@repo/server-<context>-infra` (adapters), alongside the shared `@repo/server-kernel` and `@repo/server-platform`. (The pre-existing `@repo/typescript-config` predates the convention and keeps its name.)
- **Public surface:** each context package exposes exactly one `src/index.ts`. Adapters and apps import from the package root, never deep-reach into another package's internals.

---

## 10. "Where does this go?" cheat-sheet

| I'm adding…                            | It goes in…                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| A new entity / business invariant      | `packages/server-<context>/src/domain/`                                                    |
| A new operation the system can perform | `packages/server-<context>/src/application/use-cases/` (+ inbound port)                    |
| "The app needs to read/write X"        | a new **outbound port** in `application/ports/outbound/`, impl in `server-<context>-infra` |
| A SQL query / `pgvector` call          | `packages/server-<context>-infra/src/persistence/`                                         |
| A call to an external API              | `packages/server-<context>-infra/src/gateways/`                                            |
| A new HTTP route / webhook             | `apps/service/src/inbound/`                                                                |
| A new cron / queue consumer            | `apps/worker/src/inbound/`                                                                 |
| Wiring a use case to its adapters (DI) | `apps/*/src/composition/`                                                                  |
| An env var / the pg pool / logger      | `packages/server-platform/src/`                                                            |
| A base class shared by all contexts    | `packages/server-kernel/src/`                                                              |

---

## 11. Build & tooling notes

- New packages join via the existing `workspace:*` protocol and the root `workspaces` globs (`apps/*`, `packages/*`); no Turborepo config change needed — `build` already runs topologically (`dependsOn: ["^build"]`).
- Each new package needs a `package.json` (extending the catalog deps — `hono`, `zod`, `pino` are already pinned in the root `catalog`) and a `tsconfig.json` extending `@repo/typescript-config/bun.json`.
- `apps/worker` is scaffolded the same way as `apps/service` (Bun entry, `oxlint`, `bun test`), with its own `dockers/Dockerfile.worker` mirroring the existing service Dockerfile.

---

## Closing notes

- **Deferred on purpose:** scaffolding the actual `packages/*` and `apps/worker` skeletons; DB migrations; and the concrete event-bus / queue technology for the `Worker`. Each is its own follow-up. (The first bounded contexts — `ingestion` and `knowledge` — are now named, so `<context>` in this doc reads as a template for each.)
- **This doc is the target, not the current state.** It is the contract future PRs should converge toward — the payoff is that the storage graduations in `database-tradeoffs.md` stay adapter-local and the domain never has to move.
