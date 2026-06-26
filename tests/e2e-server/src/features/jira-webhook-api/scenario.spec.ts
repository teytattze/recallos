import { createHmac } from "node:crypto";
import { expect } from "playwright/test";

import { test } from "../../fixtures/system.js";
import {
  DATABASE_NAME,
  GRAPH,
  GRAPH_ID,
  IAM_API_KEY,
  IAM_API_KEY_RECORD,
  SUBSCRIPTION_ID,
  TENANT,
  WEBHOOK_BODY,
  WEBHOOK_SECRET,
  WEBHOOK_SUBSCRIPTION,
} from "./scenario-data.js";

test.beforeEach(async ({ system }) => {
  await system.database.seedCollection({
    databaseName: DATABASE_NAME,
    collectionName: "apikey",
    docs: [IAM_API_KEY_RECORD],
  });
  await system.database.seedCollection({
    databaseName: DATABASE_NAME,
    collectionName: "graphs",
    docs: [GRAPH],
  });
  await system.database.seedCollection({
    databaseName: DATABASE_NAME,
    collectionName: "webhook-subscriptions",
    docs: [WEBHOOK_SUBSCRIPTION],
  });
});

test.afterEach(async ({ system }) => {
  const collectionNames = [
    "events",
    "apikey",
    "graph-nodes",
    "graphs",
    "webhook-subscriptions",
  ];
  await Promise.all(
    collectionNames.map((collectionName) =>
      system.database.resetCollection({
        databaseName: DATABASE_NAME,
        collectionName,
      }),
    ),
  );
});

test("Jira client: submits an authenticated webhook event, the event becomes available for recall", async ({
  system,
}) => {
  // GIVEN
  const signature = createHmac("sha256", WEBHOOK_SECRET)
    .update(JSON.stringify(WEBHOOK_BODY))
    .digest("hex");
  const webhookQuery = new URLSearchParams({
    tenant: TENANT,
    subscriptionId: SUBSCRIPTION_ID,
  });

  // WHEN
  const ingestionResponse = await system.api.post(
    `/api/v1/external-providers/jira/events?${webhookQuery.toString()}`,
    {
      data: WEBHOOK_BODY,
      headers: { "X-Hub-Signature": `sha256=${signature}` },
    },
  );

  // THEN
  expect(ingestionResponse.status()).toBe(201);
  const ingestion = (await ingestionResponse.json()) as { id: string };
  expect(ingestion.id).toEqual(expect.any(String));

  const nodeQuery = new URLSearchParams({
    eventId: ingestion.id,
  });
  const nodePath = `/api/v1/graphs/${encodeURIComponent(GRAPH_ID)}/nodes?${nodeQuery.toString()}`;
  await expect
    .poll(
      async () => {
        const response = await system.api.get(nodePath, {
          headers: { "X-API-Key": IAM_API_KEY },
        });
        const body = (await response.json()) as { data: unknown[] };
        return body.data.length;
      },
      {
        timeout: 20_000,
        intervals: [100, 250, 500],
      },
    )
    .toBe(1);

  const nodeResponse = await system.api.get(nodePath, {
    headers: { "X-API-Key": IAM_API_KEY },
  });
  expect(nodeResponse.status()).toBe(200);
  expect(await nodeResponse.json()).toEqual({
    data: [
      expect.objectContaining({
        tenant: TENANT,
        eventId: ingestion.id,
        graphId: GRAPH_ID,
        rawEvent: WEBHOOK_BODY,
      }),
    ],
  });
});
