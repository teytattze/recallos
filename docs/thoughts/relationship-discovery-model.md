# Relationship Discovery Model

## Goal

Find related graph nodes and connect them with validated edges.

The system should support both deterministic and non-deterministic relationship discovery.

| Type              | Meaning                                                                       | Example                                      |
| ----------------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| Deterministic     | Explicit, reliable relationship from metadata, IDs, or strong rules           | Commit message contains `PAY-456`            |
| Non-deterministic | Probabilistic relationship inferred from similarity, context, or model output | Slack thread appears related to a Jira issue |

---

## High-Level Flow

```text
SourceDocument
  ↓
Extract references + features
  ↓
Search candidate nodes
  ↓
Score candidate relationships
  ↓
Create edge candidates
  ↓
Validate against graph schema
  ↓
Promote accepted candidates to edges
```

---

## Core Collections

```text
nodes
edges
edge_candidates
entity_aliases
```

---

## Core Types

### Graph Node

```ts
type GraphNode = {
  id: string;
  type: NodeType;
  content: string;
  properties: Record<string, unknown>;
  provenance: Provenance;
};
```

### Edge Candidate

```ts
type GraphEdgeCandidate = {
  id: string;
  fromId: string;
  toId: string;
  relationship: RelationshipType;

  confidence: number;
  deterministic: boolean;
  method: RelationshipDiscoveryMethod;
  status: "accepted" | "needs_review" | "rejected";

  evidence: Evidence[];
};
```

### Graph Edge

```ts
type GraphEdge = {
  id: string;
  fromId: string;
  toId: string;
  relationship: RelationshipType;

  confidence: number;
  methods: RelationshipDiscoveryMethod[];
  evidence: Evidence[];
  provenance: Provenance;
};
```

---

## Deterministic Discovery

Deterministic relationships come from explicit metadata, IDs, or reliable rules.

### Common Examples

| Signal                     | Edge                                   |
| -------------------------- | -------------------------------------- |
| Commit author metadata     | `Person AUTHORED Commit`               |
| Slack message author       | `Person AUTHORED DiscussionMessage`    |
| Git diff metadata          | `Commit MODIFIES File`                 |
| PR commit list             | `PullRequest CONTAINS Commit`          |
| Jira key in commit message | `Commit FIXES WorkItem`                |
| Jira key in PR title/body  | `PullRequest RELATES_TO WorkItem`      |
| Jira key in Slack message  | `DiscussionMessage DISCUSSES WorkItem` |
| File belongs to repo       | `File BELONGS_TO Repository`           |

### Reference Extraction

```ts
const JIRA_KEY_REGEX = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const GIT_SHA_REGEX = /\b[0-9a-f]{7,40}\b/g;
const PR_REF_REGEX = /(?:#|PR\s*)(\d+)/gi;
```

### Deterministic Search Patterns

```text
Search by canonical ID
Search by unique property
Search by alias
Search within scoped context
```

Examples:

```ts
await nodes.findOne({
  type: "WorkItem",
  "properties.key": "PAY-456",
});
```

```ts
await nodes.findOne({
  type: "PullRequest",
  "properties.repo": "company/payments",
  "properties.number": 183,
});
```

### Deterministic Edge Example

```json
{
  "fromId": "git:commit:abc123",
  "toId": "jira:PAY-456",
  "relationship": "FIXES",
  "confidence": 1.0,
  "deterministic": true,
  "method": "explicit-id-reference",
  "status": "accepted",
  "evidence": [
    {
      "kind": "text_span",
      "sourceDocumentId": "git:commit:abc123",
      "field": "message",
      "value": "Fix PAY-456 checkout retry timeout"
    }
  ]
}
```

---

## Non-Deterministic Discovery

Non-deterministic relationships are inferred from weak or indirect signals.

Use them to create **edge candidates**, not unquestioned facts.

### Common Examples

| Inference                                  | Safer Edge                                 |
| ------------------------------------------ | ------------------------------------------ |
| Slack thread appears related to Jira issue | `DiscussionMessage RELATED_TO WorkItem`    |
| Commit message resembles Jira title        | `Commit RELATED_TO WorkItem`               |
| PR likely implements a feature             | `PullRequest POSSIBLY_IMPLEMENTS WorkItem` |
| Incident may have been caused by commit    | `Incident POSSIBLY_CAUSED_BY Commit`       |
| Two people may be the same                 | `MergeCandidate`, not `SAME_AS`            |

---

## Candidate Search Methods

### 1. Lexical Search

Search by tokens, titles, names, and keywords.

```text
checkout retry timeout auth redirect
```

Good for:

```text
Jira titles
PR descriptions
Slack messages
File paths
Service names
```

---

### 2. Vector Similarity Search

Embed text-heavy nodes and search by semantic similarity.

Useful for:

```text
Slack thread ↔ Jira issue
PR description ↔ WorkItem
Incident report ↔ Commit/PR
README/code summary ↔ Service/File
```

---

### 3. Hybrid Search

Combine:

```text
text search
vector similarity
time proximity
actor overlap
project/repo/channel context
graph proximity
```

Recommended scoring shape:

```text
0.35 semantic similarity
0.25 lexical similarity
0.15 time proximity
0.10 actor overlap
0.10 source context match
0.05 graph proximity
```

---

### 4. Temporal Proximity

Events close in time may be related.

Useful but never sufficient alone.

Example:

```text
Slack complaint at 10:03
Jira bug created at 10:15
Commit fix at 11:40
```

---

### 5. Actor Overlap

Boost relationships when the same people appear across artifacts.

Examples:

```text
same author
same assignee
same reviewer
same Slack participant
same committer
```

---

### 6. Graph Inference

Infer relationships from existing paths.

Example existing graph:

```text
Commit FIXES WorkItem
Commit MODIFIES File
```

Possible inferred relationship:

```text
WorkItem AFFECTS File
```

Evidence path:

```text
WorkItem <-[:FIXES]- Commit -[:MODIFIES]-> File
```

For MVP, compute many inferred relationships at query time instead of materializing them.

---

### 7. LLM Extraction

Use LLMs for relationships requiring interpretation.

Examples:

```text
DiscussionThread IDENTIFIES Incident
Incident AFFECTS Service
Decision RELATES_TO PullRequest
WorkItem BLOCKED_BY WorkItem
```

LLMs should produce edge candidates, not directly write final graph edges.

---

## Confidence and Status

Each edge candidate should have:

```text
confidence
method
evidence
deterministic flag
status
```

Recommended statuses:

```text
accepted
needs_review
rejected
```

### Example Thresholds

```ts
const RELATIONSHIP_THRESHOLDS = {
  DISCUSSES: {
    accept: 0.75,
    review: 0.55,
  },
  RELATED_TO: {
    accept: 0.8,
    review: 0.6,
  },
  POSSIBLY_CAUSED_BY: {
    accept: 0.9,
    review: 0.7,
  },
  SAME_AS: {
    accept: 0.95,
    review: 0.8,
  },
};
```

---

## Evidence Model

Every edge should explain why it exists.

```ts
type Evidence =
  | {
      kind: "text_span";
      sourceDocumentId: string;
      field: string;
      value: string;
      start?: number;
      end?: number;
    }
  | {
      kind: "metadata";
      sourceDocumentId: string;
      field: string;
      value: unknown;
    }
  | {
      kind: "similarity";
      score: number;
      queryText: string;
      matchedText: string;
    }
  | {
      kind: "graph_path";
      path: string[];
    }
  | {
      kind: "llm_reason";
      model: string;
      promptVersion: string;
      explanation: string;
    };
```

---

## Discovery Methods

```ts
type RelationshipDiscoveryMethod =
  | "source-metadata"
  | "explicit-id-reference"
  | "regex-reference"
  | "alias-match"
  | "code-parser"
  | "text-search"
  | "embedding-search"
  | "hybrid-search"
  | "graph-inference"
  | "llm-extraction"
  | "human-review";
```

---

## Relationship Validation

Before promoting an edge candidate into `edges`, validate:

```text
fromId exists
toId exists
relationship is allowed
node type pair is allowed
confidence meets threshold
relationship direction is correct
edge does not already exist
visibility/access rules allow it
```

Example allowed schema:

```ts
const ALLOWED_RELATIONSHIPS = [
  {
    from: "Commit",
    relationship: "FIXES",
    to: "WorkItem",
  },
  {
    from: "PullRequest",
    relationship: "RELATES_TO",
    to: "WorkItem",
  },
  {
    from: "DiscussionMessage",
    relationship: "DISCUSSES",
    to: "WorkItem",
  },
  {
    from: "Commit",
    relationship: "MODIFIES",
    to: "File",
  },
  {
    from: "Person",
    relationship: "AUTHORED",
    to: "Commit",
  },
];
```

---

## Edge Direction Rules

Pick one canonical direction.

Recommended:

```text
Person AUTHORED Commit
Person AUTHORED DiscussionMessage
Commit MODIFIES File
Commit FIXES WorkItem
PullRequest RELATES_TO WorkItem
DiscussionMessage DISCUSSES WorkItem
File BELONGS_TO Repository
```

Avoid storing both directions:

```text
Commit FIXES WorkItem
WorkItem FIXED_BY Commit
```

Query incoming edges instead.

---

## Idempotent Edge IDs

Use deterministic edge IDs.

```ts
function edgeId(fromId: string, relationship: string, toId: string): string {
  return `${fromId}|${relationship}|${toId}`;
}
```

If multiple methods find the same edge, merge evidence:

```json
{
  "_id": "git:commit:abc123|FIXES|jira:PAY-456",
  "fromId": "git:commit:abc123",
  "toId": "jira:PAY-456",
  "relationship": "FIXES",
  "confidence": 1.0,
  "methods": ["jira-key-in-commit-message", "jira-key-in-branch-name"],
  "evidence": [
    {
      "kind": "text_span",
      "value": "Fix PAY-456"
    },
    {
      "kind": "metadata",
      "field": "branch",
      "value": "feature/PAY-456-retry-timeout"
    }
  ]
}
```

---

## MongoDB Collections

### `edge_candidates`

```json
{
  "_id": "candidate:slack:C123:1719231234|DISCUSSES|jira:PAY-456",
  "fromId": "slack:message:C123:1719231234.000100",
  "toId": "jira:PAY-456",
  "relationship": "DISCUSSES",

  "confidence": 0.76,
  "deterministic": false,
  "method": "hybrid-search",
  "status": "accepted",

  "evidence": [
    {
      "kind": "keyword_overlap",
      "terms": ["retry", "timeout", "checkout"]
    }
  ],

  "createdAt": "2026-06-07T12:00:00Z",
  "evaluatedAt": "2026-06-07T12:00:03Z"
}
```

### `edges`

```json
{
  "_id": "slack:message:C123:1719231234.000100|DISCUSSES|jira:PAY-456",
  "fromId": "slack:message:C123:1719231234.000100",
  "toId": "jira:PAY-456",
  "relationship": "DISCUSSES",

  "confidence": 0.76,
  "methods": ["hybrid-search"],
  "evidence": [
    {
      "kind": "keyword_overlap",
      "terms": ["retry", "timeout", "checkout"]
    }
  ],

  "createdAt": "2026-06-07T12:00:00Z"
}
```

---

## MongoDB Indexes

### `nodes`

```js
db.nodes.createIndex({ type: 1 });
db.nodes.createIndex({ source: 1 });
db.nodes.createIndex({ "properties.key": 1 });
db.nodes.createIndex({ "properties.email": 1 });
db.nodes.createIndex({ "properties.repo": 1, "properties.number": 1 });
db.nodes.createIndex({ "properties.sha": 1 });
db.nodes.createIndex({ "properties.path": 1 });
db.nodes.createIndex({ "properties.createdAt": -1 });

db.nodes.createIndex({
  content: "text",
  "properties.title": "text",
  "properties.description": "text",
  "properties.name": "text",
  "properties.path": "text",
});
```

### `edges`

```js
db.edges.createIndex({ fromId: 1 });
db.edges.createIndex({ toId: 1 });
db.edges.createIndex({ relationship: 1 });
db.edges.createIndex({ fromId: 1, relationship: 1 });
db.edges.createIndex({ toId: 1, relationship: 1 });

db.edges.createIndex({ fromId: 1, relationship: 1, toId: 1 }, { unique: true });
```

### `edge_candidates`

```js
db.edge_candidates.createIndex({ fromId: 1 });
db.edge_candidates.createIndex({ toId: 1 });
db.edge_candidates.createIndex({ relationship: 1 });
db.edge_candidates.createIndex({ status: 1, confidence: -1 });
db.edge_candidates.createIndex({ deterministic: 1 });

db.edge_candidates.createIndex(
  { fromId: 1, relationship: 1, toId: 1, method: 1 },
  { unique: true },
);
```

---

## Recommended MVP Order

### Phase 1: Deterministic Metadata Edges

```text
Person AUTHORED Commit
Person AUTHORED DiscussionMessage
Person CREATED PullRequest
Commit MODIFIES File
Commit BELONGS_TO Repository
PullRequest CONTAINS Commit
PullRequest BELONGS_TO Repository
DiscussionMessage BELONGS_TO Channel
DiscussionMessage REPLIES_TO DiscussionMessage
```

### Phase 2: Explicit Reference Edges

```text
Commit FIXES WorkItem
PullRequest RELATES_TO WorkItem
DiscussionMessage DISCUSSES WorkItem
JiraComment MENTIONS Commit
WorkItem RELATES_TO WorkItem
```

### Phase 3: Non-Deterministic Candidates

```text
DiscussionMessage RELATED_TO WorkItem
PullRequest RELATED_TO WorkItem
Commit RELATED_TO WorkItem
Incident POSSIBLY_CAUSED_BY Commit
```

### Phase 4: Graph Inference

```text
WorkItem AFFECTS File
Person HAS_CONTEXT_ON WorkItem
Person HAS_CONTEXT_ON File
Repository CONTAINS File
```

### Phase 5: LLM Extraction

```text
DiscussionThread IDENTIFIES Incident
Incident AFFECTS Service
Decision RELATES_TO PullRequest
WorkItem BLOCKED_BY WorkItem
```

---

## Practical Rule

```text
Deterministic relationships become trusted graph edges.

Non-deterministic relationships become edge candidates first.

Only validated, high-confidence candidates are promoted to graph edges.
```

---

## Summary

The relationship discovery model should work like this:

```text
1. Extract explicit references and features from each source document.
2. Search candidate nodes using IDs, properties, aliases, text search, vector search, and graph context.
3. Score each possible relationship.
4. Store the result as an edge candidate.
5. Validate the candidate against schema and confidence thresholds.
6. Promote accepted candidates to edges.
7. Keep evidence, method, and confidence on every edge.
```
