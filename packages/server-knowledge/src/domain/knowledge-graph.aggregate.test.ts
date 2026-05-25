import { expect, test } from "bun:test";

import { Embedding } from "./embedding.value-object.ts";
import { KnowledgeGraphId } from "./ids.value-object.ts";
import { KnowledgeGraph } from "./knowledge-graph.aggregate.ts";

const NOW = new Date("2026-05-25T00:00:00.000Z");

function makeGraph(): KnowledgeGraph {
  const result = KnowledgeGraph.create({
    id: KnowledgeGraphId.generate(),
    name: "Org Memory",
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 3,
    now: NOW,
  });
  if (!result.ok) throw new Error("graph setup failed");
  return result.value;
}

function makeEmbedding(vector: number[], model: string): Embedding {
  const result = Embedding.create(vector, model);
  if (!result.ok) throw new Error("embedding setup failed");
  return result.value;
}

test("KnowledgeGraph.create: given a blank name, it should fail with EmptyGraphNameError", () => {
  const result = KnowledgeGraph.create({
    id: KnowledgeGraphId.generate(),
    name: "   ",
    embeddingModel: "m",
    embeddingDimensions: 3,
    now: NOW,
  });

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("EmptyGraphNameError");
});

test("KnowledgeGraph.accepts: given a matching model and dimensions, it should accept the embedding", () => {
  const graph = makeGraph();

  const accepted = graph.accepts(
    makeEmbedding([0.1, 0.2, 0.3], "text-embedding-3-small"),
  );

  expect(accepted).toBe(true);
});

test("KnowledgeGraph.accepts: given mismatched dimensions, it should reject the embedding", () => {
  const graph = makeGraph();

  const accepted = graph.accepts(
    makeEmbedding([0.1, 0.2], "text-embedding-3-small"),
  );

  expect(accepted).toBe(false);
});
