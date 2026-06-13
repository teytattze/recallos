import { z } from "zod";

import { parseProps } from "./schema.ts";
import { ValueObject } from "./value-object.ts";

const idPropsSchema = z.object({ value: z.string().min(1) });
type IdProps = z.infer<typeof idPropsSchema>;

abstract class Id extends ValueObject<IdProps> {
  protected constructor(value: string) {
    super(parseProps(idPropsSchema, { value }));
  }

  protected static newValue(): string {
    return Bun.randomUUIDv7();
  }

  override toString(): string {
    return this._props.value;
  }

  get value(): string {
    return this._props.value;
  }
}

export { Id };
