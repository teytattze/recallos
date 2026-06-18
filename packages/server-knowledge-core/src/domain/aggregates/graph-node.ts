import type { JsonObject } from "type-fest";

import {
  EntityMetadata,
  parseProps,
  Tenant,
  TenantAwareAggregateRoot,
} from "@repo/server-kernel";
import z from "zod";

import { EventId } from "../value-objects/event-id";
import { GraphId } from "../value-objects/graph-id";
import { GraphNodeId } from "../value-objects/graph-node-id";

const graphNodePropsSchema = z.object({
  embedding: z.number().array(),
  eventId: z.custom<EventId>((v) => v instanceof EventId),
  graphId: z.custom<GraphId>((v) => v instanceof GraphId),
  rawEvent: z.custom<JsonObject>((data) => z.json().safeParse(data).success),
});

type GraphNodePropsIn = z.input<typeof graphNodePropsSchema>;
type GraphNodeProps = z.output<typeof graphNodePropsSchema>;

type CreateGraphNodeInput = {
  tenant: string;
  metadata: { now: Date };
  payload: Omit<GraphNodePropsIn, "eventId" | "graphId"> & {
    eventId: string;
    graphId: string;
  };
};
type RestoreGraphNodeInput = {
  tenant: string;
  metadata: { createdAt: Date; updatedAt: Date };
  payload: Omit<GraphNodePropsIn, "eventId" | "graphId"> & {
    id: string;
    eventId: string;
    graphId: string;
  };
};

class GraphNode extends TenantAwareAggregateRoot<GraphNodeId, GraphNodeProps> {
  static create(input: CreateGraphNodeInput): GraphNode {
    return new GraphNode(
      GraphNodeId.create(),
      Tenant.fromString(input.tenant),
      EntityMetadata.create({ payload: input.metadata }),
      parseProps(graphNodePropsSchema, {
        embedding: input.payload.embedding,
        eventId: EventId.restore({ payload: input.payload.eventId }),
        graphId: GraphId.restore({ payload: input.payload.graphId }),
        rawEvent: input.payload.rawEvent,
      }),
    );
  }

  static restore(input: RestoreGraphNodeInput): GraphNode {
    return new GraphNode(
      GraphNodeId.restore({ payload: input.payload.id }),
      Tenant.fromString(input.tenant),
      EntityMetadata.restore({ payload: input.metadata }),
      parseProps(graphNodePropsSchema, {
        embedding: input.payload.embedding,
        eventId: EventId.restore({ payload: input.payload.eventId }),
        graphId: GraphId.restore({ payload: input.payload.graphId }),
        rawEvent: input.payload.rawEvent,
      }),
    );
  }

  get embedding(): GraphNodeProps["embedding"] {
    return this._props.embedding;
  }
  get eventId(): GraphNodeProps["eventId"] {
    return this._props.eventId;
  }
  get graphId(): GraphNodeProps["graphId"] {
    return this._props.graphId;
  }
  get rawEvent(): GraphNodeProps["rawEvent"] {
    return this._props.rawEvent;
  }
}

export { GraphNode };
