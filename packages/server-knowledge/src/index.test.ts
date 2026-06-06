import { expect, test } from "bun:test";

import {
  KnowledgeGraph,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  NodeBody,
  EventId,
  createInvalidKnowledgeGraphError,
  NodeCreated,
  type ProcessEventPort,
  type UnitOfWorkPort,
} from "@repo/server-knowledge";

test("server-knowledge barrel exports representative public contracts", () => {
  const processEventPort = undefined as ProcessEventPort | undefined;
  const unitOfWorkPort = undefined as UnitOfWorkPort | undefined;

  expect(KnowledgeGraph).toBeDefined();
  expect(KnowledgeGraphNode).toBeDefined();
  expect(KnowledgeGraphEdge).toBeDefined();
  expect(NodeBody).toBeDefined();
  expect(EventId).toBeDefined();
  expect(createInvalidKnowledgeGraphError).toBeDefined();
  expect(NodeCreated).toBeDefined();
  expect(processEventPort).toBeUndefined();
  expect(unitOfWorkPort).toBeUndefined();
});
