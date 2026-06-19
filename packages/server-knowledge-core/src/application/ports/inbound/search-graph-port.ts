import type { JsonObject } from "type-fest";

type SearchGraphPortInput = {
  tenant: string;
  payload: {
    queries: string[];
  };
};

type SearchGraphPortOutput = Promise<{
  graphId: string;
  results: {
    rawEvent: JsonObject;
  }[];
}>;

interface SearchGraphPort {
  execute(input: SearchGraphPortInput): SearchGraphPortOutput;
}

export type { SearchGraphPort, SearchGraphPortInput, SearchGraphPortOutput };
