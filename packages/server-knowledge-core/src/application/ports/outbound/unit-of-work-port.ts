import type { GraphNodeRepositoryPort } from "./graph-node-repository-port.ts";
import type { GraphRepositoryPort } from "./graph-repository-port.ts";

interface UnitOfWorkPortContext {
  graphNodeRepository: GraphNodeRepositoryPort;
  graphRepository: GraphRepositoryPort;
}

interface UnitOfWorkPort {
  transaction<T>(work: (ctx: UnitOfWorkPortContext) => Promise<T>): Promise<T>;
}

export type { UnitOfWorkPortContext, UnitOfWorkPort };
