import {
  Result,
  ValueObject,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { z } from "zod";

import { InvalidKnowledgeGraphNode } from "./invalid-knowledge-graph-node.error.ts";

const MAX_NODE_BODY_LENGTH = 10_000;

const nodeBodyPropsSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "node body must not be empty")
    .max(
      MAX_NODE_BODY_LENGTH,
      `node body must be at most ${MAX_NODE_BODY_LENGTH} characters`,
    ),
});

type NodeBodyProps = z.infer<typeof nodeBodyPropsSchema>;

export class NodeBody extends ValueObject<NodeBodyProps> {
  private constructor(props: NodeBodyProps) {
    super(props);
  }

  static create(text: string): Result<NodeBody> {
    return Result.map(
      parseProps(nodeBodyPropsSchema, { text }, InvalidKnowledgeGraphNode),
      (props) => new NodeBody(props),
    );
  }

  static restore(text: string): NodeBody {
    return new NodeBody(parsePropsOrThrow(nodeBodyPropsSchema, { text }));
  }
}
