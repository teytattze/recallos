import { Id } from "@repo/server-kernel";

type RestoreGraphId = {
  payload: string;
};

class GraphId extends Id {
  static create(): GraphId {
    return new GraphId(Id.newValue());
  }

  static restore(input: RestoreGraphId): GraphId {
    return new GraphId(input.payload);
  }
}

export { GraphId };
