import {
  KnowledgeGraph,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  NodeBody,
  EventId,
  createInvalidKnowledgeGraphError,
  createNodeCreatedEvent,
  type ProcessEventPort,
  type UnitOfWorkPort,
} from "@repo/server-knowledge";
import { expect, test } from "bun:test";

test("server-knowledge barrel exports representative public contracts", () => {
  const processEventPort = undefined as ProcessEventPort | undefined;
  const unitOfWorkPort = undefined as UnitOfWorkPort | undefined;

  expect(KnowledgeGraph).toBeDefined();
  expect(KnowledgeGraphNode).toBeDefined();
  expect(KnowledgeGraphEdge).toBeDefined();
  expect(NodeBody).toBeDefined();
  expect(EventId).toBeDefined();
  expect(createInvalidKnowledgeGraphError).toBeDefined();
  expect(createNodeCreatedEvent).toBeDefined();
  expect(processEventPort).toBeUndefined();
  expect(unitOfWorkPort).toBeUndefined();
});
