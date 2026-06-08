import type { Id } from "./id.ts";

abstract class Entity<
  TId extends Id,
  TProps extends Record<string, unknown> = Record<never, never>,
> {
  protected readonly _id: TId;
  protected readonly _props: TProps;

  protected constructor(id: TId, props: TProps) {
    this._id = id;
    this._props = props;
  }

  protected replaceProps(next: TProps): void {
    Object.assign(this._props, next);
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
}

export { Entity };
