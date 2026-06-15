import { WebhookSecret } from "@repo/server-ingestion-core";
import { expect, test } from "bun:test";

import { NodeWebhookSignatureGenerator } from "./node-webhook-signature-generator.ts";

test("NodeWebhookSignatureGenerator.generate: given a webhook secret and payload, it should return an HMAC SHA-256 hex signature", () => {
  // GIVEN
  const secret = WebhookSecret.restore({
    metadata: {
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    },
    payload: {
      id: "webhook-secret-1",
      algorithm: "hmac_sha256",
      value: "secret-value",
    },
  });
  const generator = new NodeWebhookSignatureGenerator();

  // WHEN
  const signature = generator.generate({
    secret,
    payload: JSON.stringify({ issue: { key: "REC-123" } }),
  });

  // THEN
  expect(signature).toBe(
    "094b035db3e6fdb846f414747cb1992a9e0a2af2f7f57db72cd4dae993ccafa4",
  );
});
