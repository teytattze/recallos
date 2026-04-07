import type { BaseFields } from "@/db/schema";

function newBaseFieldsValue(): BaseFields {
  return {
    id: Bun.randomUUIDv7(),
  };
}

export { newBaseFieldsValue };
