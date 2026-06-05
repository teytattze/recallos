export interface OutboxMessage {
  eventId: string;
  occurredAt: Date;
  createdAt: Date;
  tags: Record<string, string>;
  body: Record<string, unknown>;
}
