# Knowledge Graph Processing Workflow Summary

This summary consolidates the graph-processing design in `docs/thoughts/feature-knowledge-graph-processing*.md`, with context from `docs/thoughts/feature-knowledge-graph.md`.

RecallOS stores raw captured information as event-log entries, then derives a knowledge graph from those entries. The processing workflow is the write-side strategy for turning events into graph nodes, graph edges, embeddings, and deferred duplicate merges. It is the middle of the product pipeline:

```text
capture -> enrich -> relate -> recall
Service    Worker     Worker    Service
```

The key architectural choice is that the knowledge domain stays pure. It stores provenance as `EventId`s, never dereferences event payloads, and knows nothing about SQS, Postgres, LLMs, embeddings, or workers. The application layer owns the processing workflow and depends only on ports. Infrastructure adapters implement those ports in `@repo/server-knowledge-infra`, while `apps/server-knowledge-worker` drives the use cases.

## Core Strategy

1. Process events from SQS push, not from a standing cursor.
2. Re-read each event body through an anti-corruption read port.
3. Extract typed entity and relationship candidates from the event body.
4. Resolve candidate entities conservatively into graph nodes.
5. Create or reinforce graph edges from candidate relationships.
6. Record the event effect in a processed-events ledger inside the same transaction as graph writes.
7. Run embeddings and duplicate merges as separate background loops.

The design optimizes for idempotent writes, conservative resolution, clean bounded-context boundaries, and adapter-local future changes.

## Step-by-Step Workflow

### 1. Capture Produces an Event-Entry Message

**What happens:** The ingestion service appends a raw event to the event log and writes an outbox row in the same transaction. An outbox relay publishes an SQS message containing the event identifiers, timestamps, routing metadata, and body.

**How it works:** The outbox table stores relay metadata only. When publishing, the relay joins the immutable `events` row by `eventId` and sends `{ eventId, occurredAt, recordedAt, tags, body }` to SQS. Ingest rejects events whose serialized SQS message would exceed the 256 KiB broker limit.

**Why this strategy:** The queue payload is complete enough for the enrichment hot path, while `events` remains the canonical replay/backfill source and `event_outbox` avoids duplicating large JSON bodies.

### 2. The Knowledge Worker Receives SQS Messages

**What happens:** `apps/server-knowledge-worker` long-polls SQS and invokes the pure application use case:

```ts
EnrichEvents.execute({ eventIds })
```

**How it works:** One recorded event maps to one SQS message. The worker may pass a batch of event ids into `EnrichEvents`. SQS visibility timeout, competing consumers, redelivery, and the DLQ provide delivery mechanics.

**Why this strategy:** SQS gives at-least-once delivery and keeps enrichment reactive without building a custom polling cursor. There is no standing reconcile loop in Phase 0; if a gap is discovered later, the event table can be used for manual backfill or a new driving adapter over the same `EnrichEvents` core.

### 3. Enrichment Reads Event Entries From SQS

**What happens:** The worker maps SQS message JSON into the full event-entry DTO needed for extraction.

**How it works:** The SQS payload already contains a knowledge-owned DTO:

```ts
{
  id,
  occurredAt,
  recordedAt,
  tags,
  body,
}
```

The application layer never imports the ingestion `Event` aggregate. A future backfill adapter can still read `events` rows into the same DTO.

**Why this strategy:** Extraction needs `body`, `tags`, and `occurredAt`, but the domain must still keep event provenance as ids only. The SQS DTO gives the app layer the impure payload it needs without leaking ingestion aggregates inward.

### 4. The Ledger Filters Already-Processed Events

**What happens:** Before applying graph effects, the workflow checks whether each event has already been processed for the current extractor version.

**How it works:** `ProcessedEventLedger.seen(eventId, extractorVersion)` guards writes. The ledger key is:

```text
(eventId, extractorVersion)
```

**Why this strategy:** SQS and the outbox are at-least-once systems, so duplicate deliveries are expected. LLM extraction may also be non-deterministic, so idempotency cannot be based on extracted candidates. Anchoring idempotency on deterministic `eventId` gives exactly-once effect for a given extractor version.

Extractor versioning is intentional: bumping `extractorVersion` causes a ledger miss and allows legitimate reprocessing with improved extraction logic.

### 5. Events Are Ordered by `occurredAt`

**What happens:** The batch is sorted by source event time before relationship writes.

**How it works:** `EnrichEvents` sorts entries by `occurredAt`. When an edge is created or reinforced:

```text
edge.observedAt = entry.occurredAt
```

If an edge is reinforced, the edge keeps the latest observed time.

**Why this strategy:** SQS delivery order is not semantic order. The graph should represent when a fact was observed in the source event, not when the worker happened to receive the message.

### 6. Each Event Resolves to a Graph

**What happens:** The workflow determines which `KnowledgeGraphId` every event belongs to.

**How it works:** `GraphResolution.resolve(entry.tags)` maps tags such as org/workspace metadata to a graph id. Phase 0 uses a single well-known graph by default.

**Why this strategy:** The domain requires `graphId` for every node and edge, but the multi-tenancy model is not fully designed yet. A policy port completes the immediate requirement without hard-coding future tenancy rules into the use case.

### 7. Extraction Converts Opaque Bodies Into Typed Candidates

**What happens:** The event body is converted into candidate nodes and candidate edges.

**How it works:** `EntityExtractorGateway.extract(entry)` returns:

```ts
{
  nodes: CandidateNode[],
  edges: CandidateEdge[],
  extractorVersion,
}
```

Candidate nodes include a closed `NodeType`, canonical body text, and optionally a deterministic `naturalKey`. Candidate edges include local candidate references, a closed `RelationshipType`, and confidence.

Extraction is hybrid:

- Deterministic rules handle known structured sources such as Slack, GitHub, calendar, task, or document shapes.
- LLM structured output handles free text, constrained to the domain vocabularies.

**Why this strategy:** Rules are cheap, deterministic, and best for structural facts. LLMs provide coverage for unknown free text. The gateway enforces the closed vocabulary so the application layer receives typed candidates, not free-form relationship labels.

Important boundary: event provenance is stored as node `eventIds` and edge `sourceEventIds`. The extractor must not emit `DERIVED_FROM` edges to model event provenance. `DERIVED_FROM` is only for node-to-node lineage.

### 8. Candidate Nodes Are Resolved Conservatively

**What happens:** Each candidate entity is classified as an existing node, a new node, or an ambiguous duplicate candidate.

**How it works:** Resolution proceeds in layers:

1. Look up a deterministic natural key, scoped by graph and node type.
2. If there is no key hit, embed the candidate body and query a vector ANN resolution index for similar same-type nodes.
3. Pass the fetched matches into the pure `EntityResolution.classify(...)` domain service.

The classifier returns one of:

```text
Resolved(nodeId)
New
Ambiguous
```

**Why this strategy:** Natural keys are exact and deterministic. Vector similarity catches fuzzy duplicates but can over-merge. Ambiguous cases are not guessed in the hot path; the system prefers temporary fragmentation over irreversible incorrect merges.

### 9. Nodes Are Created or Reinforced

**What happens:** The workflow applies the node-resolution decision.

**How it works:**

- `New` creates a `KnowledgeGraphNode` with `graphId`, `type`, `body`, `eventIds: [entry.id]`, and `embedding: null`.
- `Resolved(nodeId)` loads the node and calls `attachEvents([entry.id], now)`.
- `Ambiguous` creates a new node and queues a `DUPLICATE_OF` relationship for later reconciliation.

**Why this strategy:** Nodes are derived projections of events. Provenance must only grow, and attaching the same event twice must be a no-op. New nodes are born unembedded because embedding is a separate lifecycle phase.

### 10. Candidate Edges Are Created or Reinforced

**What happens:** Candidate relationships become graph edges.

**How it works:** For each candidate edge, the use case resolves local candidate references to actual node ids, then checks for an existing edge with the same graph-scoped triple:

```text
(fromId, toId, relationship)
```

If the triple does not exist, it creates a `KnowledgeGraphEdge`. If the triple already exists, it calls `reinforce(...)`, which unions source event ids, updates confidence, and keeps the latest `observedAt`.

**Why this strategy:** Edge identity is the relationship triple, not the event that asserted it. Re-asserting the same fact should strengthen or refresh the existing edge, not duplicate it.

### 11. Graph Writes and Ledger Writes Commit Together

**What happens:** The workflow saves nodes, edges, and processed-event records atomically.

**How it works:** `UnitOfWork.transaction(...)` exposes a knowledge context:

```ts
{
  nodes,
  edges,
  ledger,
}
```

Inside one transaction, the use case saves changed nodes, saves changed edges, and records ledger rows with status, fact hash, extractor version, and attempts.

**Why this strategy:** At-least-once delivery is only safe if partial effects cannot be committed independently from the ledger. If the worker crashes before commit, there is no graph effect and no ledger row, so redelivery reprocesses cleanly. If it commits, redelivery skips cleanly.

Database constraints still matter: foreign keys prevent dangling edges, and a unique constraint on the edge triple prevents duplicate edge races.

### 12. Failed or Poison Events Do Not Block the Stream

**What happens:** Events that cannot be parsed, extracted, or processed are tracked and eventually parked.

**How it works:** Failures are recorded in the processed-events ledger with status `failed` and an attempt count. SQS redelivers until the configured retry policy sends poison messages to the DLQ.

**Why this strategy:** One malformed or expensive event should not wedge graph processing. The DLQ creates an operational inspection path while keeping the main stream moving.

### 13. Embeddings Run Off the Hot Path

**What happens:** Nodes that need embeddings are processed by a separate `EmbedNodes` use case.

**How it works:** A jittered background loop scans for nodes where embedding is missing or stale:

```ts
EmbedNodes.execute({ limit })
```

The use case batches calls to `EmbeddingGateway.embed(texts, model)`, creates `Embedding` value objects, and calls `node.assignEmbedding(...)`.

Embeddings are needed when:

- a node is newly created with `embedding: null`;
- a node body is revised;
- the graph embedding policy changes model or dimensions.

**Why this strategy:** Embedding calls are expensive, rate-limited, and externally fragile. Keeping them separate means graph construction continues even if the embedding provider is down. The same loop also handles re-embedding.

### 14. Duplicate Merges Run as a Reconciler

**What happens:** Ambiguous resolution results are reconciled later by `MergeDuplicateNodes`.

**How it works:** A jittered loop drains `DUPLICATE_OF` edges:

```ts
MergeDuplicateNodes.execute({ limit })
```

For each duplicate pair, the survivor absorbs duplicate provenance, incident edges are repointed from the duplicate to the survivor, and any edge-triple collisions are reinforced rather than duplicated.

**Why this strategy:** Merging is asynchronous and cross-aggregate. Doing it in the hot path would increase transaction complexity and risk irreversible over-merge decisions. Deferring keeps enrichment conservative while still providing a route to clean up fragmentation.

## End-to-End Pseudocode

```text
EnrichEvents.execute({ entries }):
  for entry in entries sorted by occurredAt:
    graphId = GraphResolution.resolve(entry.tags)
    extraction = EntityExtractorGateway.extract(entry)

    if ProcessedEventLedger.seen(entry.id, extraction.extractorVersion):
      skip entry

    for candidateNode in extraction.nodes:
      keyMatch = nodeRepo.findByNaturalKey(graphId, candidateNode.type, candidateNode.naturalKey)
      vectorMatches = NodeResolutionIndex.findSimilar(...) if no keyMatch
      decision = EntityResolution.classify(candidateNode, matches)

      if decision is New:
        create node with event provenance and no embedding
      if decision is Resolved:
        attach event provenance to existing node
      if decision is Ambiguous:
        create node and create/queue DUPLICATE_OF

    for candidateEdge in extraction.edges:
      existing = edgeRepo.findByTriple(graphId, fromId, toId, relationship)
      if existing:
        reinforce with confidence, source event id, and observedAt
      else:
        create edge with confidence, source event id, and observedAt

  UnitOfWork.transaction:
    save nodes
    save edges
    record processed-event ledger rows
```

## Ports and Responsibilities

| Port | Purpose |
| --- | --- |
| `EventEntry` payload | Carries `{ eventId, occurredAt, recordedAt, tags, body }` from SQS into enrichment. |
| `EntityExtractorGateway` | Convert opaque event bodies into typed node and edge candidates. |
| `GraphResolution` | Map event tags to a `KnowledgeGraphId`. |
| `ProcessedEventLedger` | Provide exactly-once effect per `(eventId, extractorVersion)`. |
| `KnowledgeGraphNodeRepository` | Load, resolve, scan, and save node aggregates. |
| `KnowledgeGraphEdgeRepository` | Load, deduplicate, reinforce, merge, and save edge aggregates. |
| `NodeResolutionIndex` | Find vector-similar same-type nodes for fuzzy resolution. |
| `EmbeddingGateway` | Produce embeddings for node bodies. |
| `UnitOfWork` | Commit graph writes and ledger writes atomically. |

## Implementation Order

1. Land shared domain prerequisites: node mutators, edge reinforcement, domain events, graph embedding policy, and node absorb semantics.
2. Add pure application ports in `packages/server-knowledge/src/application/ports/outbound`.
3. Build `EnrichEvents` with in-memory fakes first, proving new-node creation, repeated-event skips, edge reinforcement, and ledger behavior.
4. Add infrastructure adapters: event-table reader, node/edge repositories, processed-events ledger, unit of work, graph-resolution policy, extractor gateway, and resolution index.
5. Wire the SQS consumer in `apps/server-knowledge-worker`.
6. Add `EmbedNodes` and its jittered worker loop.
7. Add `MergeDuplicateNodes` and its jittered reconciler loop.
8. Add end-to-end tests for SQS redelivery, idempotent graph writes, embedding failure isolation, and duplicate merge collisions.

## Design Tradeoffs to Preserve

- Prefer temporary graph fragmentation over synchronous over-merging.
- Keep event bodies out of the domain; the domain stores event ids only.
- Keep vocabulary enforcement in the extractor adapter, while the domain owns the closed vocabularies.
- Keep embedding off the enrichment hot path.
- Keep graph resolution behind a port until multi-tenancy is fully designed.
- Use the ledger as the primary idempotency guard, with domain-level provenance unions and edge reinforcement as supporting safeguards.
- Keep `@repo/server-knowledge` pure: no database drivers, no worker code, no platform imports beyond allowed kernel/domain dependencies.

## What This Workflow Does Not Cover

- Recall/read-side traversal, ranking, GraphRAG, or `RelationshipGraph` query behavior.
- Full multi-tenant authorization and isolation.
- Advanced entity-resolution systems such as clustering, active learning, or LLM canonicalization.
- Broker topologies beyond the current outbox-to-SQS path.
