import type { JsonObject } from "type-fest";

type ProcessEventsPortInput = {
  tenant: string;
  payload: {
    events: {
      id: string;
      raw: JsonObject;
    }[];
    graphId: string;
  };
};

type ProcessEventsPortOutput = Promise<void>;

interface ProcessEventsPort {
  execute(input: ProcessEventsPortInput): ProcessEventsPortOutput;
}

export type {
  ProcessEventsPort,
  ProcessEventsPortInput,
  ProcessEventsPortOutput,
};
