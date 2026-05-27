import {
  Result,
  ValueObject,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { z } from "zod";

import { InvalidEvent } from "./invalid-event.error.ts";

const tagsPropsSchema = z.object({
  entries: z.record(
    z.string().trim().toLowerCase().min(1, "tag keys must be non-empty"),
    z.string().trim(),
  ),
});

type TagsProps = z.infer<typeof tagsPropsSchema>;

export class Tags extends ValueObject<TagsProps> {
  private constructor(props: TagsProps) {
    super(props);
  }

  get entries(): Record<string, string> {
    return this._props.entries;
  }

  static create(input: Record<string, string>): Result<Tags> {
    return Result.map(
      parseProps(tagsPropsSchema, { entries: input }, InvalidEvent),
      (props) => new Tags(props),
    );
  }

  static restore(entries: Record<string, string>): Tags {
    return new Tags(parsePropsOrThrow(tagsPropsSchema, { entries }));
  }
}
