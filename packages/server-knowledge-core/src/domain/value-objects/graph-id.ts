import { Id } from "@repo/server-kernel";

type RestoreGraphIdInput = {
  payload: string;
};

class GraphId extends Id {
  static create(): GraphId {
    return new GraphId(Id.newValue());
  }
  static restore(input: RestoreGraphIdInput): GraphId {
    return new GraphId(input.payload);
  }
}

export { GraphId };
