import type { OutboxMessage } from "./outbox-message.ts";

interface OutboxBrokerPort {
  publish(message: OutboxMessage): Promise<void>;
}

export type { OutboxBrokerPort };
