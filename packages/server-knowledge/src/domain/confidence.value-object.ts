import {
  ValueObject,
  mapResult,
  parseProps,
  parsePropsOrThrow,
  type Result,
} from "@repo/server-kernel";
import { z } from "zod";

import { InvalidKnowledgeGraphEdge } from "./invalid-knowledge-graph-edge.error.ts";

const confidencePropsSchema = z.object({
  value: z.number().min(0).max(1),
});

type ConfidenceProps = z.infer<typeof confidencePropsSchema>;

export class Confidence extends ValueObject<ConfidenceProps> {
  private constructor(props: ConfidenceProps) {
    super(props);
  }

  static create(value: number): Result<Confidence> {
    return mapResult(
      parseProps(confidencePropsSchema, { value }, InvalidKnowledgeGraphEdge),
      (props) => new Confidence(props),
    );
  }

  static restore(value: number): Confidence {
    return new Confidence(parsePropsOrThrow(confidencePropsSchema, { value }));
  }
}
