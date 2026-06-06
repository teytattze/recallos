import type { Result, Tenant } from "@repo/server-kernel";

type ProcessEventPortInput = {
  tenant: Tenant;
  payload: {
    id: string;
    createdAt: Date;
    occurredAt: Date;
    body: Record<string, unknown>;
    tags: Record<string, string>;
  };
};

type ProcessEventPortOutput = undefined;

interface ProcessEventPort {
  execute(input: ProcessEventPortInput): Promise<Result<ProcessEventPortOutput>>;
}

export type { ProcessEventPortInput, ProcessEventPortOutput, ProcessEventPort };
