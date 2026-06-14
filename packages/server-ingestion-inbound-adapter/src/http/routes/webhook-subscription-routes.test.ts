import type {
  CreateWebhookSubscriptionPort,
  CreateWebhookSubscriptionPortInput,
  CreateWebhookSubscriptionPortOutput,
} from "@repo/server-ingestion-core";

import { test, expect } from "bun:test";

import { createWebhookSubscriptionRoutes } from "./webhook-subscription-routes";

class FakeCreateWebhookSubscriptionUseCase
  implements CreateWebhookSubscriptionPort
{
  readonly executeCalls: CreateWebhookSubscriptionPortInput[] = [];

  execute(
    input: CreateWebhookSubscriptionPortInput,
  ): CreateWebhookSubscriptionPortOutput {
    this.executeCalls.push(input);
    return Promise.resolve({
      id: "webhook-subscription-1",
      secret: {
        algorithm: "hmac_sha256",
        value: "secret-value",
      },
    });
  }
}

test("createWebhookSubscriptionRoutes: given a valid webhook subscription POST, it should pass the context and return the secret", async () => {
  // GIVEN
  const createWebhookSubscriptionUseCase =
    new FakeCreateWebhookSubscriptionUseCase();
  const routes = createWebhookSubscriptionRoutes({
    deps: { createWebhookSubscription: createWebhookSubscriptionUseCase },
  });

  // WHEN
  const res = await routes.request(
    "http://localhost/webhook-subscriptions?tenant=organization:org1",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "jira",
        context: { graphId: "graph-1" },
        secret: { algorithm: "hmac_sha256" },
      }),
    },
  );

  // THEN
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({
    secret: {
      algorithm: "hmac_sha256",
      value: "secret-value",
    },
  });
  expect(createWebhookSubscriptionUseCase.executeCalls).toEqual([
    {
      tenant: "organization:org1",
      payload: {
        provider: "jira",
        context: { graphId: "graph-1" },
        secret: { algorithm: "hmac_sha256" },
      },
    },
  ]);
});
