import type { JsonObject } from "type-fest";

type ProcessEventPortInput = {
  tenant: string;
  payload: {
    event: {
      id: string;
      raw: JsonObject;
    };
    graphId: string;
  };
};

type ProcessEventPortOutput = Promise<void>;

interface ProcessEventPort {
  execute(input: ProcessEventPortInput): ProcessEventPortOutput;
}

export type {
  ProcessEventPort,
  ProcessEventPortInput,
  ProcessEventPortOutput,
};
