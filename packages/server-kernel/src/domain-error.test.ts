import { test, expect } from "bun:test";

import { defineError } from "./domain-error.ts";

test("defineError: given a message only, it should build an error without a details key", () => {
  // GIVEN
  const EmailInvalid = defineError("EmailInvalid", "validation");

  // WHEN
  const error = EmailInvalid("not an email");

  // THEN
  expect(error).toEqual({
    kind: "EmailInvalid",
    category: "validation",
    message: "not an email",
  });
  expect("details" in error).toBe(false);
});

test("defineError: given details, it should carry them through", () => {
  // GIVEN
  const QuotaExceeded = defineError("QuotaExceeded", "conflict");

  // WHEN
  const error = QuotaExceeded("too many", { limit: 10 });

  // THEN
  expect(error.details).toEqual({ limit: 10 });
});

test("defineError: given two factories, it should produce distinct kinds", () => {
  // GIVEN
  const EmailInvalid = defineError("EmailInvalid", "validation");
  const QuotaExceeded = defineError("QuotaExceeded", "conflict");

  // WHEN / THEN
  expect(EmailInvalid("a").kind).toBe("EmailInvalid");
  expect(QuotaExceeded("b").kind).toBe("QuotaExceeded");
});
