import { test, expect } from "bun:test";

import { Id } from "./id.ts";
import { EntityMetadata } from "./metadata.ts";
import { TenantAwareAggregateRoot } from "./tenant-aware-aggregate-root.ts";
import { Tenant } from "./tenant.ts";

class TestId extends Id {
  static from(value: string): TestId {
    return new TestId(value);
  }
}

class TestTenantAwareAgg extends TenantAwareAggregateRoot<TestId> {
  static of(
    id: TestId,
    tenant: Tenant,
    metadata: EntityMetadata,
  ): TestTenantAwareAgg {
    return new TestTenantAwareAgg(id, tenant, metadata, {});
  }
}

const fixedMeta = EntityMetadata.create({
  payload: { now: new Date("2026-01-01T00:00:00Z") },
});

test("TenantAwareAggregateRoot.tenant: given a constructed aggregate, it should expose the tenant", () => {
  // GIVEN
  const tenant = Tenant.create("organization", "org1");
  const agg = TestTenantAwareAgg.of(TestId.from("a1"), tenant, fixedMeta);

  // WHEN / THEN
  expect(agg.tenant).toBe(tenant);
});
