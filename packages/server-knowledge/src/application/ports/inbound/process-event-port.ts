import type { Result, Tenant } from "@repo/server-kernel";

type ProcessEventPortInput = {
  tenant: Tenant;
  payload: {
    event: {
      id: string;
      createdAt: Date;
      occurredAt: Date;
      body: string;
      tags: Record<string, string>;
      graphId: string;
    };
  };
};

type ProcessEventPortOutput = Promise<Result<void>>;

interface ProcessEventPort {
  execute(input: ProcessEventPortInput): ProcessEventPortOutput;
}

export type { ProcessEventPortInput, ProcessEventPortOutput, ProcessEventPort };
