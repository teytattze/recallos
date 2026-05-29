/** Body stays in `events` (the source of truth), so the message can't go stale
 *  and never nears the broker's size cap. */
export interface OutboxMessage {
  eventId: string;
  occurredAt: Date;
  recordedAt: Date;
  tags: Record<string, string>;
}
