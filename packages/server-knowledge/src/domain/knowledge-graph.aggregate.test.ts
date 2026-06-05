import { test, expect } from "bun:test";
import { Tenant } from "@repo/server-kernel";

import { Embedding } from "./embedding.value-object.ts";
import { KnowledgeGraph } from "./knowledge-graph.aggregate.ts";

const now = new Date("2026-01-01T00:00:00Z");
const tenant = Tenant.organization("org1");

const validInput = {
  tenant,
  name: "people",
  embeddingModel: "text-embedding-3-small",
  embeddingDimensions: 1536,
  now,
};

test("KnowledgeGraph.create: given valid input, it should return an ok KnowledgeGraph", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraph.create(validInput);

  // THEN
  expect(result.ok).toBe(true);
});

test("KnowledgeGraph.create: given valid input, it should stamp now as both created-at and updated-at metadata", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraph.create(validInput);

  // THEN
  expect(result.ok && result.value.metadata.createdAt).toEqual(now);
  expect(result.ok && result.value.metadata.updatedAt).toEqual(now);
});

test("KnowledgeGraph.create: given valid input, it should preserve the tenant", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraph.create(validInput);

  // THEN
  expect(result.ok && result.value.tenant).toBe(tenant);
});

test("KnowledgeGraph.create: given a fresh graph, it should mint a distinct id each time", () => {
  // GIVEN / WHEN
  const a = KnowledgeGraph.create(validInput);
  const b = KnowledgeGraph.create(validInput);

  // THEN
  expect(a.ok && b.ok && a.value.id.value).not.toBe(
    b.ok ? b.value.id.value : "",
  );
});

test.each([
  ["a blank name", { name: "   " }],
  ["a blank embedding model", { embeddingModel: "" }],
  ["non-positive embedding dimensions", { embeddingDimensions: 0 }],
  ["non-integer embedding dimensions", { embeddingDimensions: 1.5 }],
])(
  "KnowledgeGraph.create: given %s, it should return an InvalidKnowledgeGraph error",
  (_label, patch) => {
    // GIVEN / WHEN
    const result = KnowledgeGraph.create({ ...validInput, ...patch });

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidKnowledgeGraph");
    expect(result.error.category).toBe("validation");
  },
);

const storedRow = {
  id: "01952d3f-0000-7000-8000-000000000000",
  tenantType: "organization" as const,
  tenantId: "org1",
  name: "people",
  embeddingModel: "text-embedding-3-small",
  embeddingDimensions: 1536,
  createdAt: now,
  updatedAt: new Date("2026-01-03T00:00:00Z"),
};

test("KnowledgeGraph.restore: given a stored row, it should preserve the id and audit timestamps", () => {
  // GIVEN / WHEN
  const graph = KnowledgeGraph.restore(storedRow);

  // THEN
  expect(graph.id.value).toBe(storedRow.id);
  expect(graph.metadata.createdAt).toEqual(storedRow.createdAt);
  expect(graph.metadata.updatedAt).toEqual(storedRow.updatedAt);
});

test("KnowledgeGraph.restore: given a stored row, it should restore the tenant", () => {
  // GIVEN / WHEN
  const graph = KnowledgeGraph.restore(storedRow);

  // THEN
  expect(graph.tenant.equals(tenant)).toBe(true);
});

test("KnowledgeGraph.restore: given a row with a blank name, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => KnowledgeGraph.restore({ ...storedRow, name: "  " })).toThrow();
});

const graph = KnowledgeGraph.restore(storedRow);

test("KnowledgeGraph.accepts: given an embedding matching the graph's model and dimensions, it should return true", () => {
  // GIVEN
  const embedding = Embedding.restore([0.1], "text-embedding-3-small", 1536);

  // WHEN / THEN
  expect(graph.accepts(embedding)).toBe(true);
});

test.each([
  ["a model mismatch", Embedding.restore([0.1], "other-model", 1536)],
  ["a dimension mismatch", Embedding.restore([0.1], "text-embedding-3-small", 768)],
])(
  "KnowledgeGraph.accepts: given %s, it should return false",
  (_label, embedding) => {
    // WHEN / THEN
    expect(graph.accepts(embedding)).toBe(false);
  },
);
