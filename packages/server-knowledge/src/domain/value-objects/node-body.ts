import {
  ValueObject,
  mapResult,
  parseProps,
  parsePropsOrThrow,
  type Result,
} from "@repo/server-kernel";
import { z } from "zod";

import { createInvalidKnowledgeGraphNodeError } from "../errors/invalid-knowledge-graph-node-error.ts";

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

type CreateNodeBodyInput = {
  payload: string;
};

type RestoreNodeBodyInput = {
  payload: string;
};

class NodeBody extends ValueObject<NodeBodyProps> {
  private constructor(props: NodeBodyProps) {
    super(props);
  }

  static create(input: CreateNodeBodyInput): Result<NodeBody> {
    return mapResult(
      parseProps(
        nodeBodyPropsSchema,
        { text: input.payload },
        createInvalidKnowledgeGraphNodeError,
      ),
      (props) => new NodeBody(props),
    );
  }

  static restore(input: RestoreNodeBodyInput): NodeBody {
    return new NodeBody(
      parsePropsOrThrow(nodeBodyPropsSchema, { text: input.payload }),
    );
  }
}

export { NodeBody };
