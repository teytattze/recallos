import type { Id } from "./id.ts";

import { AggregateRoot } from "./aggregate-root.ts";
import { EntityMetadata } from "./metadata.ts";
import { Tenant } from "./tenant.ts";

abstract class TenantAwareAggregateRoot<
  TId extends Id,
  TProps extends Record<string, unknown> = Record<never, never>,
> extends AggregateRoot<TId, TProps> {
  protected readonly _tenant: Tenant;

  protected constructor(
    id: TId,
    tenant: Tenant,
    metadata: EntityMetadata,
    props: TProps,
  ) {
    super(id, metadata, props);
    this._tenant = tenant;
  }

  get tenant(): Tenant {
    return this._tenant;
  }
}

export { TenantAwareAggregateRoot };
