import { expect, test } from "bun:test";

import {
  EntityResolution,
  type ResolutionMatch,
  type ResolutionThresholds,
} from "./entity-resolution.domain-service.ts";
import { NodeId } from "./node-id.value-object.ts";

const thresholds: ResolutionThresholds = { resolve: 0.9, ambiguous: 0.75 };

test("EntityResolution.classify: given no matches, it should be new", () => {
  // GIVEN / WHEN
  const decision = EntityResolution.classify([], thresholds);

  // THEN
  expect(decision.kind).toBe("new");
});

test("EntityResolution.classify: given a natural-key match, it should resolve to that node", () => {
  // GIVEN
  const nodeId = NodeId.create();
  const matches: ResolutionMatch[] = [
    { nodeId, score: 0.1, matchedByKey: true },
  ];

  // WHEN
  const decision = EntityResolution.classify(matches, thresholds);

  // THEN
  expect(decision.kind).toBe("resolved");
  expect(decision.kind === "resolved" && decision.nodeId.equals(nodeId)).toBe(
    true,
  );
});

test("EntityResolution.classify: given a key match, it should win over a stronger vector match", () => {
  // GIVEN
  const keyNode = NodeId.create();
  const matches: ResolutionMatch[] = [
    { nodeId: NodeId.create(), score: 0.99, matchedByKey: false },
    { nodeId: keyNode, score: 0.0, matchedByKey: true },
  ];

  // WHEN
  const decision = EntityResolution.classify(matches, thresholds);

  // THEN
  expect(decision.kind === "resolved" && decision.nodeId.equals(keyNode)).toBe(
    true,
  );
});

test("EntityResolution.classify: given a single strong vector match, it should resolve to it", () => {
  // GIVEN
  const nodeId = NodeId.create();
  const matches: ResolutionMatch[] = [
    { nodeId, score: 0.95, matchedByKey: false },
  ];

  // WHEN
  const decision = EntityResolution.classify(matches, thresholds);

  // THEN
  expect(decision.kind === "resolved" && decision.nodeId.equals(nodeId)).toBe(
    true,
  );
});

test("EntityResolution.classify: given multiple strong matches, it should be ambiguous", () => {
  // GIVEN
  const matches: ResolutionMatch[] = [
    { nodeId: NodeId.create(), score: 0.95, matchedByKey: false },
    { nodeId: NodeId.create(), score: 0.92, matchedByKey: false },
  ];

  // WHEN
  const decision = EntityResolution.classify(matches, thresholds);

  // THEN
  expect(decision.kind).toBe("ambiguous");
  expect(decision.kind === "ambiguous" && decision.candidates.length).toBe(2);
});

test("EntityResolution.classify: given a near-threshold match, it should be ambiguous rather than guess", () => {
  // GIVEN
  const matches: ResolutionMatch[] = [
    { nodeId: NodeId.create(), score: 0.8, matchedByKey: false },
  ];

  // WHEN
  const decision = EntityResolution.classify(matches, thresholds);

  // THEN
  expect(decision.kind).toBe("ambiguous");
});

test("EntityResolution.classify: given only a weak match, it should be new", () => {
  // GIVEN
  const matches: ResolutionMatch[] = [
    { nodeId: NodeId.create(), score: 0.5, matchedByKey: false },
  ];

  // WHEN
  const decision = EntityResolution.classify(matches, thresholds);

  // THEN
  expect(decision.kind).toBe("new");
});
