import { EntityMetadata, Tenant } from "@repo/server-kernel";
import { test, expect } from "bun:test";

import { Embedding } from "../value-objects/embedding.ts";
import { Graph } from "./graph.ts";

const now = new Date("2026-01-01T00:00:00Z");
const tenant = Tenant.create("organization", "org1");
const metadata = EntityMetadata.create(now);

const validInput = {
  tenant,
  metadata,
  payload: {
    name: "people",
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
  },
};

test("Graph.create: given valid input, it should return a Graph with metadata and tenant", () => {
  // GIVEN / WHEN
  const result = Graph.create(validInput);

  // THEN
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.metadata.createdAt).toEqual(now);
  expect(result.value.metadata.updatedAt).toEqual(now);
  expect(result.value.tenant).toBe(tenant);
});

test("Graph.create: given a fresh graph, it should mint a distinct id each time", () => {
  // GIVEN / WHEN
  const a = Graph.create(validInput);
  const b = Graph.create(validInput);

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
  "Graph.create: given %s, it should return an InvalidGraph error",
  (_label, patch) => {
    // GIVEN / WHEN
    const result = Graph.create({
      ...validInput,
      payload: { ...validInput.payload, ...patch },
    });

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidGraph");
    expect(result.error.category).toBe("validation");
  },
);

const storedRow = {
  tenant,
  metadata: EntityMetadata.restore(now, new Date("2026-01-03T00:00:00Z")),
  payload: {
    id: "01952d3f-0000-7000-8000-000000000000",
    name: "people",
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
  },
};

test("Graph.restore: given a stored row, it should preserve persisted identity and tenant", () => {
  // GIVEN / WHEN
  const graph = Graph.restore(storedRow);

  // THEN
  expect(graph.id.value).toBe(storedRow.payload.id);
  expect(graph.metadata.createdAt).toEqual(storedRow.metadata.createdAt);
  expect(graph.metadata.updatedAt).toEqual(storedRow.metadata.updatedAt);
  expect(graph.tenant.equals(tenant)).toBe(true);
});

test("Graph.restore: given a row with a blank name, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() =>
    Graph.restore({
      ...storedRow,
      payload: { ...storedRow.payload, name: "  " },
    }),
  ).toThrow();
});

const graph = Graph.restore(storedRow);

test("Graph.accepts: given an embedding matching the graph's model and dimensions, it should return true", () => {
  // GIVEN
  const embedding = Embedding.restore({
    payload: {
      vector: [0.1],
      model: "text-embedding-3-small",
      dimensions: 1536,
    },
  });

  // WHEN / THEN
  expect(graph.accepts(embedding)).toBe(true);
});

test.each([
  [
    "a model mismatch",
    Embedding.restore({
      payload: { vector: [0.1], model: "other-model", dimensions: 1536 },
    }),
  ],
  [
    "a dimension mismatch",
    Embedding.restore({
      payload: {
        vector: [0.1],
        model: "text-embedding-3-small",
        dimensions: 768,
      },
    }),
  ],
])(
  "Graph.accepts: given %s, it should return false",
  (_label, embedding) => {
    // WHEN / THEN
    expect(graph.accepts(embedding)).toBe(false);
  },
);
