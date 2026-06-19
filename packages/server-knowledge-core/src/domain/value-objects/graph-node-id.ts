import { Id } from "@repo/server-kernel";

type RestoreGraphNodeIdInput = {
  payload: string;
};

class GraphNodeId extends Id {
  static create(): GraphNodeId {
    return new GraphNodeId(Id.newValue());
  }
  static restore(input: RestoreGraphNodeIdInput): GraphNodeId {
    return new GraphNodeId(input.payload);
  }
}

export { GraphNodeId };
