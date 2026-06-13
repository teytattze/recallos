import { Id } from "@repo/server-kernel";

class GraphNodeId extends Id {
  static create(): GraphNodeId {
    return new GraphNodeId(Id.newValue());
  }

  static restore(value: string): GraphNodeId {
    return new GraphNodeId(value);
  }
}

export { GraphNodeId };
