import type { Tenant } from "@repo/server-kernel";
import type { JsonObject } from "type-fest";

export type ProcessEventInput = {
  payload: {
    id: string;
    createdAt: string;
    occuredAt: string;
    body: JsonObject;
    tags: Record<string, string>;
  };
  tenant: Tenant;
};

export type ProcessEventOutput = Promise<void>;

export interface ProcessEvent {
  execute(input: ProcessEventInput): ProcessEventOutput;
}
