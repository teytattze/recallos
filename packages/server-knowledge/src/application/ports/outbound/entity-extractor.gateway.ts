import type { NodeType } from "../../../domain/node-type.value-object.ts";
import type { RelationshipType } from "../../../domain/relationship-type.value-object.ts";
import type { EventEntry } from "./event-source.reader.ts";

/** An extraction-local reference linking a candidate edge to a candidate node
 *  within the same extraction result. */
export type CandidateRef = string;

export type CandidateNode = {
  ref: CandidateRef;
  type: NodeType;
  body: string;
  /** A normalized, stable identifier (e.g. an email/handle) when present. */
  naturalKey?: string;
};

export type CandidateEdge = {
  from: CandidateRef;
  to: CandidateRef;
  relationship: RelationshipType;
  confidence: number;
};

export type ExtractionResult = {
  nodes: CandidateNode[];
  edges: CandidateEdge[];
  extractorVersion: string;
};

/**
 * Turns an event entry's opaque body into candidates already typed to the
 * closed vocabulary. Vocabulary governance lives in the adapter (§7): the
 * gateway only ever emits `NodeType` / `RelationshipType` members.
 */
export interface EntityExtractorGateway {
  extract(entry: EventEntry): Promise<ExtractionResult>;
}
