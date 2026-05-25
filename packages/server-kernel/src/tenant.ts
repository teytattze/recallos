import { z } from "zod";

import { parsePropsOrThrow } from "./schema.ts";
import { ValueObject } from "./value-object.ts";

export type TenantType = "user" | "organization";

const tenantSchema = z.object({
  type: z.enum(["user", "organization"]),
  id: z.string().min(1, "Tenant id must be a non-empty string"),
});

/**
 * The owner an {@link AggregateRoot} belongs to — the access boundary for
 * RecallOS's memory. Identified by `id` (the `org_id`/`user_id` an authenticated
 * request resolves to); the same boundary is mirrored at the row level (RLS). An
 * empty `id` is an impossible state, so construction runs through
 * {@link parsePropsOrThrow} and **throws** rather than returning a {@link Result}.
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
