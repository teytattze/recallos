# Knowledge Graph Processing — Entity Resolution & Embedding

Sub-document of [`feature-knowledge-graph-processing.md`](./feature-knowledge-graph-processing.md). Covers deciding a candidate entity **is** an existing node, the embedding lifecycle, and node-body canonicalization. Sibling sub-docs: [event consumption](./feature-knowledge-graph-processing-event-consumption.md), [extraction](./feature-knowledge-graph-processing-extraction.md), [idempotency & consistency](./feature-knowledge-graph-processing-idempotency.md).

---

## 1. Entity resolution / dedup

The hardest stage: deciding a candidate entity **is** an existing node. **Decision: a conservative hybrid with deferred merge**, and a clean **split of responsibility** between an I/O port and a pure decision.

1. **Deterministic natural key first.** Normalize `(type, key)` (e.g. `PERSON` + canonical email/handle) and look it up via `KnowledgeGraphNodeRepository.findByNaturalKey`. Exact, cheap, deterministic.
2. **Vector ANN second.** If no key hit, embed the candidate body and ask the resolution index for similar same-type nodes above a threshold.
3. **Defer the hard cases.** If matches are ambiguous (near-threshold, multiple plausible), **do not guess in the hot path** — create the node _and_ record a `DUPLICATE_OF` candidate that `MergeDuplicateNodes` reconciles later (reusing the domain's `mergeNodes`). Provenance is never lost (`eventIds` only grow), so deferring is safe.

**Port vs domain service — split by responsibility** (mirroring how `GraphRelation.relate` takes already-loaded aggregates):

- The **I/O** — natural-key lookup, ANN search — is an outbound port (`NodeResolutionIndex` + repo lookups).
- The **decision** — _"this candidate is `Resolved(nodeId)` / `New` / `Ambiguous`"_ — is a **pure domain service** `EntityResolution.classify(candidate, matches)`, operating on already-fetched matches. This keeps the _threshold policy_ pure and unit-testable instead of buried in an adapter. It is the one new pure type this layer adds to the domain (`entity-resolution.domain-service.ts`).

| Strategy                             | Pro                                                                                    | Con                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Deterministic key only               | Fast, deterministic, no model cost                                                     | Misses fuzzy duplicates ("Alice" vs "Alice Smith") → fragmentation        |
| Vector similarity only               | Catches fuzzy duplicates                                                               | Threshold tuning; risk of **over-merging** distinct entities; model cost |
| LLM canonicalization                 | Highest recall                                                                         | Cost, latency, non-determinism, hardest to make idempotent               |
| **Hybrid + deferred merge (chosen)** | Deterministic where possible, fuzzy where needed, **never over-merges synchronously** | Two passes; the merge backlog must be drained                            |

The bias is **conservative**: prefer transient fragmentation (fixable by a later merge) over irreversible over-merging in the hot path.

---

## 2. Re-embedding & the `EmbedNodes` lifecycle

Embedding is split out of `EnrichEvents` because the domain treats it as a distinct lifecycle phase, not a one-shot at birth (parent doc §4). The built `KnowledgeGraphNode.create` confirms this — it always sets `embedding: null`.

|                        | Embedding split into `EmbedNodes`                                                                                          | Embedding inline in `EnrichEvents`                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Domain signal**      | Embedding is **optional at birth**, assigned later via `assignEmbedding`, recording a _separate_ `NodeEmbedded` event.    | Fights the domain — forces a node to be born embedded.    |
| **Failure isolation**  | An embedding-API outage **does not block graph construction**; nodes are born `embedding: null` and embedded on the next run. | An embedding outage wedges the whole enrichment run.      |
| **Cost / rate limits** | The most expensive, most rate-limited call is isolated and independently retriable/batchable.                             | Couples graph mutation throughput to embedding throughput. |
| **Reuse**              | The same job handles **re-embedding** on body revision / model change (below).                                            | Re-embedding needs separate plumbing anyway.              |

**`EmbedNodes` triggers** — embedding is not a one-shot at birth:

1. **New node** — born with `embedding: null`; embed it. In Phase 0 the job simply scans for nodes where `embedding IS NULL` on its own jittered loop (ADR [`20260529`](../../decision-records/server/20260529-in-process-sleep-jitter-worker-trigger.md)) — no event bus required. (A `NodeCreated` domain-event trigger is a later graduation once a KG-side publisher exists.)
2. **Body revised** — `reviseBody` changes the canonical text, so the existing embedding is **stale**; re-embed.
3. **Model drift** — a node whose embedding model ≠ the graph's policy model (`KnowledgeGraph.accepts` returns false) must be **re-embedded** to satisfy the graph-wide embedding policy. (`KnowledgeGraph` carries `embeddingModel` + `embeddingDimensions`.)

---

## 3. Node body canonicalization

**Node body canonicalization is a real decision, not a detail.** The `NodeBody` text drives _both_ the embedding _and_ the natural key for resolution (§1) — so it silently governs over/under-merge. ("Alice", "alice@corp", "Alice Smith" → one node or three?)

**Decision: a conservative Phase-0 canonicalization policy** at the extractor/resolution boundary — trim, case-fold, prefer a stable identifier (email/handle) as the `naturalKey` when present, and keep a human-readable display `body`. Make it explicit so fragmentation is a tuning knob, not an accident. (`NodeBody` enforces 1–10,000 trimmed chars; canonicalization is policy layered above that, not a domain invariant.)

---

## 4. Outbound ports

```ts
// embedding.gateway.ts
export interface EmbeddingGateway {
  embed(texts: string[], model: string): Promise<number[][]>; // batched
}

// node-resolution.index.ts — ANN over node embeddings (may share the pgvector adapter)
export interface NodeMatch {
  id: NodeId;
  score: number;
}
export interface NodeResolutionIndex {
  findSimilar(
    graphId: KnowledgeGraphId,
    type: NodeType,
    vector: number[],
    threshold: number,
    k: number,
  ): Promise<NodeMatch[]>;
}

// knowledge-graph-node.repository.ts
export interface KnowledgeGraphNodeRepository {
  findById(id: NodeId): Promise<KnowledgeGraphNode | null>;
  findByNaturalKey(
    graphId: KnowledgeGraphId,
    type: NodeType,
    key: string,
  ): Promise<KnowledgeGraphNode | null>;
  findNeedingEmbedding(model: string, limit: number): Promise<KnowledgeGraphNode[]>; // EmbedNodes scan
  saveMany(nodes: KnowledgeGraphNode[]): Promise<void>;
}

// knowledge-graph-edge.repository.ts
export interface KnowledgeGraphEdgeRepository {
  findByTriple(
    graphId: KnowledgeGraphId,
    fromId: NodeId,
    toId: NodeId,
    rel: RelationshipType,
  ): Promise<KnowledgeGraphEdge | null>;
  findDuplicateOf(limit: number): Promise<KnowledgeGraphEdge[]>; // MergeDuplicateNodes drain
  saveMany(edges: KnowledgeGraphEdge[]): Promise<void>;
  repointIncidentEdges(from: NodeId, to: NodeId): Promise<void>; // for merge
}
```

The node/edge repositories are also enlisted in the transactional write of the main enrichment flow — see the [idempotency & consistency sub-doc](./feature-knowledge-graph-processing-idempotency.md) for the unit-of-work that wraps `saveMany` + ledger + checkpoint.

## 5. Inbound (driving) ports

```ts
// embed-nodes.use-case.ts
export interface EmbedNodes {
  execute(input: { nodeIds?: NodeId[]; limit: number }): Promise<Result<void>>;
}

// merge-duplicate-nodes.use-case.ts
export interface MergeDuplicateNodes {
  execute(input: { limit: number }): Promise<Result<void>>;
}
```

`EmbedNodes` with no `nodeIds` scans `findNeedingEmbedding` (the Phase-0 trigger); with `nodeIds` it targets a specific set (e.g. after `reviseBody`). `MergeDuplicateNodes` drains `findDuplicateOf`, folds provenance into the survivor via `attachEvents`, and re-points incident edges — one cross-aggregate transaction per merge.
</content>
