import type { KnowledgeGraphEdgeRepositoryPort } from "./knowledge-graph-edge-repository.port.ts";
import type { KnowledgeGraphNodeRepositoryPort } from "./knowledge-graph-node-repository.port.ts";
import type { ProcessedEventLedgerPort } from "./processed-event-ledger.port.ts";

export interface UnitOfWorkContext {
  nodes: KnowledgeGraphNodeRepositoryPort;
  edges: KnowledgeGraphEdgeRepositoryPort;
  ledger: ProcessedEventLedgerPort;
}

export interface UnitOfWorkPort {
  /** Run `work` in one transaction: commit when it resolves, roll back if it throws. */
  transaction<T>(work: (ctx: UnitOfWorkContext) => Promise<T>): Promise<T>;
}
