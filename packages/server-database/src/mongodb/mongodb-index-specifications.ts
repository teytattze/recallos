import type { IndexSpecification } from "mongodb";

const mongodbTenantIndexSpecification = {
  tenant: 1,
} as const satisfies IndexSpecification;

export { mongodbTenantIndexSpecification };
