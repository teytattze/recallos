import { Result, ValueObject } from "server-kernel";

import { ConfidenceOutOfRangeError } from "./errors/index.ts";

type ConfidenceProps = {
  value: number;
};

/** How sure we are an edge is true, in `[0, 1]`. */
export class Confidence extends ValueObject<ConfidenceProps> {
  private constructor(props: ConfidenceProps) {
    super(props);
  }

  get value(): number {
    return this._props.value;
  }

  static create(value: number): Result<Confidence> {
    if (!(value >= 0 && value <= 1)) {
      return Result.err(
        ConfidenceOutOfRangeError(
          `Confidence must be within [0, 1], received ${value}`,
          { value },
        ),
      );
    }
    return Result.ok(new Confidence({ value }));
  }
}
