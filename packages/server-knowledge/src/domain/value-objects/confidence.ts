import {
  ValueObject,
  mapResult,
  parseProps,
  parsePropsOrThrow,
  type Result,
} from "@repo/server-kernel";
import { z } from "zod";

import { createInvalidGraphEdgeError } from "../errors/invalid-graph-edge-error.ts";

const confidencePropsSchema = z.object({
  value: z.number().min(0).max(1),
});

type ConfidenceProps = z.infer<typeof confidencePropsSchema>;

type CreateConfidenceInput = {
  payload: number;
};

type RestoreConfidenceInput = {
  payload: number;
};

class Confidence extends ValueObject<ConfidenceProps> {
  private constructor(props: ConfidenceProps) {
    super(props);
  }

  static create(input: CreateConfidenceInput): Result<Confidence> {
    return mapResult(
      parseProps(
        confidencePropsSchema,
        { value: input.payload },
        createInvalidGraphEdgeError,
      ),
      (props) => new Confidence(props),
    );
  }

  static restore(input: RestoreConfidenceInput): Confidence {
    return new Confidence(
      parsePropsOrThrow(confidencePropsSchema, { value: input.payload }),
    );
  }
}

export { Confidence };
