import type { Id } from "./id.ts";

import { AggregateRoot } from "./aggregate-root.ts";
import { EntityMetadata } from "./metadata.ts";
import { Tenant } from "./tenant.ts";

/**
 * An {@link AggregateRoot} owned by a {@link Tenant}. Extend this instead of
 * {@link AggregateRoot} for a root scoped to a user or organization: `tenant` is
 * guaranteed at the type level, so callers never null-check it and a global root
 * can't accidentally carry one. Set once and immutable, like the id; the same
 * boundary is mirrored at the row level in the database (RLS).
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
