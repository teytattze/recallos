import type { OutboxMessage } from "./outbox-message.ts";

/** Kept swappable so the publication seam (SQS today) can change without
 *  touching the relay. */
export interface OutboxBroker {
  publish(message: OutboxMessage): Promise<void>;
}
