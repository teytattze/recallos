import { isEqual } from "es-toolkit";

abstract class ValueObject<T extends Record<string, unknown>> {
  protected readonly _props: T;

  protected constructor(props: T) {
    this._props = props;
  }

  equals(other?: ValueObject<T>): boolean {
    if (other === undefined || other === null) return false;
    if (other === this) return true;
    return isEqual(this._props, other._props);
  }

  toJSON(): T {
    return this._props;
  }
}

export { ValueObject };
