import { Id } from "@repo/server-kernel";

class KnowledgeGraphId extends Id {
  static create(): KnowledgeGraphId {
    return new KnowledgeGraphId(Id.newValue());
  }

  static restore(value: string): KnowledgeGraphId {
    return new KnowledgeGraphId(value);
  }
}

export { KnowledgeGraphId };
