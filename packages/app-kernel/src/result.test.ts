import { test, expect } from "bun:test";

import { defineError } from "./domain-error.ts";
import { Result } from "./result.ts";

const EmailInvalid = defineError("EmailInvalid", "validation");

test("ok carries the value", () => {
  const result = Result.ok(42);
  expect(Result.isOk(result)).toBe(true);
  expect(result.ok && result.value).toBe(42);
});

test("err carries a tagged domain error", () => {
  const result = Result.err(EmailInvalid("not an email"));
  expect(Result.isErr(result)).toBe(true);
  expect(result.ok === false && result.error.kind).toBe("EmailInvalid");
  expect(result.ok === false && result.error.category).toBe("validation");
});

test("map transforms ok and passes err through", () => {
  expect(Result.map(Result.ok(2), (n) => n * 2)).toEqual(Result.ok(4));

  const failure = Result.err(EmailInvalid("bad"));
  expect(Result.map(failure, (n: number) => n * 2)).toEqual(failure);
});

test("andThen short-circuits on the first failure", () => {
  const fail = (): Result<number> => Result.err(EmailInvalid("bad"));
  const chained = Result.andThen(Result.ok(1), fail);
  expect(Result.isErr(chained)).toBe(true);
});

test("unwrapOr falls back without throwing", () => {
  expect(Result.unwrapOr(Result.err(EmailInvalid("bad")), 0)).toBe(0);
  expect(Result.unwrapOr(Result.ok(7), 0)).toBe(7);
});
