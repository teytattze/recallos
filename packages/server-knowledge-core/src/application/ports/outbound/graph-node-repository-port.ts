import type { GraphNode } from "../../../domain/aggregates/graph-node.ts";

type GraphNodeRepositoryPortInsertInput = {
  data: GraphNode;
};
type GraphNodeRepositoryPortInsertOutput = Promise<void>;

interface GraphNodeRepositoryPort {
  insert(
    input: GraphNodeRepositoryPortInsertInput,
  ): GraphNodeRepositoryPortInsertOutput;
}

export type {
  GraphNodeRepositoryPort,
  GraphNodeRepositoryPortInsertInput,
  GraphNodeRepositoryPortInsertOutput,
};
