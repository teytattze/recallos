import { test, expect } from "bun:test";

import type { DomainEvent } from "./domain-event.ts";

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
  raise(e: DomainEvent): void {
    this.recordEvent(e);
  }
}

const fixedMeta = EntityMetadata.create(new Date("2026-01-01T00:00:00Z"));

test("TenantAwareAggregateRoot.tenant: given a constructed aggregate, it should return the injected tenant", () => {
  // GIVEN
  const tenant = Tenant.organization("org1");
  const agg = TestTenantAwareAgg.of(TestId.from("a1"), tenant, fixedMeta);

  // WHEN / THEN
  expect(agg.tenant).toBe(tenant);
});

test("TenantAwareAggregateRoot.metadata: given a constructed aggregate, it should expose inherited metadata", () => {
  // GIVEN
  const agg = TestTenantAwareAgg.of(
    TestId.from("a1"),
    Tenant.user("u1"),
    fixedMeta,
  );

  // WHEN / THEN
  expect(agg.metadata).toBe(fixedMeta);
});

test("TenantAwareAggregateRoot.pullDomainEvents: given a prior drain, it should drain once (inherited)", () => {
  // GIVEN
  const agg = TestTenantAwareAgg.of(
    TestId.from("a1"),
    Tenant.user("u1"),
    fixedMeta,
  );
  agg.raise({
    eventName: "Happened",
    aggregateId: "a1",
    occurredAt: new Date("2026-01-01T00:00:00Z"),
  });
  agg.pullDomainEvents();

  // WHEN
  const second = agg.pullDomainEvents();

  // THEN
  expect(second).toEqual([]);
});
