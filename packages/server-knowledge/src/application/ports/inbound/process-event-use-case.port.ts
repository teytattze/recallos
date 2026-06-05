import type { Tenant } from "@repo/server-kernel";
import type { JsonObject } from "type-fest";

export type ProcessEventUseCaseInput = {
  payload: {
    id: string;
    createdAt: string;
    occuredAt: string;
    body: JsonObject;
    tags: Record<string, string>;
  };
  tenant: Tenant;
};

export type ProcessEventUseCaseOutput = Promise<void>;

export interface ProcessEventUseCasePort {
  execute(input: ProcessEventUseCaseInput): ProcessEventUseCaseOutput;
}
