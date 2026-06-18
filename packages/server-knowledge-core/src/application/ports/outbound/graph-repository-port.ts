import type { Tenant } from "@repo/server-kernel";

import type { Graph } from "../../../domain/aggregates/graph.ts";
import type { GraphId } from "../../../domain/value-objects/graph-id.ts";

type GraphRepositoryPortFindByIdInput = {
  id: GraphId;
  tenant: Tenant;
};
type GraphRepositoryPortFindByIdOutput = Promise<Graph | null>;

type GraphRepositoryPortCreateInput = {
  data: Graph;
};
type GraphRepositoryPortCreateOutput = Promise<void>;

interface GraphRepositoryPort {
  findById(
    input: GraphRepositoryPortFindByIdInput,
  ): GraphRepositoryPortFindByIdOutput;
  create(
    input: GraphRepositoryPortCreateInput,
  ): GraphRepositoryPortCreateOutput;
}

export type {
  GraphRepositoryPort,
  GraphRepositoryPortFindByIdInput,
  GraphRepositoryPortFindByIdOutput,
  GraphRepositoryPortCreateInput,
  GraphRepositoryPortCreateOutput,
};
