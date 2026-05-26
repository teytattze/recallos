import type { Result } from "@repo/server-kernel";

/** `recordedAt` is omitted: the use case stamps it from a Clock, not the caller. */
export type IngestEventInput = {
  occurredAt: Date;
  tags: Record<string, string>;
  body: Record<string, unknown>;
};

/** Id only — the aggregate must not cross the inbound boundary. */
export type IngestEventOutput = {
  eventId: string;
};

/** Returns `Result` because failure (e.g. `InvalidEvent`) is expected; true
 *  faults throw and are mapped to a response at the adapter. */
export interface IngestEvent {
  execute(input: IngestEventInput): Promise<Result<IngestEventOutput>>;
}
