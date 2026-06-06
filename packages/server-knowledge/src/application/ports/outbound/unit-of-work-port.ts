import type { KnowledgeGraphEdgeRepositoryPort } from "./knowledge-graph-edge-repository-port.ts";
import type { KnowledgeGraphNodeRepositoryPort } from "./knowledge-graph-node-repository-port.ts";
import type { ProcessedEventLedgerPort } from "./processed-event-ledger-port.ts";

interface UnitOfWorkPortContext {
  nodes: KnowledgeGraphNodeRepositoryPort;
  edges: KnowledgeGraphEdgeRepositoryPort;
  ledger: ProcessedEventLedgerPort;
}

interface UnitOfWorkPort {
  transaction<T>(work: (ctx: UnitOfWorkPortContext) => Promise<T>): Promise<T>;
}

export type { UnitOfWorkPortContext, UnitOfWorkPort };
