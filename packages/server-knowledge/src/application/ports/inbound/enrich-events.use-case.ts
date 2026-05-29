import type { Result } from "@repo/server-kernel";

import type { Checkpoint } from "../outbound/checkpoint.store.ts";

export type EnrichEventsInput = {
  batchSize: number;
};

export type EnrichmentReport = {
  pulled: number;
  processed: number;
  skipped: number;
  failed: number;
  nodesUpserted: number;
  edgesWritten: number;
  cursor: Checkpoint;
};

/**
 * The hot path: read a page of new events, extract → resolve → upsert nodes →
 * relate edges → advance the cursor → publish domain events, as one run.
 * Agnostic to *who* drives it (cron today, a queue consumer later — §3).
 */
export interface EnrichEvents {
  execute(input: EnrichEventsInput): Promise<Result<EnrichmentReport>>;
}
