export const NODE_TYPES = [
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

export type NodeType = (typeof NODE_TYPES)[number];
