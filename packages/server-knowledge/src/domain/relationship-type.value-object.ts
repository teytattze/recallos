export const RELATIONSHIP_TYPES = [
  "MENTIONS",
  "AUTHORED_BY",
  "SENT_BY",
  "REPLIES_TO",
  "PART_OF",
  "REFERENCES",
  "ASSIGNED_TO",
  "INVOLVES",
  "LOCATED_IN",
  "DERIVED_FROM",
  "DUPLICATE_OF",
  "RELATED_TO",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];
