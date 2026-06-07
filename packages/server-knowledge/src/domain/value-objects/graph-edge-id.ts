import { Id } from "@repo/server-kernel";

class GraphEdgeId extends Id {
  static create(): GraphEdgeId {
    return new GraphEdgeId(Id.newValue());
  }

  static restore(value: string): GraphEdgeId {
    return new GraphEdgeId(value);
  }
}

export { GraphEdgeId };
