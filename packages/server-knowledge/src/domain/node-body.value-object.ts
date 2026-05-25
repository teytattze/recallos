import { Result, ValueObject } from "server-kernel";

import { EmptyNodeBodyError, NodeBodyTooLongError } from "./errors/index.ts";

type NodeBodyProps = {
  text: string;
};

/** The canonical text content of a node — the thing that gets embedded. */
export class NodeBody extends ValueObject<NodeBodyProps> {
  static readonly MAX_LENGTH = 10_000;

  private constructor(props: NodeBodyProps) {
    super(props);
  }

  get text(): string {
    return this._props.text;
  }

  static create(text: string): Result<NodeBody> {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return Result.err(EmptyNodeBodyError("Node body must not be empty"));
    }
    if (trimmed.length > NodeBody.MAX_LENGTH) {
      return Result.err(
        NodeBodyTooLongError(
          `Node body must be at most ${NodeBody.MAX_LENGTH} characters`,
          { length: trimmed.length, max: NodeBody.MAX_LENGTH },
        ),
      );
    }
    return Result.ok(new NodeBody({ text: trimmed }));
  }
}
