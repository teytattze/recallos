import { z } from "zod";

import { parseProps } from "./schema.ts";
import { ValueObject } from "./value-object.ts";

const entityMetadataPropsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});
type EntityMetadataProps = z.infer<typeof entityMetadataPropsSchema>;

class EntityMetadata extends ValueObject<EntityMetadataProps> {
  private constructor(props: EntityMetadataProps) {
    super(parseProps(entityMetadataPropsSchema, props));
  }

  static create(now: Date): EntityMetadata {
    return new EntityMetadata({ createdAt: now, updatedAt: now });
  }

  static restore(createdAt: Date, updatedAt: Date): EntityMetadata {
    return new EntityMetadata({ createdAt, updatedAt });
  }

  touch(now: Date): EntityMetadata {
    return new EntityMetadata({
      createdAt: this._props.createdAt,
      updatedAt: now,
    });
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  get updatedAt(): Date {
    return this._props.updatedAt;
  }
}

export { EntityMetadata };
