import { test, expect } from "bun:test";

import { EventId } from "./event-id.value-object.ts";
import { KnowledgeGraphId } from "./knowledge-graph-id.value-object.ts";
import { KnowledgeGraphNode } from "./knowledge-graph-node.aggregate.ts";
import { mergeNodes } from "./merge-nodes.domain-service.ts";

const graphId = KnowledgeGraphId.create();
const now = new Date("2026-01-01T00:00:00Z");
const mergedAt = new Date("2026-01-05T00:00:00Z");

const node = (eventIds: EventId[]): KnowledgeGraphNode => {
  const result = KnowledgeGraphNode.create({
    graphId,
    type: "PERSON",
    body: "Ada Lovelace",
    eventIds,
    now,
  });
  if (!result.ok) throw new Error("expected ok node");
  return result.value;
};

test("mergeNodes: given a duplicate, the survivor should gain the duplicate's eventIds", () => {
  // GIVEN
  const survivor = node([EventId.create()]);
  const duplicate = node([EventId.create()]);

  // WHEN
  mergeNodes({ survivor, duplicate, now: mergedAt });

  // THEN
  expect(survivor.eventIds).toHaveLength(2);
});

test("mergeNodes: given the same duplicate twice, the second merge should be a no-op", () => {
  // GIVEN
  const survivor = node([EventId.create()]);
  const duplicate = node([EventId.create()]);
  mergeNodes({ survivor, duplicate, now: mergedAt });

  // WHEN
  mergeNodes({ survivor, duplicate, now: mergedAt });

  // THEN
  expect(survivor.eventIds).toHaveLength(2);
});
