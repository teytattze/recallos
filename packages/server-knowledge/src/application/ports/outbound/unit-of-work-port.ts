import type { GraphEdgeRepositoryPort } from "./graph-edge-repository-port.ts";
import type { GraphNodeRepositoryPort } from "./graph-node-repository-port.ts";
import type { ProcessedEventRepositoryPort } from "./processed-event-repository-port.ts";

interface UnitOfWorkPortContext {
  graphNodeRepository: GraphNodeRepositoryPort;
  graphEdgeRepository: GraphEdgeRepositoryPort;
  processedEventRepository: ProcessedEventRepositoryPort;
}

interface UnitOfWorkPort {
  transaction<T>(work: (ctx: UnitOfWorkPortContext) => Promise<T>): Promise<T>;
}

export type { UnitOfWorkPortContext, UnitOfWorkPort };
