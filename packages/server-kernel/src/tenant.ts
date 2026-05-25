import { z } from "zod";

import { parsePropsOrThrow } from "./schema.ts";
import { ValueObject } from "./value-object.ts";

/** Whether a tenant is an individual user or an organization. */
export type TenantType = "user" | "organization";

const tenantSchema = z.object({
  type: z.enum(["user", "organization"]),
  id: z.string().min(1, "Tenant id must be a non-empty string"),
});

/**
 * The owner an {@link AggregateRoot} belongs to — the access boundary for
 * RecallOS's memory. A tenant is either a single `user` or an `organization`,
 * identified by `id` (the `org_id`/`user_id` an authenticated request resolves
 * to). Modelled as a {@link ValueObject}: two tenants are equal when both `type`
 * and `id` match.
 *
 * The same boundary is enforced at the row level in the database (RLS) so an
 * application bug can't cross tenants. An empty `id` is an impossible state, not
 * a domain failure, so construction runs `tenantSchema` through
 * {@link parsePropsOrThrow} and **throws** rather than returning a `Result`.
 *
 * ```ts
 * const t = Tenant.organization(orgId);
 * t.type; // "organization"
 * ```
 */
export class Tenant extends ValueObject<{ type: TenantType; id: string }> {
  private constructor(type: TenantType, id: string) {
    super(parsePropsOrThrow(tenantSchema, { type, id }));
  }

  get type(): TenantType {
    return this._props.type;
  }

  get id(): string {
    return this._props.id;
  }

  static user(id: string): Tenant {
    return new Tenant("user", id);
  }

  static organization(id: string): Tenant {
    return new Tenant("organization", id);
  }

  static of(type: TenantType, id: string): Tenant {
    return new Tenant(type, id);
  }
}
