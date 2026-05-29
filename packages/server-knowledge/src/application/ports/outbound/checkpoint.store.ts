import type { EventId } from "../../../domain/event-id.value-object.ts";

/**
 * The high-water mark of *progress* through the ingest log — "events up to here
 * have been pulled." Keyed on `recordedAt` (monotonic capture order of an
 * append-only log); `lastEventId` disambiguates ties. Distinct from the
 * processed-events ledger, which tracks *effect* (§9).
 */
export type Checkpoint = {
  recordedAt: Date;
  lastEventId: EventId;
};

export interface CheckpointStore {
  load(name: string): Promise<Checkpoint>;
  save(name: string, cursor: Checkpoint): Promise<void>;
}
