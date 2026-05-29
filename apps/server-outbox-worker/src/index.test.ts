import { expect, test } from "bun:test";

import { app, loadWorkerConfig } from "./index.ts";

const validEnv = {
  AWS_REGION: "us-east-1",
  SQS_QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/123456789012/outbox",
};

test("loadWorkerConfig: given valid env, it should parse with batch-size and idle-delay defaults", () => {
  // when
  const config = loadWorkerConfig(validEnv);

  // then
  expect(config.AWS_REGION).toBe("us-east-1");
  expect(config.SQS_QUEUE_URL).toBe(validEnv.SQS_QUEUE_URL);
  expect(config.OUTBOX_RELAY_BATCH_SIZE).toBe(10);
  expect(config.OUTBOX_RELAY_IDLE_DELAY_MS).toBe(1000);
});

test("loadWorkerConfig: given a missing queue url, it should throw", () => {
  // when / then
  expect(() => loadWorkerConfig({ AWS_REGION: "us-east-1" })).toThrow(
    /Invalid worker configuration/,
  );
});

test("GET /api/v1/health: it should respond ok", async () => {
  // when
  const res = await app.request("/api/v1/health");

  // then
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ message: "ok" });
});
