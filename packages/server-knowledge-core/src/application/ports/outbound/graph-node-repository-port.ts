import type { Tenant } from "@repo/server-kernel";

import type { GraphNode } from "../../../domain/aggregates/graph-node.ts";
import type { EventId } from "../../../domain/value-objects/event-id.ts";

type GraphNodeRepositoryPortFindByEventIdInput = {
  eventId: EventId;
  tenant: Tenant;
};
type GraphNodeRepositoryPortFindByEventIdOutput = Promise<GraphNode | null>;

type GraphNodeRepositoryPortInsertInput = {
  data: GraphNode;
};
type GraphNodeRepositoryPortInsertOutput = Promise<void>;

interface GraphNodeRepositoryPort {
  findByEventId(
    input: GraphNodeRepositoryPortFindByEventIdInput,
  ): GraphNodeRepositoryPortFindByEventIdOutput;
  insert(
    input: GraphNodeRepositoryPortInsertInput,
  ): GraphNodeRepositoryPortInsertOutput;
}

export type {
  GraphNodeRepositoryPort,
  GraphNodeRepositoryPortFindByEventIdInput,
  GraphNodeRepositoryPortFindByEventIdOutput,
  GraphNodeRepositoryPortInsertInput,
  GraphNodeRepositoryPortInsertOutput,
};
