import type { Result, Tenant } from "@repo/server-kernel";

type IngestEventPortInput = {
  tenant: Tenant;
  payload: {
    occurredAt: Date;
    tags: Record<string, string>;
    body: Record<string, unknown>;
    graphId: string;
  };
};

type IngestEventPortOutput = Promise<Result<{ eventId: string }>>;

interface IngestEventPort {
  execute(input: IngestEventPortInput): IngestEventPortOutput;
}

export type { IngestEventPortInput, IngestEventPortOutput, IngestEventPort };
