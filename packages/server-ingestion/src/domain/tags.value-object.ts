import { Result, ValueObject } from "@repo/server-kernel";

import { InvalidEvent } from "./invalid-event.error.ts";

type TagsProps = {
  entries: Readonly<Record<string, string>>;
};

export class Tags extends ValueObject<TagsProps> {
  private constructor(props: TagsProps) {
    super(props);
  }

  static create(input: Record<string, string>): Result<Tags> {
    const entries: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(input)) {
      const key = rawKey.trim().toLowerCase();
      if (key === "") {
        return Result.err(InvalidEvent("tag keys must be non-empty"));
      }
      entries[key] = rawValue.trim();
    }
    return Result.ok(new Tags({ entries }));
  }

  get(key: string): string | undefined {
    return this._props.entries[key.trim().toLowerCase()];
  }

  toRecord(): Record<string, string> {
    return { ...this._props.entries };
  }
}
