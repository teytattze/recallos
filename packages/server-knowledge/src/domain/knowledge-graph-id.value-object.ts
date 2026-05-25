import { Id } from "@repo/server-kernel";

export class KnowledgeGraphId extends Id {
  static create(): KnowledgeGraphId {
    return new KnowledgeGraphId(Id.newValue());
  }

  static restore(value: string): KnowledgeGraphId {
    return new KnowledgeGraphId(value);
  }
}
