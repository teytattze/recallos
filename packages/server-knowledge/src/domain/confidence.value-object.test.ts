import { expect, test } from "bun:test";

import { Confidence } from "./confidence.value-object.ts";

test("Confidence.create: given a value within [0, 1], it should succeed", () => {
  const result = Confidence.create(0.42);

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.value).toBe(0.42);
});

test("Confidence.create: given a value above 1, it should fail with ConfidenceOutOfRangeError", () => {
  const result = Confidence.create(1.5);

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("ConfidenceOutOfRangeError");
});

test("Confidence.create: given a negative value, it should fail with ConfidenceOutOfRangeError", () => {
  const result = Confidence.create(-0.1);

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("ConfidenceOutOfRangeError");
});
