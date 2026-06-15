import { z } from "zod";

import { parseProps } from "./schema.ts";
import { ValueObject } from "./value-object.ts";

const entityMetadataPropsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

type EntityMetadataPropsIn = z.input<typeof entityMetadataPropsSchema>;
type EntityMetadataProps = z.infer<typeof entityMetadataPropsSchema>;

type CreateEntityMetadataInput = {
  payload: { now: Date };
};
type RestoreEntityMetadataInput = {
  payload: EntityMetadataPropsIn;
};

class EntityMetadata extends ValueObject<EntityMetadataProps> {
  private constructor(props: EntityMetadataProps) {
    super(parseProps(entityMetadataPropsSchema, props));
  }

  static create(input: CreateEntityMetadataInput): EntityMetadata {
    return new EntityMetadata({
      createdAt: input.payload.now,
      updatedAt: input.payload.now,
    });
  }

  static restore(input: RestoreEntityMetadataInput): EntityMetadata {
    return new EntityMetadata({
      createdAt: input.payload.createdAt,
      updatedAt: input.payload.updatedAt,
    });
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
