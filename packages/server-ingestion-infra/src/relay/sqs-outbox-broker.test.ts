import { SendMessageCommand, type SQSClient } from "@aws-sdk/client-sqs";
import { expect, mock, test } from "bun:test";

import type { OutboxMessage } from "./outbox-message.ts";

import { SqsOutboxBroker } from "./sqs-outbox-broker.ts";

test("SqsOutboxBroker.publish: given a message, it should send its JSON body to the queue url", async () => {
  // given
  const send = mock((_command: SendMessageCommand) => Promise.resolve());
  const sqs = { send } as unknown as SQSClient;
  const broker = new SqsOutboxBroker(sqs, "https://sqs.local/queue");
  const message: OutboxMessage = {
    eventId: "event-1",
    occurredAt: new Date("2026-01-01T00:00:00Z"),
    recordedAt: new Date("2026-01-02T00:00:00Z"),
    tags: { source: "slack" },
  };

  // when
  await broker.publish(message);

  // then
  expect(send).toHaveBeenCalledTimes(1);
  const command = send.mock.calls[0]?.[0];
  expect(command).toBeInstanceOf(SendMessageCommand);
  expect(command?.input).toEqual({
    QueueUrl: "https://sqs.local/queue",
    MessageBody: JSON.stringify(message),
  });
});
