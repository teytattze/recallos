const NODE_TYPES = [
  "PERSON",
  "ORGANIZATION",
  "DOCUMENT",
  "MESSAGE",
  "TASK",
  "TOPIC",
  "CONCEPT",
  "LOCATION",
  "SYSTEM",
] as const;

type NodeType = (typeof NODE_TYPES)[number];

export { NODE_TYPES };
export type { NodeType };
