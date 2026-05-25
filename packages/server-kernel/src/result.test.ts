import { test, expect } from "bun:test";

import { defineError } from "./domain-error.ts";
import { Result } from "./result.ts";

const EmailInvalid = defineError("EmailInvalid", "validation");

test("Result.ok: given a value, it should carry the value on the success branch", () => {
  const result = Result.ok(42);
  expect(Result.isOk(result)).toBe(true);
  expect(result.ok && result.value).toBe(42);
});

test("Result.err: given a domain error, it should carry the tagged error on the failure branch", () => {
  const result = Result.err(EmailInvalid("not an email"));
  expect(Result.isErr(result)).toBe(true);
  expect(result.ok === false && result.error.kind).toBe("EmailInvalid");
  expect(result.ok === false && result.error.category).toBe("validation");
});

test("Result.isOk: given an err, it should return false", () => {
  expect(Result.isOk(Result.err(EmailInvalid("bad")))).toBe(false);
});

test("Result.isErr: given an ok, it should return false", () => {
  expect(Result.isErr(Result.ok(1))).toBe(false);
});

test("Result.map: given an ok, it should transform the value", () => {
  expect(Result.map(Result.ok(2), (n) => n * 2)).toEqual(Result.ok(4));
});

test("Result.map: given an err, it should pass the failure through untouched", () => {
  const failure = Result.err(EmailInvalid("bad"));
  expect(Result.map(failure, (n: number) => n * 2)).toEqual(failure);
});

test("Result.mapErr: given an err, it should transform the error", () => {
  const NotFound = defineError("MemoryNotFound", "not-found");
  const result = Result.mapErr(Result.err(EmailInvalid("bad")), () =>
    NotFound("gone"),
  );
  expect(result.ok === false && result.error.kind).toBe("MemoryNotFound");
});

test("Result.mapErr: given an ok, it should pass the success through untouched", () => {
  const success = Result.ok(7);
  expect(Result.mapErr(success, () => EmailInvalid("bad"))).toEqual(success);
});

test("Result.andThen: given an ok, it should thread the value into the next step", () => {
  const chained = Result.andThen(Result.ok(1), (n) => Result.ok(n + 1));
  expect(chained).toEqual(Result.ok(2));
});

test("Result.andThen: given an err, it should short-circuit without invoking the next step", () => {
  let called = false;
  const failure = Result.err(EmailInvalid("bad"));
  const chained = Result.andThen(failure, (n: number) => {
    called = true;
    return Result.ok(n + 1);
  });

  expect(called).toBe(false);
  expect(chained).toEqual(failure);
});

test("Result.unwrapOr: given an err, it should fall back without throwing", () => {
  expect(Result.unwrapOr(Result.err(EmailInvalid("bad")), 0)).toBe(0);
});

test("Result.unwrapOr: given an ok, it should return the value", () => {
  expect(Result.unwrapOr(Result.ok(7), 0)).toBe(7);
});
