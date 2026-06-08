import type { Result, Tenant } from "@repo/server-kernel";
import type { JsonObject } from "type-fest";

type IngestEventPortInput = {
  tenant: Tenant;
  payload: {
    external: { id: string; provider: "jira" };
    graphId: string;
    raw: JsonObject;
  };
};
type IngestEventPortOutput = Promise<Result<{ id: string }>>;

interface IngestEventPort {
  execute(input: IngestEventPortInput): IngestEventPortOutput;
}

export type { IngestEventPortInput, IngestEventPortOutput, IngestEventPort };
