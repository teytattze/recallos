import type { DomainError } from "./domain-error.ts";

export type Ok<T> = { readonly ok: true; readonly value: T };

export type Err<E> = { readonly ok: false; readonly error: E };

/**
 * Either a success or an *expected*, domain-meaningful failure. Return type for
 * anything in the hexagon whose failure modes are part of its contract (VO
 * construction, use cases); truly exceptional faults `throw` instead and are
 * reconciled at the inbound adapter. `E` defaults to {@link DomainError}.
 */
export type Result<T, E = DomainError> = Ok<T> | Err<E>;

/**
 * Constructors and combinators for {@link Result}. Shares the type's name so
 * `Result<T>` and `Result.ok(x)` coexist.
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
