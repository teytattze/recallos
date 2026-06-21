import { createHmac } from "node:crypto";
import { expect } from "playwright/test";

import { test } from "../../fixtures/system.js";
import {
  DATABASE_NAME,
  GRAPH,
  GRAPH_ID,
  SUBSCRIPTION_ID,
  TENANT,
  WEBHOOK_BODY,
  WEBHOOK_SECRET,
  WEBHOOK_SUBSCRIPTION,
} from "./scenario-data.js";

test.beforeEach(async ({ system }) => {
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

  const nodeQuery = new URLSearchParams({ tenant: TENANT });
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
    tenant: TENANT,
    eventId: ingestion.id,
    graphId: GRAPH_ID,
    rawEvent: WEBHOOK_BODY,
  });
});
