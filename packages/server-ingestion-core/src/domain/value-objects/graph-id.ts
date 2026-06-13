import { Id } from "@repo/server-kernel";

type RestoreGraphIdInput = {
  payload: string;
};

class GraphId extends Id {
  static restore(input: RestoreGraphIdInput): GraphId {
    return new GraphId(input.payload);
  }
}

export { GraphId };
