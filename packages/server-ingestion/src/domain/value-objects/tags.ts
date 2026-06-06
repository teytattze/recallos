import {
  ValueObject,
  mapResult,
  parseProps,
  parsePropsOrThrow,
  type Result,
} from "@repo/server-kernel";
import { z } from "zod";

import { createInvalidEventError } from "../errors/invalid-event-error";

const tagsPropsSchema = z.object({
  entries: z.record(
    z.string().trim().toLowerCase().min(1, "tag keys must be non-empty"),
    z.string().trim(),
  ),
});
type TagsProps = z.infer<typeof tagsPropsSchema>;

type CreateTagsInput = {
  payload: Record<string, string>;
};

type RestoreTagsInput = {
  payload: Record<string, string>;
};

class Tags extends ValueObject<TagsProps> {
  private constructor(props: TagsProps) {
    super(props);
  }

  static create(input: CreateTagsInput): Result<Tags> {
    return mapResult(
      parseProps(
        tagsPropsSchema,
        { entries: input.payload },
        createInvalidEventError,
      ),
      (props) => new Tags(props),
    );
  }

  static restore(input: RestoreTagsInput): Tags {
    return new Tags(
      parsePropsOrThrow(tagsPropsSchema, { entries: input.payload }),
    );
  }

  get entries(): TagsProps["entries"] {
    return this._props.entries;
  }
}

export { Tags };
