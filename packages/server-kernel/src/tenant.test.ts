import { test, expect } from "bun:test";

import { Tenant } from "./tenant.ts";

test("Tenant.create: given a type and id, it should build that tenant", () => {
  // GIVEN / WHEN
  const tenant = Tenant.create("organization", "org2");

  // THEN
  expect(tenant.type).toBe("organization");
  expect(tenant.id).toBe("org2");
});

test("Tenant.equals: given the same type and id, it should return true", () => {
  // GIVEN / WHEN / THEN
  expect(Tenant.create("user", "u1").equals(Tenant.create("user", "u1"))).toBe(
    true,
  );
});

test.each([
  [
    "a differing type",
    Tenant.create("user", "x"),
    Tenant.create("organization", "x"),
  ],
  ["a differing id", Tenant.create("user", "a"), Tenant.create("user", "b")],
])("Tenant.equals: given %s, it should return false", (_label, a, b) => {
  // GIVEN / WHEN / THEN
  expect(a.equals(b)).toBe(false);
});

test("Tenant.create: given an empty id, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => Tenant.create("user", "")).toThrow();
});
