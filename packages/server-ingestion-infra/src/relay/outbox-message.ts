export interface OutboxMessage {
  eventId: string;
  occurredAt: Date;
  recordedAt: Date;
  tags: Record<string, string>;
  body: Record<string, unknown>;
}
