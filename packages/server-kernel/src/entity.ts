import type { Id } from "./id.ts";
import type { EntityMetadata } from "./metadata.ts";

abstract class Entity<
  TId extends Id,
  TProps extends Record<string, unknown> = Record<never, never>,
> {
  protected readonly _id: TId;

  protected _metadata: EntityMetadata;
  protected _props: TProps;

  protected constructor(id: TId, metadata: EntityMetadata, props: TProps) {
    this._id = id;
    this._metadata = metadata;
    this._props = props;
  }

  protected replaceProps(next: TProps): void {
    Object.assign(this._props, next);
  }

  protected touch(now: Date): void {
    this._metadata = this._metadata.touch(now);
  }

  equals(other?: Entity<TId, TProps>): boolean {
    if (other === undefined || other === null) return false;
    if (other === this) return true;
    return this._id.equals(other._id);
  }

  toJSON(): TProps {
    return {
      id: this.id,
      ...this._props,
    };
  }

  get id(): TId {
    return this._id;
  }
  get metadata(): EntityMetadata {
    return this._metadata;
  }
}

export { Entity };
