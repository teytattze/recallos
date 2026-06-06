import type { Result, Tenant } from "@repo/server-kernel";

type IngestEventPortInput = {
  tenant: Tenant;
  payload: {
    occurredAt: Date;
    tags: Record<string, string>;
    body: Record<string, unknown>;
  };
};

type IngestEventPortOutput = {
  eventId: string;
};

interface IngestEventPort {
  execute(input: IngestEventPortInput): Promise<Result<IngestEventPortOutput>>;
}

export type { IngestEventPortInput, IngestEventPortOutput, IngestEventPort };
