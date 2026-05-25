import type { Id } from "./id.ts";

import { AggregateRoot } from "./aggregate-root.ts";
import { EntityMetadata } from "./metadata.ts";
import { Tenant } from "./tenant.ts";

/**
 * An {@link AggregateRoot} owned by a {@link Tenant} — the access boundary for
 * RecallOS's memory. Extend this (instead of {@link AggregateRoot}) for any root
 * scoped to a user or organization; the `tenant` is then guaranteed present at
 * the type level, so callers never null-check it and a global root can never
 * accidentally carry one.
 *
 * `tenant` is set once at creation and immutable, like the id. The same boundary
 * is enforced at the row level in the database (RLS) so an application bug can't
 * cross tenants.
 */
export abstract class TenantAggregateRoot<
  TId extends Id,
  T extends Record<string, unknown> = Record<string, never>,
> extends AggregateRoot<TId, T> {
  protected readonly _tenant: Tenant;

  protected constructor(
    id: TId,
    tenant: Tenant,
    metadata: EntityMetadata,
    props: T,
  ) {
    super(id, metadata, props);
    this._tenant = tenant;
  }

  get tenant(): Tenant {
    return this._tenant;
  }
}
