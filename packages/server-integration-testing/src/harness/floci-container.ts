import { CreateQueueCommand, SQSClient } from "@aws-sdk/client-sqs";
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";

// floci emulates the AWS surface (here: SQS) on a single endpoint; credentials are
// fixed test values (see compose.yml). SQS is emulated in-process, so no Docker
// socket mount or shared network is needed for this — just the HTTP port.
const FLOCI_IMAGE = "floci/floci:latest";
const FLOCI_PORT = 4566;
const FLOCI_REGION = "us-east-1";
const OUTBOX_QUEUE_NAME = "recallos-event-outbox";

export interface StartedFloci {
  container: StartedTestContainer;
  sqs: SQSClient;
  endpoint: string;
  queueUrl: string;
}

/** Boots the real floci emulator and provisions the outbox SQS queue against it. */
export async function startFloci(): Promise<StartedFloci> {
  const container = await new GenericContainer(FLOCI_IMAGE)
    .withExposedPorts(FLOCI_PORT)
    .withWaitStrategy(Wait.forHttp("/_floci/health", FLOCI_PORT))
    .start();

  const endpoint = `http://${container.getHost()}:${container.getMappedPort(FLOCI_PORT)}`;
  const sqs = new SQSClient({
    region: FLOCI_REGION,
    endpoint,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });

  const { QueueUrl } = await sqs.send(
    new CreateQueueCommand({ QueueName: OUTBOX_QUEUE_NAME }),
  );
  if (!QueueUrl) throw new Error("floci did not return a queue url");

  return { container, sqs, endpoint, queueUrl: QueueUrl };
}
