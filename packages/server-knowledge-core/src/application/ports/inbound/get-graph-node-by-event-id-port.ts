import type { JsonObject } from "type-fest";

type GetGraphNodeByEventIdPortInput = {
  tenant: string;
  payload: {
    eventId: string;
  };
};

type GetGraphNodeByEventIdPortOutput = Promise<{
  id: string;
  tenant: string;
  createdAt: string;
  updatedAt: string;
  eventId: string;
  graphId: string;
  rawEvent: JsonObject;
}>;

interface GetGraphNodeByEventIdPort {
  execute(
    input: GetGraphNodeByEventIdPortInput,
  ): GetGraphNodeByEventIdPortOutput;
}

export type {
  GetGraphNodeByEventIdPort,
  GetGraphNodeByEventIdPortInput,
  GetGraphNodeByEventIdPortOutput,
};
