import type {
  AuthenticateWebhookRequestPort,
  AuthenticateWebhookRequestPortInput,
  AuthenticateWebhookRequestPortOutput,
  GetWebhookSubscriptionPort,
  GetWebhookSubscriptionPortInput,
  GetWebhookSubscriptionPortOutput,
  IngestEventPort,
  IngestEventPortInput,
  IngestEventPortOutput,
} from "@repo/server-ingestion-core";

import { test, expect } from "bun:test";

import { createJiraWebhookRoutes } from "./jira-webhook-routes";

class FakeIngestEventUseCase implements IngestEventPort {
  readonly executeCalls: IngestEventPortInput[] = [];

  execute(input: IngestEventPortInput): IngestEventPortOutput {
    this.executeCalls.push(input);
    return Promise.resolve({ id: "event-1" });
  }
}

class FakeAuthenticateWebhookRequestUseCase
  implements AuthenticateWebhookRequestPort
{
  readonly executeCalls: AuthenticateWebhookRequestPortInput[] = [];

  execute(
    input: AuthenticateWebhookRequestPortInput,
  ): AuthenticateWebhookRequestPortOutput {
    this.executeCalls.push(input);
    return Promise.resolve();
  }
}

class FakeGetWebhookSubscriptionUseCase
  implements GetWebhookSubscriptionPort
{
  readonly executeCalls: GetWebhookSubscriptionPortInput[] = [];

  execute(
    input: GetWebhookSubscriptionPortInput,
  ): GetWebhookSubscriptionPortOutput {
    this.executeCalls.push(input);
    return Promise.resolve({
      id: input.payload.id,
      tenant: input.tenant,
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-03T00:00:00Z"),
      provider: "jira",
      context: {
        id: "webhook-subscription-context-1",
        createdAt: new Date("2026-01-04T00:00:00Z"),
        updatedAt: new Date("2026-01-05T00:00:00Z"),
        graphId: "graph-1",
      },
      secret: {
        id: "webhook-secret-1",
        createdAt: new Date("2026-01-06T00:00:00Z"),
        updatedAt: new Date("2026-01-07T00:00:00Z"),
        algorithm: "hmac_sha256",
      },
    });
  }
}

test("createJiraWebhookRoutes: given a valid Jira webhook POST, it should authenticate, resolve the subscription, ingest the raw body, and return 201", async () => {
  // GIVEN
  const authenticateWebhookRequestUseCase =
    new FakeAuthenticateWebhookRequestUseCase();
  const getWebhookSubscriptionUseCase = new FakeGetWebhookSubscriptionUseCase();
  const ingestEventUseCase = new FakeIngestEventUseCase();
  const routes = createJiraWebhookRoutes({
    deps: {
      authenticateWebhookRequest: authenticateWebhookRequestUseCase,
      getWebhookSubscription: getWebhookSubscriptionUseCase,
      ingestEvent: ingestEventUseCase,
    },
  });
  const body = {
    issue: {
      key: "REC-123",
      fields: { summary: "Compose ingestion" },
    },
  };

  // WHEN
  const res = await routes.request(
    "http://localhost/events?tenant=organization:org1&subscriptionId=webhook-subscription-1",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Hub-Signature": "sha256=incoming-signature",
      },
      body: JSON.stringify(body),
    },
  );

  // THEN
  expect(res.status).toBe(201);
  expect(await res.text()).toBe("");
  expect(authenticateWebhookRequestUseCase.executeCalls).toEqual([
    {
      tenant: "organization:org1",
      payload: {
        id: "webhook-subscription-1",
        provider: "jira",
        incomingSignature: "incoming-signature",
        incomingBody: JSON.stringify(body),
      },
    },
  ]);
  expect(getWebhookSubscriptionUseCase.executeCalls).toEqual([
    {
      tenant: "organization:org1",
      payload: { id: "webhook-subscription-1" },
    },
  ]);
  expect(ingestEventUseCase.executeCalls).toHaveLength(1);

  const call = ingestEventUseCase.executeCalls[0]!;
  expect(call.tenant.toString()).toBe("organization:org1");
  expect(call.payload).toEqual({
    external: { id: "", provider: "jira" },
    graphId: "graph-1",
    raw: body,
  });
});
