# RecallOS — Knowledge Graph Domain Model

Designs the **domain layer** for the knowledge graph: the pure entities, value objects, aggregates, invariants, and domain services that capture _what a knowledge graph is_ in RecallOS — with **zero I/O**. It is the inner ring of the hexagon described in [`project-structure.md`](./project-structure.md) (`packages/<context>/src/domain/`), and it is shaped by the storage decisions in [`database-tradeoffs.md`](./database-tradeoffs.md) (Postgres edge table + recursive CTEs for the graph, `pgvector` for embeddings).

This is the _model_, not the schema and not the wiring. Repositories, SQL, and embedding gateways are **ports/adapters** and live outside this doc. Where a storage fact constrains the model, it is called out — but no database is named in the domain itself.

---

## 1. Why a knowledge graph

RecallOS's third axiom is **"every piece of information is related to other pieces of information"**, and a stated problem is that **"related entities aren't mapped with meaningful relationships."** The knowledge graph is the model that makes that relatedness first-class:

- **Nodes** are the _entities/concepts_ RecallOS has learned about (a person, a document, a message, a task…), each grounded in the raw **events** it was derived from and carrying an **embedding** for semantic recall.
- **Edges** are the _meaningful, typed relationships_ between those entities, each carrying **confidence**, **provenance**, and **time** so recall can be trusted and time-aware.

The graph is **derived**, not captured: the `Service` ingests raw events into the event log, and the cron-driven `Worker` distills nodes/edges out of those events (`database-tradeoffs.md` §1). So the domain model must treat nodes/edges as _evolving projections of events_ — created, reinforced, embedded, and merged over time — never as user-entered records.

---

## 2. Ubiquitous language

| Term                | Meaning in this domain                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Knowledge graph** | The bounded identity + metadata for one graph of memory. Holds nodes/edges _conceptually_; see §3 for what that means at the aggregate level.                   |
| **Node**            | A resolved entity or concept. Has a **required type**, a textual **body**, the **eventIds** it was derived from (provenance), and an optional **embedding**.    |
| **Edge**            | A **directed**, **typed** relationship `from → to` between two nodes, with **confidence**, **source events**, and an **observed-at** time.                      |
| **Event**           | A raw captured item in the event log (another bounded context). The graph references events **by id only** (`EventId`) — it never owns or loads event payloads. |
| **Embedding**       | A vector representation of a node's body, produced by the Worker for semantic (ANN) recall. Assigned _after_ node creation.                                     |
| **Relationship**    | The kind of an edge, drawn from a **closed, governed vocabulary** (`RelationshipType`).                                                                         |
| **Provenance**      | The set of events that justify a node's existence or an edge's assertion. The audit trail back to ground truth.                                                 |
| **Subgraph**        | A bounded _read_ result: a root node plus its n-hop neighborhood. The shape recall returns. A read model, **not** a write aggregate (§3, §7).                   |

> **Naming caution:** "event" is overloaded. In this doc _event_ always means a raw item in the ingest **event log** (referenced as `EventId`). DDD **domain events** (things that happened _in this model_, e.g. `NodesRelated`) are always written "domain event."

---

## 3. The central decision: where is the aggregate boundary?

The requirement frames the graph as _"id, nodes, edges"_ — i.e. one `KnowledgeGraph` that **has** collections of nodes and edges. Taken literally that suggests one aggregate. But an aggregate is a **consistency + transaction boundary**: everything inside is loaded, mutated, and saved together under one invariant set. That literal reading collides with what RecallOS actually is. Below are the two viable approaches and their trade-offs (the third option — no graph entity at all — is rejected because the requirement explicitly wants a graph `id` and metadata).

### Approach A — `Node` and `Edge` are aggregate roots; `KnowledgeGraph` is a thin root + domain services

`KnowledgeGraph` holds only its **identity and metadata** (id, name, timestamps, optionally counters). It does **not** hold in-memory node/edge collections. `KnowledgeGraphNode` and `KnowledgeGraphEdge` are **independent aggregate roots** that reference the graph (and each other) **by id**. Cross-aggregate operations ("relate these two nodes") run through a **domain service** that operates on already-loaded aggregates, orchestrated by an application use case that loads/saves each aggregate through its own repository.

- **Consistency:** each node and each edge is individually transactional. A cross-aggregate rule (e.g. "an edge's endpoints must exist") is enforced at **relate time** by the use case, and is **eventually consistent** thereafter (a node could in principle be removed later) — handled by referential rules in the adapter and by reconciliation, not by a giant lock.
- **Honoring "graph has nodes/edges":** the _write_ side references by id; the _read_ side returns a **Subgraph** read model (§7) — a root node plus its neighborhood materialized by a traversal. So "a graph of nodes and edges" is real and returnable; it is just a **projection**, not a loaded write aggregate.

**Trade-offs**

|                   | Pro                                                                                                                                                                                               | Con                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scale**         | Aggregates stay tiny (one node / one edge); the graph can be billions of rows and you only ever touch a handful at once.                                                                          | The "whole graph" is never a single in-memory object — you reason about it through repositories and traversals, which is less intuitive.                                                |
| **Concurrency**   | The Worker can create/reinforce thousands of edges in parallel; locks are per-edge, so almost no contention.                                                                                      | Two writers can momentarily disagree (e.g. an edge added microseconds before its node is reconciled). Needs invariants enforced at write _and_ a referential safety net in the adapter. |
| **Storage fit**   | Maps **directly** onto the planned Postgres edge table + node table + recursive CTEs (`database-tradeoffs.md` §4) and onto the future Neptune/`pgvector` split — each aggregate ≈ one row family. | Some invariants ("no dangling edge", "no duplicate edge") cannot be guaranteed purely in the domain; they leak partly to the use case + DB constraints.                                 |
| **DDD alignment** | Follows the standard guidance to **reference other aggregates by identity** and keep aggregates small; transaction = one aggregate.                                                               | "Eventual consistency between aggregates" must be a _conscious, documented_ decision (it is — see §8).                                                                                  |

### Approach B — `KnowledgeGraph` is the one true aggregate, holding `nodes[]` and `edges[]`

`KnowledgeGraph` is the single aggregate root. `Node` and `Edge` are **internal entities/value objects** inside it. All invariants are enforced _inside_ the root: adding an edge can verify both endpoints exist in `this.nodes`, reject duplicates and self-loops, etc. — pure, total, in one place.

**Trade-offs**

|                 | Pro                                                                                                                                                                                              | Con                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Invariants**  | Every graph rule is enforced **synchronously and locally** — "edge endpoints exist", "no duplicate edge" are trivial because the whole node/edge set is in hand. Strongest possible consistency. | —                                                                                                                                                                                                          |
| **Clarity**     | Matches the requirement's wording 1:1; the model reads exactly like the sentence "a graph has nodes and edges."                                                                                  | —                                                                                                                                                                                                          |
| **Scale**       | —                                                                                                                                                                                                | **Fatal for org-wide memory.** Loading the aggregate = loading the entire graph (millions–billions of nodes/edges) into memory for _any_ change. Impossible to materialize, impossible to save atomically. |
| **Concurrency** | —                                                                                                                                                                                                | The transaction boundary is the **whole graph**, so every write serializes against every other write. The Worker's bulk enrichment would be one giant contended lock.                                      |
| **Storage fit** | —                                                                                                                                                                                                | Contradicts `database-tradeoffs.md`: the point of the edge-table + CTE design is that you **never** materialize the whole graph. Approach B cannot be persisted the planned way.                           |

### Recommendation

**Adopt Approach A.** Approach B is the cleaner sentence and the stronger invariant story, but its aggregate boundary is the entire graph, which is unscalable and directly contradicts the storage plan. Approach A keeps aggregates small (the standard DDD guidance), matches the Postgres-now / Neptune-later path, and still satisfies the requirement: the graph has an **id** and **metadata**, and its **nodes/edges** are first-class aggregates reachable through it — returned to callers as a **Subgraph** read model rather than a monolithic in-memory object. The price is a small, **deliberately accepted** zone of eventual consistency between the node and edge aggregates, addressed in §8.

The rest of this doc models Approach A.

---

## 4. Building blocks (kernel)

The model is expressed with the shared kernel from `project-structure.md` §3: `AggregateRoot`, `Entity`, `ValueObject`, `DomainEvent`, `Id`, `Result`, `DomainError`. The domain is **pure**: it never reads the clock or generates ids itself — **ids and timestamps are passed in** by the application layer (which owns the `Clock` and id-generation ports). Construction returns `Result<T>` so invariant violations are values, not thrown surprises.

### 4.1 Identities

| VO                 | Wraps | Notes                                                                                                      |
| ------------------ | ----- | ---------------------------------------------------------------------------------------------------------- |
| `KnowledgeGraphId` | `Id`  | Identity of a graph.                                                                                       |
| `NodeId`           | `Id`  | Identity of a node aggregate.                                                                              |
| `EdgeId`           | `Id`  | Identity of an edge aggregate.                                                                             |
| `EventId`          | `Id`  | **Reference** to a raw event in the event-log context. The graph stores these; it never dereferences them. |

### 4.2 Value objects

```ts
// node-body.value-object.ts — the canonical text content of a node
export class NodeBody extends ValueObject<{ text: string }> {
  static create(text: string): Result<NodeBody> {
    const t = text.trim();
    if (t.length === 0) return Result.fail(new EmptyNodeBodyError());
    if (t.length > NodeBody.MAX)
      return Result.fail(new NodeBodyTooLongError(t.length));
    return Result.ok(new NodeBody({ text: t }));
  }
}

// embedding.value-object.ts — assigned by the Worker, optional at creation
export class Embedding extends ValueObject<{
  vector: readonly number[];
  model: string; // which embedding model produced it (provenance for re-embedding)
  dimensions: number; // == vector.length; carried explicitly for index validation
}> {
  static create(vector: number[], model: string): Result<Embedding> {
    if (vector.length === 0) return Result.fail(new EmptyEmbeddingError());
    if (!vector.every(Number.isFinite))
      return Result.fail(new NonFiniteEmbeddingError());
    if (model.trim().length === 0)
      return Result.fail(new MissingEmbeddingModelError());
    return Result.ok(
      new Embedding({ vector, model, dimensions: vector.length }),
    );
  }
}

// confidence.value-object.ts — how sure we are an edge is true
export class Confidence extends ValueObject<{ value: number }> {
  static create(value: number): Result<Confidence> {
    if (!(value >= 0 && value <= 1))
      return Result.fail(new ConfidenceOutOfRangeError(value));
    return Result.ok(new Confidence({ value }));
  }
}
```

### 4.3 Controlled vocabularies (closed enums)

Both the node type and the relationship type are **closed, governed vocabularies** — a fixed set the domain knows about. New members are added by a deliberate change to the domain (and a migration of the vocabulary), not by free text from an extractor. This keeps traversal queries, filtering, and GraphRAG patterns predictable, and prevents synonym sprawl ("authored_by" vs "writtenBy" vs "author").

```ts
// node-type.value-object.ts — REQUIRED on every node
export enum NodeType {
  PERSON = "PERSON",
  ORGANIZATION = "ORGANIZATION",
  DOCUMENT = "DOCUMENT",
  MESSAGE = "MESSAGE",
  TASK = "TASK",
  TOPIC = "TOPIC", // a subject/theme
  CONCEPT = "CONCEPT", // an abstract idea/term
  LOCATION = "LOCATION",
  SYSTEM = "SYSTEM", // a tool/agent/service acting in the org
}

// relationship-type.value-object.ts — the kind of an edge (from → to)
export enum RelationshipType {
  MENTIONS = "MENTIONS", // any → any
  AUTHORED_BY = "AUTHORED_BY", // DOCUMENT/MESSAGE → PERSON
  SENT_BY = "SENT_BY", // MESSAGE → PERSON/SYSTEM
  REPLIES_TO = "REPLIES_TO", // MESSAGE → MESSAGE
  PART_OF = "PART_OF", // any → any (composition/hierarchy)
  REFERENCES = "REFERENCES", // DOCUMENT → DOCUMENT/TOPIC
  ASSIGNED_TO = "ASSIGNED_TO", // TASK → PERSON
  INVOLVES = "INVOLVES", // TASK/TOPIC → PERSON/ORGANIZATION
  LOCATED_IN = "LOCATED_IN", // any → LOCATION
  DERIVED_FROM = "DERIVED_FROM", // node → node (lineage)
  DUPLICATE_OF = "DUPLICATE_OF", // node → node (entity resolution)
  RELATED_TO = "RELATED_TO", // generic, symmetric fallback
}
```

> **Governance note (the cost of "closed"):** because the Worker's extractor can only emit relationships in this set, anything it can't classify must map to `RELATED_TO` (or be dropped). Treat this enum as a **versioned vocabulary**: adding `BLOCKS`, `REPORTS_TO`, etc. is a normal, expected domain change. The closed set is a _deliberate_ trade of extractor flexibility for query stability (see §10 for the open-vocabulary alternative we did **not** take).
>
> **Direction & symmetry:** every edge is **directed** (`from → to`). Inherently symmetric relationships (`RELATED_TO`, `DUPLICATE_OF`) are stored **once in a canonical direction** (e.g. the lexicographically smaller `NodeId` as `from`) and treated as bidirectional by traversal — this prevents storing the same fact twice.

---

## 5. `KnowledgeGraphNode` aggregate

A resolved entity/concept. Type is **required**; provenance (`eventIds`) is **required and non-empty** (a node only exists because some event implied it); the embedding is **optional at birth** and assigned later by the Worker.

```ts
// knowledge-graph-node.aggregate.ts
export class KnowledgeGraphNode extends AggregateRoot<NodeId> {
  private constructor(
    id: NodeId,
    private readonly _graphId: KnowledgeGraphId,
    private _type: NodeType,
    private _body: NodeBody,
    private _eventIds: ReadonlySet<EventId>, // provenance, non-empty, de-duplicated
    private _embedding: Embedding | null, // null until the Worker embeds it
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: NodeId;
    graphId: KnowledgeGraphId;
    type: NodeType; // required
    body: NodeBody;
    eventIds: EventId[]; // >= 1
    now: Date; // supplied by the app (Clock port)
  }): Result<KnowledgeGraphNode> {
    if (!Object.values(NodeType).includes(props.type))
      return Result.fail(new UnknownNodeTypeError(props.type));
    if (props.eventIds.length === 0)
      return Result.fail(new MissingProvenanceError("node"));
    const node = new KnowledgeGraphNode(
      props.id,
      props.graphId,
      props.type,
      props.body,
      dedupe(props.eventIds),
      null,
      props.now,
      props.now,
    );
    node.record(new NodeCreated(node.id, props.graphId, props.type));
    return Result.ok(node);
  }

  /** Entity resolution: another event reinforces the same entity. */
  attachEvents(eventIds: EventId[], now: Date): void {
    const before = this._eventIds.size;
    this._eventIds = union(this._eventIds, eventIds);
    if (this._eventIds.size !== before) {
      this._touch(now);
      this.record(new NodeProvenanceExtended(this.id, eventIds));
    }
  }

  /** The Worker assigns/refreshes the embedding after creation. */
  assignEmbedding(embedding: Embedding, now: Date): void {
    this._embedding = embedding;
    this._touch(now);
    this.record(
      new NodeEmbedded(this.id, embedding.model, embedding.dimensions),
    );
  }

  reviseBody(body: NodeBody, now: Date): void {
    this._body = body;
    this._touch(now);
  }

  private _touch(now: Date) {
    this._updatedAt = now;
  }
}
```

**Fields**

| Field                     | Type                | Required | Why                                                                        |
| ------------------------- | ------------------- | -------- | -------------------------------------------------------------------------- |
| `id`                      | `NodeId`            | ✓        | Aggregate identity.                                                        |
| `graphId`                 | `KnowledgeGraphId`  | ✓        | Which graph this node belongs to (by id — Approach A).                     |
| `type`                    | `NodeType`          | ✓        | Classification, used for filtering/traversal/GraphRAG.                     |
| `body`                    | `NodeBody`          | ✓        | The canonical text; the thing that gets embedded.                          |
| `eventIds`                | `Set<EventId>`      | ✓ (≥1)   | **Provenance.** Every node traces to ≥1 raw event; merges accumulate more. |
| `embedding`               | `Embedding \| null` | ✗        | Set by the Worker; absent until then.                                      |
| `createdAt` / `updatedAt` | `Date`              | ✓        | Supplied by the app, not read from the wall clock.                         |

**Invariants**

- `type` ∈ `NodeType`.
- `body` is non-empty (≤ max length).
- `eventIds` is non-empty and de-duplicated (provenance can only grow).
- If an `embedding` is present, its `dimensions === vector.length` (guaranteed by the VO) — the adapter additionally checks it matches the index's configured dimension.

---

## 6. `KnowledgeGraphEdge` aggregate

A directed, typed relationship between two nodes, carrying the metadata recall needs to **trust** (confidence), **explain** (provenance), and **time-travel** (observed-at) a relationship.

```ts
// knowledge-graph-edge.aggregate.ts
export class KnowledgeGraphEdge extends AggregateRoot<EdgeId> {
  private constructor(
    id: EdgeId,
    private readonly _graphId: KnowledgeGraphId,
    private readonly _fromId: NodeId,
    private readonly _toId: NodeId,
    private readonly _relationship: RelationshipType,
    private _confidence: Confidence,
    private _sourceEventIds: ReadonlySet<EventId>, // provenance, non-empty
    private _observedAt: Date, // when the relationship was true/observed
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: EdgeId;
    graphId: KnowledgeGraphId;
    fromId: NodeId;
    toId: NodeId;
    relationship: RelationshipType;
    confidence: Confidence;
    sourceEventIds: EventId[]; // >= 1
    observedAt: Date; // domain time (from the source event), not "now"
    now: Date;
  }): Result<KnowledgeGraphEdge> {
    if (props.fromId.equals(props.toId))
      return Result.fail(new SelfLoopNotAllowedError(props.fromId));
    if (!Object.values(RelationshipType).includes(props.relationship))
      return Result.fail(new UnknownRelationshipTypeError(props.relationship));
    if (props.sourceEventIds.length === 0)
      return Result.fail(new MissingProvenanceError("edge"));
    const edge = new KnowledgeGraphEdge(
      props.id,
      props.graphId,
      props.fromId,
      props.toId,
      props.relationship,
      props.confidence,
      dedupe(props.sourceEventIds),
      props.observedAt,
      props.now,
      props.now,
    );
    edge.record(
      new NodesRelated(edge.id, props.fromId, props.toId, props.relationship),
    );
    return Result.ok(edge);
  }

  /** Re-asserted by a later event: bump confidence/time, accumulate provenance. */
  reinforce(props: {
    confidence: Confidence;
    sourceEventIds: EventId[];
    observedAt: Date;
    now: Date;
  }): void {
    this._confidence = props.confidence; // strategy: latest wins (could be max)
    this._sourceEventIds = union(this._sourceEventIds, props.sourceEventIds);
    if (props.observedAt > this._observedAt)
      this._observedAt = props.observedAt;
    this._updatedAt = props.now;
    this.record(
      new EdgeReinforced(this.id, this._confidence, props.sourceEventIds),
    );
  }
}
```

**Fields**

| Field                     | Type               | Required | Why                                                                                                |
| ------------------------- | ------------------ | -------- | -------------------------------------------------------------------------------------------------- |
| `id`                      | `EdgeId`           | ✓        | Aggregate identity.                                                                                |
| `graphId`                 | `KnowledgeGraphId` | ✓        | Which graph (by id).                                                                               |
| `fromId` / `toId`         | `NodeId`           | ✓        | **Directed** endpoints, referenced by id (Approach A).                                             |
| `relationship`            | `RelationshipType` | ✓        | The kind of edge (closed enum).                                                                    |
| `confidence`              | `Confidence`       | ✓        | `[0,1]`; lets recall rank/threshold AI-extracted edges.                                            |
| `sourceEventIds`          | `Set<EventId>`     | ✓ (≥1)   | **Provenance:** which events asserted this relationship.                                           |
| `observedAt`              | `Date`             | ✓        | **Time:** when the relationship held, taken from the source event — enables "recall as of time T." |
| `createdAt` / `updatedAt` | `Date`             | ✓        | Bookkeeping, app-supplied.                                                                         |

**Invariants**

- `fromId ≠ toId` (no self-loops).
- `relationship` ∈ `RelationshipType`.
- `confidence` ∈ `[0,1]`.
- `sourceEventIds` non-empty and de-duplicated.
- **Edge identity for de-duplication** is the triple `(fromId, toId, relationship)` within a graph. Re-asserting that triple **reinforces** the existing edge (provenance grows, confidence/observedAt update) rather than creating a duplicate. (Enforced by the relate domain service + a unique constraint in the adapter — see §8.)

> **Why `observedAt` is separate from `createdAt`:** `createdAt` is when _we recorded_ the edge; `observedAt` is when the relationship was _actually true_ in the world (e.g. "Alice authored doc X" observed from a message dated last March). Time-aware recall keys off `observedAt`. A full bitemporal `[validFrom, validTo)` interval is a deliberate **future extension** (§10) — `observedAt` is the minimum that satisfies the time requirement now.

---

## 7. `KnowledgeGraph` aggregate, domain services, and the `Subgraph` read model

### 7.1 The thin graph root

Under Approach A the graph root carries identity and metadata only — it is the namespace nodes/edges belong to and the place graph-wide policy lives (e.g. the embedding model/dimension this graph standardizes on).

```ts
// knowledge-graph.aggregate.ts
export class KnowledgeGraph extends AggregateRoot<KnowledgeGraphId> {
  private constructor(
    id: KnowledgeGraphId,
    private _name: string,
    private readonly _embeddingModel: string, // graph-wide policy: nodes must embed with this
    private readonly _embeddingDimensions: number,
    private readonly _createdAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: KnowledgeGraphId;
    name: string;
    embeddingModel: string;
    embeddingDimensions: number;
    now: Date;
  }): Result<KnowledgeGraph> {
    if (props.name.trim().length === 0)
      return Result.fail(new EmptyGraphNameError());
    return Result.ok(
      new KnowledgeGraph(
        props.id,
        props.name.trim(),
        props.embeddingModel,
        props.embeddingDimensions,
        props.now,
      ),
    );
  }

  /** Graph-wide invariant the node aggregate can't see on its own. */
  accepts(embedding: Embedding): boolean {
    return (
      embedding.model === this._embeddingModel &&
      embedding.dimensions === this._embeddingDimensions
    );
  }
}
```

### 7.2 Relating nodes — a pure domain service

The one cross-aggregate operation ("relate A to B") is a **domain service** that works on **already-loaded** node aggregates, so it stays pure (no repositories). The application use case loads the nodes, calls the service, and persists the resulting edge. Passing the loaded `Node`s in (rather than just ids) lets the service enforce **type-compatibility** rules for a relationship.

```ts
// graph-relation.domain-service.ts
export const GraphRelation = {
  relate(props: {
    from: KnowledgeGraphNode;
    to: KnowledgeGraphNode;
    relationship: RelationshipType;
    confidence: Confidence;
    sourceEventIds: EventId[];
    observedAt: Date;
    newEdgeId: EdgeId;
    existing: KnowledgeGraphEdge | null; // the (from,to,relationship) edge if it already exists
    now: Date;
  }): Result<KnowledgeGraphEdge> {
    if (props.from.id.equals(props.to.id))
      return Result.fail(new SelfLoopNotAllowedError(props.from.id));
    if (
      !relationshipAllowsTypes(
        props.relationship,
        props.from.type,
        props.to.type,
      )
    )
      return Result.fail(
        new IncompatibleRelationshipError(
          props.relationship,
          props.from.type,
          props.to.type,
        ),
      );

    if (props.existing) {
      // de-dup → reinforce
      props.existing.reinforce({
        confidence: props.confidence,
        sourceEventIds: props.sourceEventIds,
        observedAt: props.observedAt,
        now: props.now,
      });
      return Result.ok(props.existing);
    }
    return KnowledgeGraphEdge.create({
      id: props.newEdgeId,
      graphId: props.from.graphId,
      fromId: props.from.id,
      toId: props.to.id,
      ...props,
    });
  },
};
```

### 7.3 `Subgraph` — the read model that honors "graph = nodes + edges"

Recall does not return the whole graph; it returns a **bounded neighborhood** around a hit. That is a **read model** (a value object / DTO), assembled by a traversal repository (recursive CTE today, `openCypher` later) — _not_ a write aggregate. This is exactly where the literal "a graph has nodes and edges" shape lives and is handed to callers.

```ts
// subgraph.read-model.ts  (a value object describing a traversal result)
export interface NodeView {
  id: NodeId;
  type: NodeType;
  body: string;
}
export interface EdgeView {
  id: EdgeId;
  fromId: NodeId;
  toId: NodeId;
  relationship: RelationshipType;
  confidence: number;
  observedAt: Date;
}
export interface Subgraph {
  rootId: NodeId;
  nodes: ReadonlyArray<NodeView>; // the root + neighbors within `depth`
  edges: ReadonlyArray<EdgeView>; // edges among those nodes
  depth: number;
}
```

The traversal itself (k-hop expansion, confidence/observedAt filtering, ranking) is a **port** (`RelationshipGraph` in `project-structure.md` §7), implemented in `-infra`. The domain defines _what a Subgraph is_; the adapter decides _how_ to fetch it efficiently.

---

## 8. Cross-aggregate consistency (the cost of Approach A)

Approach A's one liability is rules that span aggregates. Two matter:

1. **No dangling edges** — an edge's `fromId`/`toId` must reference real nodes.
   - _Enforced at write_ by the relate use case (it loads both nodes; if either is missing, it fails before creating the edge).
   - _Backed by the store_ with a foreign key (Postgres edge table → node table) so an orphan can't be committed even under a race.
   - _Reconciled_ if a node is ever removed: removal is itself a use case that cascades/soft-deletes incident edges.
2. **No duplicate edges** — the `(fromId, toId, relationship)` triple is unique per graph.
   - _Enforced at write_ by the relate service (looks up the existing edge and reinforces it).
   - _Backed by the store_ with a unique constraint, so a concurrent double-insert collapses to one and the loser retries as a reinforce.

This is the standard **"reference other aggregates by identity, accept eventual consistency, lean on the DB for the last-mile guarantee"** pattern. It is a conscious trade for the scalability and concurrency Approach B can't offer (§3).

**Entity resolution / merging.** Because nodes are derived, the same real-world entity can spawn two nodes before the Worker realizes they're the same. The model handles this without deletion: a `DUPLICATE_OF` edge records the finding, and a `mergeNodes` use case folds one node's `eventIds` into the survivor (`attachEvents`) and re-points incident edges. Provenance is never lost.

---

## 9. Domain events & errors

**Domain events** (recorded on the aggregates; published after commit by the app layer — the Worker/Service can react, e.g. "node created → enqueue embedding"):

| Event                                              | Raised when                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| `NodeCreated(nodeId, graphId, type)`               | A node aggregate is created.                                     |
| `NodeProvenanceExtended(nodeId, eventIds)`         | New events attached to an existing node (a merge/reinforcement). |
| `NodeEmbedded(nodeId, model, dimensions)`          | The Worker assigns/refreshes an embedding.                       |
| `NodesRelated(edgeId, fromId, toId, relationship)` | A new edge is created.                                           |
| `EdgeReinforced(edgeId, confidence, eventIds)`     | An existing edge is re-asserted.                                 |

**Domain errors** (returned via `Result.fail`, never thrown for control flow):

`EmptyNodeBodyError`, `NodeBodyTooLongError`, `EmptyEmbeddingError`, `NonFiniteEmbeddingError`, `MissingEmbeddingModelError`, `ConfidenceOutOfRangeError`, `UnknownNodeTypeError`, `UnknownRelationshipTypeError`, `MissingProvenanceError`, `SelfLoopNotAllowedError`, `IncompatibleRelationshipError`, `EmptyGraphNameError`.

---

## 10. Decisions, alternatives, and deferred work

**Decisions taken (with the alternative we rejected):**

- **Aggregate boundary → Approach A** (node/edge as roots), not Approach B (graph-as-aggregate). Rejected B for unscalable transaction boundaries and conflict with the storage plan (§3).
- **Relationship type → closed enum** (`RelationshipType`), not an open validated label and not a hybrid. Buys query/traversal stability and prevents synonym sprawl; the price is that the extractor must map unknowns to `RELATED_TO`, and growing the vocabulary is a deliberate, versioned domain change (§4.3). _(Open-vocabulary was the alternative: more extractor flexibility, but unstable traversals — not chosen.)_
- **Node type → required** (`NodeType` mandatory on every node), not optional and not body-only. Forces classification at creation, which powers typed traversal, relationship type-compatibility checks (§7.2), and GraphRAG.
- **Edge metadata → confidence + provenance + time** (`confidence`, `sourceEventIds`, `observedAt`), not minimal and not confidence-only. Makes recall trustable, explainable, and time-aware.

**Deferred on purpose:**

- **Full bitemporality** — `observedAt` now; `[validFrom, validTo)` validity intervals + "edge retracted" semantics later, when point-in-time recall needs ranges, not instants.
- **Multi-tenancy / scope** — whether `KnowledgeGraphId` is per-workspace/org and how isolation is enforced. The model already namespaces nodes/edges by `graphId`, so this slots in without structural change.
- **Edge/node weighting beyond confidence** — recency decay, access-frequency, PageRank-style centrality for ranking recall. Belongs to a recall/ranking discovery, not this model.
- **Vocabulary governance mechanics** — how `NodeType`/`RelationshipType` are versioned and migrated as they grow.
- **Soft-delete vs hard-delete** for nodes/edges, and retention/forgetting policy.

---

## 11. Where this lives

Per `project-structure.md` §4 and §9, the knowledge-graph context is one pure package plus one adapter package. This doc designs only the `domain/` folder:

```
packages/knowledge-graph/src/
├─ domain/
│  ├─ knowledge-graph.aggregate.ts
│  ├─ knowledge-graph-node.aggregate.ts
│  ├─ knowledge-graph-edge.aggregate.ts
│  ├─ node-body.value-object.ts
│  ├─ node-type.value-object.ts
│  ├─ embedding.value-object.ts
│  ├─ relationship-type.value-object.ts
│  ├─ confidence.value-object.ts
│  ├─ ids.value-object.ts                 # KnowledgeGraphId, NodeId, EdgeId, EventId
│  ├─ graph-relation.domain-service.ts
│  ├─ subgraph.read-model.ts
│  ├─ events/                             # *.event.ts (NodeCreated, NodesRelated, …)
│  └─ errors/                             # *.error.ts (the §9 domain errors)
└─ application/                           # use cases + ports — separate discovery
```

The repositories (`KnowledgeGraphNodeRepository`, `KnowledgeGraphEdgeRepository`, the `RelationshipGraph` traversal port), the embedding gateway, and their Postgres/`pgvector` adapters are **outbound ports/adapters** — defined in `application/ports/outbound/` and implemented in `packages/knowledge-graph-infra/`, and are out of scope for this domain doc.

---

## Closing notes

- The model is **pure**: ids and timestamps are inputs, construction returns `Result`, and no aggregate touches a clock, a database, or the network.
- The literal requirement — _graph with `id`, `nodes`, `edges`; node with `id`, `eventIds`, `embedding`, `body`; edge with `id`, `fromId`, `toId`, `relationship`_ — is fully covered, with `type` added to the node (required), and `confidence` + `sourceEventIds` + `observedAt` added to the edge.
- The one architectural judgement call (graph-as-aggregate vs node/edge-as-aggregates) is resolved in favor of small aggregates so the model survives org-scale memory and matches the storage roadmap — at the documented cost of cross-aggregate eventual consistency (§8).
