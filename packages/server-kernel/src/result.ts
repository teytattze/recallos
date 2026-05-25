import type { DomainError } from "./domain-error.ts";

/**
 * Success branch of a {@link Result}.
 */
export type Ok<T> = { readonly ok: true; readonly value: T };

/**
 * Failure branch of a {@link Result}.
 */
export type Err<E> = { readonly ok: false; readonly error: E };

/**
 * A value that is either a success (`Ok`) or an expected, domain-meaningful
 * failure (`Err`). Use it as the return type for anything inside the hexagon
 * whose failure modes are part of the contract — value-object construction and
 * every use case. Truly exceptional faults (infra down, impossible state) should
 * `throw` instead and be reconciled at the inbound adapter.
 *
 * `E` defaults to {@link DomainError} so a use case can be typed as
 * `Result<MemoryItemId>` when its errors are the standard domain shape.
 */
export type Result<T, E = DomainError> = Ok<T> | Err<E>;

/**
 * Constructors and combinators for {@link Result}. Shares its name with the
 * type (type-space vs value-space), so `Result<T>` and `Result.ok(x)` coexist.
 */
export const Result = {
  ok<T>(value: T): Ok<T> {
    return { ok: true, value };
  },

  err<E>(error: E): Err<E> {
    return { ok: false, error };
  },

  /** Narrow a `Result` to its success branch. */
  isOk<T, E>(result: Result<T, E>): result is Ok<T> {
    return result.ok;
  },

  /** Narrow a `Result` to its failure branch. */
  isErr<T, E>(result: Result<T, E>): result is Err<E> {
    return !result.ok;
  },

  /** Transform the success value; pass the failure through untouched. */
  map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    return result.ok ? Result.ok(fn(result.value)) : result;
  },

  /** Transform the error; pass the success through untouched. */
  mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    return result.ok ? result : Result.err(fn(result.error));
  },

  /** Chain a fallible step; short-circuits on the first failure. */
  andThen<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>,
  ): Result<U, E> {
    return result.ok ? fn(result.value) : result;
  },

  /** Extract the value or fall back — never throws. */
  unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
    return result.ok ? result.value : fallback;
  },
} as const;
