import type { DomainError } from "./domain-error.ts";

type Ok<T> = { readonly ok: true; readonly value: T };

type Err<E> = { readonly ok: false; readonly error: E };

type Result<T, E = DomainError<string>> = Ok<T> | Err<E>;

function okResult<T>(value: T): Ok<T> {
  return { ok: true, value };
}

function errResult<E>(error: E): Err<E> {
  return { ok: false, error };
}

function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  return result.ok ? okResult(fn(result.value)) : result;
}

function mapResultErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  return result.ok ? result : errResult(fn(result.error));
}

export { okResult, errResult, mapResult, mapResultErr };
export type { Ok, Err, Result };
