import { test, expect } from "bun:test";

import { Tenant } from "./tenant.ts";

test("Tenant.user: given an id, it should build a user tenant", () => {
  // GIVEN / WHEN
  const tenant = Tenant.user("u1");

  // THEN
  expect(tenant.type).toBe("user");
  expect(tenant.id).toBe("u1");
});

test("Tenant.organization: given an id, it should build an organization tenant", () => {
  // GIVEN / WHEN
  const tenant = Tenant.organization("org1");

  // THEN
  expect(tenant.type).toBe("organization");
  expect(tenant.id).toBe("org1");
});

test("Tenant.of: given a type and id, it should build that tenant", () => {
  // GIVEN / WHEN
  const tenant = Tenant.of("organization", "org2");

  // THEN
  expect(tenant.type).toBe("organization");
  expect(tenant.id).toBe("org2");
});

test("Tenant.equals: given the same type and id, it should return true", () => {
  // GIVEN / WHEN / THEN
  expect(Tenant.user("u1").equals(Tenant.of("user", "u1"))).toBe(true);
});

test("Tenant.equals: given a differing type, it should return false", () => {
  // GIVEN / WHEN / THEN
  expect(Tenant.user("x").equals(Tenant.organization("x"))).toBe(false);
});

test("Tenant.equals: given a differing id, it should return false", () => {
  // GIVEN / WHEN / THEN
  expect(Tenant.user("a").equals(Tenant.user("b"))).toBe(false);
});

test("Tenant constructor: given an empty id, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => Tenant.user("")).toThrow();
});
