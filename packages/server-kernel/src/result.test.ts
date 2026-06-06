import { test, expect } from "bun:test";

import { defineError } from "./domain-error.ts";
import { errResult, mapResult, mapResultErr, okResult } from "./result.ts";

const EmailInvalid = defineError("EmailInvalid", "validation");

test("okResult: given a value, it should carry the value on the success branch", () => {
  const result = okResult(42);

  expect(result.ok).toBe(true);
  expect(result.ok && result.value).toBe(42);
});

test("errResult: given a domain error, it should carry the tagged error on the failure branch", () => {
  const result = errResult(EmailInvalid("not an email"));

  expect(result.ok).toBe(false);
  expect(!result.ok && result.error.kind).toBe("EmailInvalid");
  expect(!result.ok && result.error.category).toBe("validation");
});

test("mapResult: given an ok, it should transform the value", () => {
  expect(mapResult(okResult(2), (n) => n * 2)).toEqual(okResult(4));
});

test("mapResult: given an err, it should pass the failure through untouched", () => {
  const failure = errResult(EmailInvalid("bad"));

  expect(mapResult(failure, (n: number) => n * 2)).toEqual(failure);
});

test("mapResultErr: given an err, it should transform the error", () => {
  const NotFound = defineError("MemoryNotFound", "not-found");
  const result = mapResultErr(errResult(EmailInvalid("bad")), () =>
    NotFound("gone"),
  );
  expect(!result.ok && result.error.kind).toBe("MemoryNotFound");
});

test("mapResultErr: given an ok, it should pass the success through untouched", () => {
  const success = okResult(7);
  expect(mapResultErr(success, () => EmailInvalid("bad"))).toEqual(success);
});
