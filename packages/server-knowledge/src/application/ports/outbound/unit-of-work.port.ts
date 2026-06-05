import type { KnowledgeGraphEdgeRepository } from "./knowledge-graph-edge-repository.port.ts";
import type { KnowledgeGraphNodeRepository } from "./knowledge-graph-node-repository.port.ts";
import type { ProcessedEventLedger } from "./processed-event-ledger.port.ts";

export interface KnowledgeContext {
  nodes: KnowledgeGraphNodeRepository;
  edges: KnowledgeGraphEdgeRepository;
  ledger: ProcessedEventLedger;
}

export interface UnitOfWork {
  /** Run `work` in one transaction: commit when it resolves, roll back if it throws. */
  transaction<T>(work: (ctx: KnowledgeContext) => Promise<T>): Promise<T>;
}
