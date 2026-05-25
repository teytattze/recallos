import { NodeType } from "./node-type.value-object.ts";

/**
 * The kind of an edge (`from → to`) — a closed, governed vocabulary. Anything an
 * extractor cannot classify maps to `RELATED_TO`; growing the set is a deliberate,
 * versioned domain change.
 */
export enum RelationshipType {
  MENTIONS = "MENTIONS",
  AUTHORED_BY = "AUTHORED_BY",
  SENT_BY = "SENT_BY",
  REPLIES_TO = "REPLIES_TO",
  PART_OF = "PART_OF",
  REFERENCES = "REFERENCES",
  ASSIGNED_TO = "ASSIGNED_TO",
  INVOLVES = "INVOLVES",
  LOCATED_IN = "LOCATED_IN",
  DERIVED_FROM = "DERIVED_FROM",
  DUPLICATE_OF = "DUPLICATE_OF",
  RELATED_TO = "RELATED_TO",
}

export function isRelationshipType(value: unknown): value is RelationshipType {
  return (
    typeof value === "string" &&
    (Object.values(RelationshipType) as string[]).includes(value)
  );
}

interface EndpointRule {
  readonly from: readonly NodeType[];
  readonly to: readonly NodeType[];
}

const ANY_TYPE: readonly NodeType[] = Object.values(NodeType);

const RELATIONSHIP_ENDPOINTS: Record<RelationshipType, EndpointRule> = {
  [RelationshipType.MENTIONS]: { from: ANY_TYPE, to: ANY_TYPE },
  [RelationshipType.AUTHORED_BY]: {
    from: [NodeType.DOCUMENT, NodeType.MESSAGE],
    to: [NodeType.PERSON],
  },
  [RelationshipType.SENT_BY]: {
    from: [NodeType.MESSAGE],
    to: [NodeType.PERSON, NodeType.SYSTEM],
  },
  [RelationshipType.REPLIES_TO]: {
    from: [NodeType.MESSAGE],
    to: [NodeType.MESSAGE],
  },
  [RelationshipType.PART_OF]: { from: ANY_TYPE, to: ANY_TYPE },
  [RelationshipType.REFERENCES]: {
    from: [NodeType.DOCUMENT],
    to: [NodeType.DOCUMENT, NodeType.TOPIC],
  },
  [RelationshipType.ASSIGNED_TO]: {
    from: [NodeType.TASK],
    to: [NodeType.PERSON],
  },
  [RelationshipType.INVOLVES]: {
    from: [NodeType.TASK, NodeType.TOPIC],
    to: [NodeType.PERSON, NodeType.ORGANIZATION],
  },
  [RelationshipType.LOCATED_IN]: { from: ANY_TYPE, to: [NodeType.LOCATION] },
  [RelationshipType.DERIVED_FROM]: { from: ANY_TYPE, to: ANY_TYPE },
  [RelationshipType.DUPLICATE_OF]: { from: ANY_TYPE, to: ANY_TYPE },
  [RelationshipType.RELATED_TO]: { from: ANY_TYPE, to: ANY_TYPE },
};

/** Whether `relationship` may connect a `from`-typed node to a `to`-typed node. */
export function relationshipAllowsTypes(
  relationship: RelationshipType,
  from: NodeType,
  to: NodeType,
): boolean {
  const rule = RELATIONSHIP_ENDPOINTS[relationship];
  return rule.from.includes(from) && rule.to.includes(to);
}
