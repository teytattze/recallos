import { expect, test } from "bun:test";

import { NodeType } from "./node-type.value-object.ts";
import {
  RelationshipType,
  relationshipAllowsTypes,
} from "./relationship-type.value-object.ts";

test("relationshipAllowsTypes: given AUTHORED_BY from a DOCUMENT to a PERSON, it should allow", () => {
  const allowed = relationshipAllowsTypes(
    RelationshipType.AUTHORED_BY,
    NodeType.DOCUMENT,
    NodeType.PERSON,
  );

  expect(allowed).toBe(true);
});

test("relationshipAllowsTypes: given AUTHORED_BY between two PERSONs, it should reject", () => {
  const allowed = relationshipAllowsTypes(
    RelationshipType.AUTHORED_BY,
    NodeType.PERSON,
    NodeType.PERSON,
  );

  expect(allowed).toBe(false);
});

test("relationshipAllowsTypes: given RELATED_TO between unrelated types, it should allow as the generic fallback", () => {
  const allowed = relationshipAllowsTypes(
    RelationshipType.RELATED_TO,
    NodeType.TASK,
    NodeType.LOCATION,
  );

  expect(allowed).toBe(true);
});

test("relationshipAllowsTypes: given LOCATED_IN to a non-LOCATION target, it should reject", () => {
  const allowed = relationshipAllowsTypes(
    RelationshipType.LOCATED_IN,
    NodeType.PERSON,
    NodeType.PERSON,
  );

  expect(allowed).toBe(false);
});
