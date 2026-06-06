import { test, expect } from "bun:test";

import { createFixedClock } from "./clock.ts";

test("createFixedClock.now: given a fixed instant, it should return that instant on every call", () => {
  // GIVEN
  const at = new Date("2026-01-01T00:00:00Z");
  const clock = createFixedClock(at);

  // WHEN / THEN
  expect(clock.now()).toEqual(at);
  expect(clock.now()).toEqual(at);
});

test("createFixedClock.now: given a mutated returned date, it should not affect later calls", () => {
  // GIVEN
  const clock = createFixedClock(new Date("2026-01-01T00:00:00Z"));

  // WHEN
  const first = clock.now();
  first.setFullYear(2000);

  // THEN
  expect(clock.now()).toEqual(new Date("2026-01-01T00:00:00Z"));
});

test("createFixedClock.now: given the input date mutated after construction, it should not affect now", () => {
  // GIVEN
  const at = new Date("2026-01-01T00:00:00Z");
  const clock = createFixedClock(at);

  // WHEN
  at.setFullYear(2000);

  // THEN
  expect(clock.now()).toEqual(new Date("2026-01-01T00:00:00Z"));
});
