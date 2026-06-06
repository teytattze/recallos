import { SendMessageCommand, type SQSClient } from "@aws-sdk/client-sqs";

import type { OutboxBrokerPort } from "./outbox-broker-port.ts";
import type { OutboxMessage } from "./outbox-message.ts";

class SqsOutboxBroker implements OutboxBrokerPort {
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

export { SqsOutboxBroker };
