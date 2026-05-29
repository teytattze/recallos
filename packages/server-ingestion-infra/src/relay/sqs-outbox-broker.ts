import { SendMessageCommand, type SQSClient } from "@aws-sdk/client-sqs";

import type { OutboxBroker } from "./outbox-broker.ts";
import type { OutboxMessage } from "./outbox-message.ts";

/** SQS's managed retries and DLQ are the delivery guarantee; the relay only
 *  needs the send to succeed before it marks the row sent. */
export class SqsOutboxBroker implements OutboxBroker {
  constructor(
    private readonly sqs: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async publish(message: OutboxMessage): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
      }),
    );
  }
}
