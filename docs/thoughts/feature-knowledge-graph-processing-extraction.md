# Knowledge Graph Processing — Extraction

Sub-document of [`feature-knowledge-graph-processing.md`](./feature-knowledge-graph-processing.md). Covers turning an event entry's **opaque body** into **typed candidates**. Sibling sub-docs: [event consumption](./feature-knowledge-graph-processing-event-consumption.md), [resolution & embedding](./feature-knowledge-graph-processing-resolution.md), [idempotency & consistency](./feature-knowledge-graph-processing-idempotency.md).

---

## 1. Opaque body → typed candidates

The extractor turns an event entry's **opaque** body into **candidates** already typed to the closed vocabulary (`NodeType` / `RelationshipType`, from `@repo/server-knowledge`). It is pure I/O (a model/parse call), so it is an **outbound gateway port** (`EntityExtractorGateway`); the use case never embeds extraction logic.

**Decision: hybrid extraction, routed on `tags`.** `tags` is explicitly _"what the Worker routes on"_ (`feature-event-ingestion.md` §2), and it is the part of the published message that arrives even before the body is re-read (event consumption sub-doc §2):

- **Deterministic rules** for known _structured_ sources (a Slack message, a GitHub PR, a calendar invite). Cheap, exact, **deterministic** — and the only reliable source of _structural_ relationships.
- **LLM structured-output** for _free-text_ bodies, constrained to emit only `NodeType`/`RelationshipType` members.

|                                | Rules (structured sources) | LLM (free-text)   | Hybrid (recommended)                |
| ------------------------------ | -------------------------- | ----------------- | ----------------------------------- |
| **Accuracy on known shapes**   | **High**                   | Medium            | **High**                            |
| **Coverage of unknown shapes** | Low                        | **High**          | **High**                            |
| **Cost / latency**             | **Negligible**             | High              | Pay LLM cost **only** for free-text |
| **Determinism / idempotency**  | **Deterministic**          | Non-deterministic | Deterministic where it matters most |

The non-determinism of the LLM path is what forces the `eventId`-anchored idempotency design — see the [idempotency sub-doc](./feature-knowledge-graph-processing-idempotency.md).

> **Vocabulary is enforced in the gateway adapter, not the orchestrator.** The gateway's _output type_ is already `NodeType`/`RelationshipType`; mapping an un-classifiable relation to `RELATED_TO` (or dropping it) happens **inside the adapter** (e.g. via a structured-output schema/grammar). If the gateway returned free strings and the use case mapped them, vocabulary governance would leak into the application layer. The closed vocabulary is the domain's contract; the adapter honors it.

---

## 2. Where the typed relationships come from

A mapping the doc makes explicit so adapters stay consistent. The `RelationshipType` values below are the ones the domain ships (`relationship-type.value-object.ts`).

| Source signal                       | Candidate relationship               | Notes                                      |
| ----------------------------------- | ------------------------------------ | ------------------------------------------ |
| message `author` field              | `AUTHORED_BY` / `SENT_BY`            | Deterministic, from structured metadata.   |
| thread `parent`/`in_reply_to`       | `REPLIES_TO`                         | Deterministic.                             |
| document → its section/attachment   | `PART_OF`                            | Deterministic structural composition.      |
| task `assignee`                     | `ASSIGNED_TO`                        | Deterministic.                             |
| free-text naming a person/org/topic | `MENTIONS`, `INVOLVES`, `RELATED_TO` | LLM; default to the weakest accurate type. |
| explicit "see also" / citation      | `REFERENCES`                         | Either, depending on source.               |

> **Do not conflate `DERIVED_FROM` with `eventIds` provenance.** A node's link back to the **events** that justify it is the node's `eventIds` set (`KnowledgeGraphNode`) — **not** an edge. `DERIVED_FROM` is a **node→node** lineage edge (e.g. a summary node derived from a document node). The extractor must keep these separate; emitting `DERIVED_FROM` edges to represent event provenance would double-model the data and corrupt traversal. This is the one hard boundary the domain set, and the application layer honors it.

---

## 3. Outbound port

```ts
// entity-extractor.gateway.ts — opaque body → candidates already typed to the closed vocab
export interface CandidateNode {
  type: NodeType;
  body: string;
  naturalKey?: string; // e.g. canonical email/handle — feeds deterministic resolution
}
export interface CandidateRef {
  // how a candidate edge points at a candidate node within one extraction
  ref: string; // local id within this ExtractionResult
}
export interface CandidateEdge {
  from: CandidateRef;
  to: CandidateRef;
  relationship: RelationshipType;
  confidence: number;
}
export interface ExtractionResult {
  nodes: CandidateNode[];
  edges: CandidateEdge[];
  extractorVersion: string; // bumped per logic/prompt/model change — see idempotency sub-doc
}
export interface EntityExtractorGateway {
  extract(entry: EventEntry): Promise<ExtractionResult>; // vocabulary enforced in the adapter
}
```

`extractorVersion` is returned by the gateway, not hard-coded in the use case: bumping it makes the processed-events ledger miss and legitimately reprocesses events under the better extractor (idempotency sub-doc). `naturalKey` and `body` are the inputs to node-body canonicalization and resolution (resolution sub-doc) — the same text drives both the embedding and the natural key, so the adapter's canonicalization choices govern over/under-merge.
</content>
