import {
  ValueObject,
  mapResult,
  parseProps,
  parsePropsOrThrow,
  type Result,
} from "@repo/server-kernel";
import { z } from "zod";

import { createInvalidGraphNodeError } from "../errors/invalid-graph-node-error.ts";

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

type GraphNodeBodyProps = z.infer<typeof nodeBodyPropsSchema>;

type CreateGraphNodeBodyInput = {
  payload: string;
};

type RestoreGraphNodeBodyInput = {
  payload: string;
};

class GraphNodeBody extends ValueObject<GraphNodeBodyProps> {
  private constructor(props: GraphNodeBodyProps) {
    super(props);
  }

  static create(input: CreateGraphNodeBodyInput): Result<GraphNodeBody> {
    return mapResult(
      parseProps(
        nodeBodyPropsSchema,
        { text: input.payload },
        createInvalidGraphNodeError,
      ),
      (props) => new GraphNodeBody(props),
    );
  }

  static restore(input: RestoreGraphNodeBodyInput): GraphNodeBody {
    return new GraphNodeBody(
      parsePropsOrThrow(nodeBodyPropsSchema, { text: input.payload }),
    );
  }
}

export { GraphNodeBody };
