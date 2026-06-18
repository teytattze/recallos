import type { GraphNode } from "../../../domain/aggregates/graph-node.ts";
import type { GraphNodeId } from "../../../domain/value-objects/graph-node-id.ts";

type GraphNodeRepositoryPortInsertManyInput = {
  data: GraphNode[];
};
type GraphNodeRepositoryPortBulkInsertManyOutput = Promise<
  {
    id: GraphNodeId;
    status: "success" | "failed";
  }[]
>;

interface GraphNodeRepositoryPort {
  insertMany(
    input: GraphNodeRepositoryPortInsertManyInput,
  ): GraphNodeRepositoryPortBulkInsertManyOutput;
}

export type {
  GraphNodeRepositoryPort,
  GraphNodeRepositoryPortInsertManyInput,
  GraphNodeRepositoryPortBulkInsertManyOutput,
};
