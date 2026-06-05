import type { Result, Tenant } from "@repo/server-kernel";

export type IngestEventUseCaseInput = {
  tenant: Tenant;
  payload: {
    occurredAt: Date;
    tags: Record<string, string>;
    body: Record<string, unknown>;
  };
};

export type IngestEventUseCaseOutput = {
  eventId: string;
};

export interface IngestEventUseCasePort {
  execute(
    input: IngestEventUseCaseInput,
  ): Promise<Result<IngestEventUseCaseOutput>>;
}
