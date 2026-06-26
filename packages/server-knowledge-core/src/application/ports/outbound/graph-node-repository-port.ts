import type { Tenant } from "@repo/server-kernel";

import type { GraphNode } from "../../../domain/aggregates/graph-node.ts";
import type { EventId } from "../../../domain/value-objects/event-id.ts";
import type { GraphId } from "../../../domain/value-objects/graph-id.ts";

type GraphNodeRepositoryPortFindManyInput = {
  tenant: Tenant;
  filters: {
    eventId: EventId;
    graphId: GraphId;
  };
};
type GraphNodeRepositoryPortFindManyOutput = Promise<GraphNode[]>;

type GraphNodeRepositoryPortSearchByEmbeddingInput = {
  tenant: Tenant;
  filters: {
    graphId: GraphId;
  };
  embedding: number[];
  limit: number;
};
type GraphNodeRepositoryPortSearchByEmbeddingOutput = Promise<GraphNode[]>;

type GraphNodeRepositoryPortInsertInput = {
  data: GraphNode;
};
type GraphNodeRepositoryPortInsertOutput = Promise<void>;

interface GraphNodeRepositoryPort {
  findMany(
    input: GraphNodeRepositoryPortFindManyInput,
  ): GraphNodeRepositoryPortFindManyOutput;
  insert(
    input: GraphNodeRepositoryPortInsertInput,
  ): GraphNodeRepositoryPortInsertOutput;
  searchByEmbedding(
    input: GraphNodeRepositoryPortSearchByEmbeddingInput,
  ): GraphNodeRepositoryPortSearchByEmbeddingOutput;
}

export type {
  GraphNodeRepositoryPort,
  GraphNodeRepositoryPortFindManyInput,
  GraphNodeRepositoryPortFindManyOutput,
  GraphNodeRepositoryPortInsertInput,
  GraphNodeRepositoryPortSearchByEmbeddingInput,
  GraphNodeRepositoryPortSearchByEmbeddingOutput,
  GraphNodeRepositoryPortInsertOutput,
};
