import { type Clock, type DomainEvent, fixedClock } from "@repo/server-kernel";
import { expect, test } from "bun:test";

import type { NodeId } from "../../domain/node-id.value-object.ts";
import type { NodeType } from "../../domain/node-type.value-object.ts";
import type { RelationshipType } from "../../domain/relationship-type.value-object.ts";
import type { Checkpoint } from "../ports/outbound/checkpoint.store.ts";
import type {
  EntityExtractorGateway,
  ExtractionResult,
} from "../ports/outbound/entity-extractor.gateway.ts";
import type { EventEntry } from "../ports/outbound/event-source.reader.ts";

import { EventId } from "../../domain/event-id.value-object.ts";
import { KnowledgeGraphEdge } from "../../domain/knowledge-graph-edge.aggregate.ts";
import { KnowledgeGraphId } from "../../domain/knowledge-graph-id.value-object.ts";
import { KnowledgeGraphNode } from "../../domain/knowledge-graph-node.aggregate.ts";
import { EnrichEventsUseCase } from "./enrich-events.use-case.ts";

const GRAPH_ID = KnowledgeGraphId.create();
const clock: Clock = fixedClock(new Date("2026-05-29T00:00:00Z"));

function entry(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    id: EventId.create(),
    recordedAt: new Date("2026-05-01T00:00:00Z"),
    occurredAt: new Date("2026-04-01T00:00:00Z"),
    tags: { source: "slack" },
    body: { text: "hello" },
    ...overrides,
  };
}

class FakeNodeRepo {
  readonly byId = new Map<string, KnowledgeGraphNode>();
  private readonly byKey = new Map<string, KnowledgeGraphNode>();

  async findById(id: NodeId) {
    return this.byId.get(id.value) ?? null;
  }
  async findByIds(ids: NodeId[]) {
    return ids
      .map((id) => this.byId.get(id.value))
      .filter((n): n is KnowledgeGraphNode => n !== undefined);
  }
  async findByNaturalKey(
    graphId: KnowledgeGraphId,
    type: NodeType,
    key: string,
  ) {
    return this.byKey.get(`${graphId.value}:${type}:${key}`) ?? null;
  }
  async findNeedingEmbedding() {
    return [];
  }
  async saveMany(nodes: KnowledgeGraphNode[]) {
    for (const node of nodes) {
      this.byId.set(node.id.value, node);
      // The test treats the body text as the resolution key.
      this.byKey.set(
        `${node.graphId.value}:${node.type}:${node.body.value}`,
        node,
      );
    }
  }
}

class FakeEdgeRepo {
  readonly byTriple = new Map<string, KnowledgeGraphEdge>();

  async findByTriple(
    graphId: KnowledgeGraphId,
    fromId: NodeId,
    toId: NodeId,
    relationship: RelationshipType,
  ) {
    return (
      this.byTriple.get(
        `${graphId.value}:${fromId.value}:${toId.value}:${relationship}`,
      ) ?? null
    );
  }
  async findByRelationship() {
    return [];
  }
  async saveMany(edges: KnowledgeGraphEdge[]) {
    for (const edge of edges) {
      this.byTriple.set(
        `${edge.graphId.value}:${edge.fromId.value}:${edge.toId.value}:${edge.relationship}`,
        edge,
      );
    }
  }
  async repointIncidentEdges() {}
  async deleteMany() {}
}

class FakeLedger {
  readonly seenKeys = new Set<string>();
  readonly records: string[] = [];

  async seen(eventId: EventId, version: string) {
    return this.seenKeys.has(`${eventId.value}:${version}`);
  }
  async record(eventId: EventId, version: string) {
    this.records.push(`${eventId.value}:${version}`);
    this.seenKeys.add(`${eventId.value}:${version}`);
  }
}

class FakeCheckpoints {
  cursor: Checkpoint = {
    recordedAt: new Date(0),
    lastEventId: EventId.restore("00000000-0000-7000-8000-000000000000"),
  };
  async load() {
    return this.cursor;
  }
  async save(_name: string, cursor: Checkpoint) {
    this.cursor = cursor;
  }
}

class FakePublisher {
  readonly published: DomainEvent[] = [];
  async publish(events: readonly DomainEvent[]) {
    this.published.push(...events);
  }
}

const uow = { run: <T>(work: () => Promise<T>) => work() };
const graphResolution = { resolve: () => GRAPH_ID };

function fixedExtractor(result: ExtractionResult): EntityExtractorGateway {
  return { extract: async () => result };
}

function buildUseCase(
  extractor: EntityExtractorGateway,
  page: EventEntry[],
  deps: {
    nodes?: FakeNodeRepo;
    edges?: FakeEdgeRepo;
    ledger?: FakeLedger;
    checkpoints?: FakeCheckpoints;
    publisher?: FakePublisher;
  } = {},
) {
  const nodes = deps.nodes ?? new FakeNodeRepo();
  const edges = deps.edges ?? new FakeEdgeRepo();
  const ledger = deps.ledger ?? new FakeLedger();
  const checkpoints = deps.checkpoints ?? new FakeCheckpoints();
  const publisher = deps.publisher ?? new FakePublisher();
  const events = { readSince: async () => page };

  const useCase = new EnrichEventsUseCase(
    events,
    extractor,
    nodes,
    edges,
    graphResolution,
    ledger,
    checkpoints,
    publisher,
    uow,
    clock,
  );
  return { useCase, nodes, edges, ledger, checkpoints, publisher };
}

const personExtraction: ExtractionResult = {
  extractorVersion: "v1",
  nodes: [
    { ref: "a", type: "PERSON", body: "Ada", naturalKey: "Ada" },
    { ref: "b", type: "DOCUMENT", body: "Doc", naturalKey: "Doc" },
  ],
  edges: [{ from: "a", to: "b", relationship: "AUTHORED_BY", confidence: 0.9 }],
};

test("EnrichEventsUseCase.execute: given an empty page, it should return a no-op report", async () => {
  // GIVEN
  const { useCase } = buildUseCase(fixedExtractor(personExtraction), []);

  // WHEN
  const result = await useCase.execute({ batchSize: 10 });

  // THEN
  expect(result.ok && result.value.pulled).toBe(0);
  expect(result.ok && result.value.processed).toBe(0);
});

test("EnrichEventsUseCase.execute: given a new event, it should create nodes and an edge", async () => {
  // GIVEN
  const { useCase, nodes, edges } = buildUseCase(
    fixedExtractor(personExtraction),
    [entry()],
  );

  // WHEN
  const result = await useCase.execute({ batchSize: 10 });

  // THEN
  expect(result.ok && result.value.processed).toBe(1);
  expect(result.ok && result.value.nodesUpserted).toBe(2);
  expect(result.ok && result.value.edgesWritten).toBe(1);
  expect(nodes.byId.size).toBe(2);
  expect(edges.byTriple.size).toBe(1);
});

test("EnrichEventsUseCase.execute: given a processed run, it should advance the cursor to the last recordedAt", async () => {
  // GIVEN
  const recordedAt = new Date("2026-05-10T00:00:00Z");
  const { useCase, checkpoints } = buildUseCase(
    fixedExtractor(personExtraction),
    [entry({ recordedAt })],
  );

  // WHEN
  await useCase.execute({ batchSize: 10 });

  // THEN
  expect(checkpoints.cursor.recordedAt).toEqual(recordedAt);
});

test("EnrichEventsUseCase.execute: given an event already in the ledger, it should skip it", async () => {
  // GIVEN
  const ledger = new FakeLedger();
  const seenEntry = entry();
  ledger.seenKeys.add(`${seenEntry.id.value}:v1`);
  const { useCase, nodes } = buildUseCase(
    fixedExtractor(personExtraction),
    [seenEntry],
    { ledger },
  );

  // WHEN
  const result = await useCase.execute({ batchSize: 10 });

  // THEN
  expect(result.ok && result.value.skipped).toBe(1);
  expect(result.ok && result.value.processed).toBe(0);
  expect(nodes.byId.size).toBe(0);
});

test("EnrichEventsUseCase.execute: given two events about the same entity, it should resolve to one node", async () => {
  // GIVEN — two events, same PERSON natural key
  const extraction: ExtractionResult = {
    extractorVersion: "v1",
    nodes: [{ ref: "a", type: "PERSON", body: "Ada", naturalKey: "Ada" }],
    edges: [],
  };
  const { useCase, nodes } = buildUseCase(fixedExtractor(extraction), [
    entry(),
    entry(),
  ]);

  // WHEN
  const result = await useCase.execute({ batchSize: 10 });

  // THEN
  expect(nodes.byId.size).toBe(1);
  const [node] = [...nodes.byId.values()];
  expect(node!.eventIds.length).toBe(2);
  expect(result.ok && result.value.processed).toBe(2);
});

test("EnrichEventsUseCase.execute: given a poison event, it should fail it and still advance the cursor", async () => {
  // GIVEN — an extractor that throws
  const recordedAt = new Date("2026-05-20T00:00:00Z");
  const throwingExtractor: EntityExtractorGateway = {
    extract: async () => {
      throw new Error("cannot parse");
    },
  };
  const { useCase, checkpoints, nodes } = buildUseCase(throwingExtractor, [
    entry({ recordedAt }),
  ]);

  // WHEN
  const result = await useCase.execute({ batchSize: 10 });

  // THEN
  expect(result.ok && result.value.failed).toBe(1);
  expect(nodes.byId.size).toBe(0);
  expect(checkpoints.cursor.recordedAt).toEqual(recordedAt);
});

test("EnrichEventsUseCase.execute: given a re-asserted edge, it should reinforce instead of duplicating", async () => {
  // GIVEN — a pre-existing node + edge graph; a new event re-asserts the edge
  const nodes = new FakeNodeRepo();
  const edges = new FakeEdgeRepo();
  const from = KnowledgeGraphNode.create({
    graphId: GRAPH_ID,
    type: "PERSON",
    body: "Ada",
    eventIds: [EventId.create()],
    now: clock.now(),
  });
  const to = KnowledgeGraphNode.create({
    graphId: GRAPH_ID,
    type: "DOCUMENT",
    body: "Doc",
    eventIds: [EventId.create()],
    now: clock.now(),
  });
  if (!from.ok || !to.ok) throw new Error("setup failed");
  await nodes.saveMany([from.value, to.value]);
  const existingEdge = KnowledgeGraphEdge.create({
    graphId: GRAPH_ID,
    fromId: from.value.id,
    toId: to.value.id,
    relationship: "AUTHORED_BY",
    confidence: 0.5,
    sourceEventIds: [EventId.create()],
    observedAt: new Date("2026-01-01T00:00:00Z"),
    now: clock.now(),
  });
  if (!existingEdge.ok) throw new Error("setup failed");
  await edges.saveMany([existingEdge.value]);

  const { useCase } = buildUseCase(
    fixedExtractor(personExtraction),
    [entry()],
    {
      nodes,
      edges,
    },
  );

  // WHEN
  const result = await useCase.execute({ batchSize: 10 });

  // THEN — still one edge, now with grown provenance
  expect(edges.byTriple.size).toBe(1);
  expect(existingEdge.value.sourceEventIds.length).toBe(2);
  expect(result.ok && result.value.edgesWritten).toBe(1);
});
