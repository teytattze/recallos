import { Id } from "@repo/server-kernel";

class NodeId extends Id {
  static create(): NodeId {
    return new NodeId(Id.newValue());
  }

  static restore(value: string): NodeId {
    return new NodeId(value);
  }
}

export { NodeId };
