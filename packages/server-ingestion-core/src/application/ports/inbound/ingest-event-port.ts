import type { JsonObject } from "type-fest";

type IngestEventPortInput = {
  tenant: string;
  payload: {
    external: { id: string; provider: "jira" };
    graphId: string;
    raw: JsonObject;
  };
};
type IngestEventPortOutput = Promise<{ id: string }>;

interface IngestEventPort {
  execute(input: IngestEventPortInput): IngestEventPortOutput;
}

export type { IngestEventPortInput, IngestEventPortOutput, IngestEventPort };
