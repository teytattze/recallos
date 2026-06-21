import type { JsonObject } from "type-fest";

type ListGraphNodesPortInput = {
  tenant: string;
  filters: {
    eventId: string;
    graphId: string;
  };
};

type ListGraphNodesPortOutput = Promise<
  {
    id: string;
    tenant: string;
    createdAt: string;
    updatedAt: string;
    eventId: string;
    graphId: string;
    rawEvent: JsonObject;
  }[]
>;

interface ListGraphNodesPort {
  execute(input: ListGraphNodesPortInput): ListGraphNodesPortOutput;
}

export type {
  ListGraphNodesPort,
  ListGraphNodesPortInput,
  ListGraphNodesPortOutput,
};
