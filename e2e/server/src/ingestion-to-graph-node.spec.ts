import { createHmac } from "node:crypto";
import { expect } from "playwright/test";

import { test } from "./fixtures/system.js";

test("ingestion pipeline: given a signed Jira webhook event, it should create a fetchable graph node", async ({
  system,
}) => {
  // GIVEN
  const body = {
    issue: {
      id: "jira-issue-10001",
      key: "REC-123",
      fields: { summary: "Verify the complete ingestion pipeline" },
    },
  };
  const signature = createHmac("sha256", system.webhookSecret)
    .update(JSON.stringify(body))
    .digest("hex");
  const webhookQuery = new URLSearchParams({
    tenant: system.tenant,
    subscriptionId: system.subscriptionId,
  });

  // WHEN
  const ingestionResponse = await system.api.post(
    `/api/v1/external-providers/jira/events?${webhookQuery.toString()}`,
    {
      data: body,
      headers: { "X-Hub-Signature": `sha256=${signature}` },
    },
  );

  // THEN
  expect(ingestionResponse.status()).toBe(201);
  const ingestion = (await ingestionResponse.json()) as { id: string };
  expect(ingestion.id).toEqual(expect.any(String));

  const nodeQuery = new URLSearchParams({ tenant: system.tenant });
  const nodePath = `/api/v1/graph-nodes/by-event/${encodeURIComponent(ingestion.id)}?${nodeQuery.toString()}`;
  await expect
    .poll(async () => (await system.api.get(nodePath)).status(), {
      timeout: 20_000,
      intervals: [100, 250, 500],
    })
    .toBe(200);

  const nodeResponse = await system.api.get(nodePath);
  expect(nodeResponse.status()).toBe(200);
  expect(await nodeResponse.json()).toMatchObject({
    tenant: system.tenant,
    eventId: ingestion.id,
    graphId: system.graphId,
    rawEvent: body,
  });
});
