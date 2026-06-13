import { test, expect } from "bun:test";

import type { EventExternalPropsIn } from "./event-external.ts";

import { EventExternal } from "./event-external.ts";

const external = {
  id: "jira-123",
  provider: "jira",
} satisfies EventExternalPropsIn;

test("EventExternal.create: given a Jira external reference, it should expose its props", () => {
  // GIVEN / WHEN
  const value = EventExternal.create({ payload: external });

  // THEN
  expect(String(value.toJSON().id)).toBe(external.id);
  expect(String(value.toJSON().provider)).toBe(external.provider);
});

test("EventExternal.restore: given a Jira external reference, it should expose its props", () => {
  // GIVEN / WHEN
  const value = EventExternal.restore({ payload: external });

  // THEN
  expect(String(value.toJSON().id)).toBe(external.id);
  expect(String(value.toJSON().provider)).toBe(external.provider);
});

test("EventExternal.create: given an unsupported provider, it should throw an InvalidEvent error", () => {
  // GIVEN / WHEN / THEN
  expect(() =>
    EventExternal.create({
      payload: {
        ...external,
        provider: "github",
      } as unknown as EventExternalPropsIn,
    }),
  ).toThrow(expect.objectContaining({ kind: "InvalidEvent" }));
});

test("EventExternal.restore: given an unsupported provider, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() =>
    EventExternal.restore({
      payload: {
        ...external,
        provider: "github",
      } as unknown as EventExternalPropsIn,
    }),
  ).toThrow();
});

test("EventExternal.equals: given the same payload, it should be equal", () => {
  // GIVEN / WHEN / THEN
  expect(
    EventExternal.restore({ payload: external }).equals(
      EventExternal.restore({ payload: external }),
    ),
  ).toBe(true);
});
