import { AppError } from "@repo/app-error";
import { test, expect } from "bun:test";

import type { EventExternalPropsIn } from "./event-external.ts";

import { EventExternal } from "./event-external.ts";

const external = {
  id: "jira-123",
  provider: "jira",
} satisfies EventExternalPropsIn;

test("EventExternal.create: given a Jira external reference, it should expose its props", () => {
  // GIVEN
  const payload = external;

  // WHEN
  const value = EventExternal.create({ payload });

  // THEN
  expect(String(value.toJSON().id)).toBe(external.id);
  expect(String(value.toJSON().provider)).toBe(external.provider);
});

test("EventExternal.restore: given a Jira external reference, it should expose its props", () => {
  // GIVEN
  const payload = external;

  // WHEN
  const value = EventExternal.restore({ payload });

  // THEN
  expect(String(value.toJSON().id)).toBe(external.id);
  expect(String(value.toJSON().provider)).toBe(external.provider);
});

test("EventExternal.create: given an unsupported provider, it should throw an InvariantViolation app error", () => {
  // GIVEN / WHEN
  let error: unknown;
  try {
    EventExternal.create({
      payload: {
        ...external,
        provider: "github",
      } as unknown as EventExternalPropsIn,
    });
  } catch (caught) {
    error = caught;
  }

  // THEN
  expect(error).toBeInstanceOf(AppError);
  expect(AppError.from(error).code).toBe("invariantViolation");
});

test("EventExternal.restore: given an unsupported provider, it should throw an InvariantViolation app error", () => {
  // GIVEN / WHEN
  let error: unknown;
  try {
    EventExternal.restore({
      payload: {
        ...external,
        provider: "github",
      } as unknown as EventExternalPropsIn,
    });
  } catch (caught) {
    error = caught;
  }

  // THEN
  expect(error).toBeInstanceOf(AppError);
  expect(AppError.from(error).code).toBe("invariantViolation");
});

test("EventExternal.equals: given the same payload, it should be equal", () => {
  // GIVEN / WHEN / THEN
  expect(
    EventExternal.restore({ payload: external }).equals(
      EventExternal.restore({ payload: external }),
    ),
  ).toBe(true);
});
