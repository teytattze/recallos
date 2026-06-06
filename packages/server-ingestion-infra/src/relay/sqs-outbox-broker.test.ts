import { SendMessageCommand, type SQSClient } from "@aws-sdk/client-sqs";
import { expect, test } from "bun:test";

import type { OutboxMessage } from "./outbox-message.ts";

import { SqsOutboxBroker } from "./sqs-outbox-broker.ts";

test("SqsOutboxBroker.publish: given a message, it should send its JSON body to the queue url", async () => {
  // GIVEN
  const sentCommands: SendMessageCommand[] = [];
  const send = (command: SendMessageCommand): Promise<void> => {
    sentCommands.push(command);
    return Promise.resolve();
  };
  const sqs = { send } as unknown as SQSClient;
  const broker = new SqsOutboxBroker(sqs, "https://sqs.local/queue");
  const message: OutboxMessage = {
    eventId: "event-1",
    occurredAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-02T00:00:00Z"),
    tags: { source: "slack" },
    body: { text: "hello" },
  };

  // WHEN
  await broker.publish(message);

  // THEN
  expect(sentCommands).toHaveLength(1);
  const command = sentCommands[0];
  expect(command).toBeInstanceOf(SendMessageCommand);
  expect(command?.input).toEqual({
    QueueUrl: "https://sqs.local/queue",
    MessageBody: JSON.stringify(message),
  });
});
