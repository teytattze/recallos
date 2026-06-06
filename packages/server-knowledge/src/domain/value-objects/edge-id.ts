import { Id } from "@repo/server-kernel";

class EdgeId extends Id {
  static create(): EdgeId {
    return new EdgeId(Id.newValue());
  }

  static restore(value: string): EdgeId {
    return new EdgeId(value);
  }
}

export { EdgeId };
