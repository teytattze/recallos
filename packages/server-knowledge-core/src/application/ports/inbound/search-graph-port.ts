import type { JsonObject } from "type-fest";

type SearchGraphPortInput = {
  tenant: string;
  payload: {
    graphId: string;
    query: string;
  };
};

type SearchGraphPortOutput = Promise<{
  data: {
    rawEvent: JsonObject;
  }[];
}>;

interface SearchGraphPort {
  execute(input: SearchGraphPortInput): SearchGraphPortOutput;
}

export type { SearchGraphPort, SearchGraphPortInput, SearchGraphPortOutput };
