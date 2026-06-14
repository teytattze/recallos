import { z } from "zod";

import { parseProps } from "./schema.ts";
import { ValueObject } from "./value-object.ts";

const tenantTypes = ["user", "organization"] as const;

const tenantPropsSchema = z.object({
  type: z.enum(tenantTypes),
  id: z.string().min(1, "Tenant id must be a non-empty string"),
});

type TenantPropsSchema = z.output<typeof tenantPropsSchema>;
type TenantType = TenantPropsSchema["type"];

class Tenant extends ValueObject<TenantPropsSchema> {
  static create(type: TenantType, id: string): Tenant {
    return new Tenant(parseProps(tenantPropsSchema, { type, id }));
  }

  static fromString(tenant: string): Tenant {
    const splitted = tenant.split(":");
    return new Tenant(
      parseProps(tenantPropsSchema, {
        type: splitted[0],
        id: splitted[1],
      }),
    );
  }

  override toString(): string {
    return `${this.type}:${this.id}`;
  }

  get type(): TenantType {
    return this._props.type;
  }

  get id(): string {
    return this._props.id;
  }
}

export { Tenant };
export type { TenantType };
