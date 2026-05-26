import { test, expect } from "bun:test";

import { KnowledgeGraph } from "./knowledge-graph.aggregate.ts";

const now = new Date("2026-01-01T00:00:00Z");

const validInput = {
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

test("KnowledgeGraph.create: given a fresh graph, it should mint a distinct id each time", () => {
  // GIVEN / WHEN
  const a = KnowledgeGraph.create(validInput);
  const b = KnowledgeGraph.create(validInput);

  // THEN
  expect(a.ok && b.ok && a.value.id.value).not.toBe(
    b.ok ? b.value.id.value : "",
  );
});

test("KnowledgeGraph.create: given a blank name, it should return an InvalidKnowledgeGraph error", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraph.create({ ...validInput, name: "   " });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraph");
  expect(result.error.category).toBe("validation");
});

test("KnowledgeGraph.create: given a blank embedding model, it should return an InvalidKnowledgeGraph error", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraph.create({ ...validInput, embeddingModel: "" });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraph");
});

test("KnowledgeGraph.create: given non-positive embedding dimensions, it should return an InvalidKnowledgeGraph error", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraph.create({
    ...validInput,
    embeddingDimensions: 0,
  });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraph");
});

test("KnowledgeGraph.create: given non-integer embedding dimensions, it should return an InvalidKnowledgeGraph error", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraph.create({
    ...validInput,
    embeddingDimensions: 1.5,
  });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraph");
});

const storedRow = {
  id: "01952d3f-0000-7000-8000-000000000000",
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

test("KnowledgeGraph.restore: given a row with a blank name, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => KnowledgeGraph.restore({ ...storedRow, name: "  " })).toThrow();
});
