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

test("Tenant.fromString: given a serialized tenant, it should restore that tenant", () => {
  // GIVEN / WHEN
  const tenant = Tenant.fromString("user:u1");

  // THEN
  expect(tenant.type).toBe("user");
  expect(tenant.id).toBe("u1");
});

test("Tenant.toString: given a tenant, it should return the serialized tenant", () => {
  // GIVEN
  const tenant = Tenant.create("organization", "org1");

  // WHEN / THEN
  expect(tenant.toString()).toBe("organization:org1");
});

test("Tenant.fromString: given a tenant without an id, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => Tenant.fromString("user")).toThrow();
});
