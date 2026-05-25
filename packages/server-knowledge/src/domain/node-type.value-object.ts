/**
 * The kind of a node — a closed, governed vocabulary. New members are added by a
 * deliberate domain change, never emitted as free text by an extractor.
 */
export enum NodeType {
  PERSON = "PERSON",
  ORGANIZATION = "ORGANIZATION",
  DOCUMENT = "DOCUMENT",
  MESSAGE = "MESSAGE",
  TASK = "TASK",
  TOPIC = "TOPIC",
  CONCEPT = "CONCEPT",
  LOCATION = "LOCATION",
  SYSTEM = "SYSTEM",
}

export function isNodeType(value: unknown): value is NodeType {
  return (
    typeof value === "string" &&
    (Object.values(NodeType) as string[]).includes(value)
  );
}
