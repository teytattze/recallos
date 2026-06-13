import type {
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

test("createJiraWebhookRoutes: given a valid Jira webhook POST, it should ingest the raw body and return 201", async () => {
  // GIVEN
  const ingestEventUseCase = new FakeIngestEventUseCase();
  const routes = createJiraWebhookRoutes({
    deps: { ingestEventUseCase },
  });
  const body = {
    issue: {
      key: "REC-123",
      fields: { summary: "Compose ingestion" },
    },
  };

  // WHEN
  const res = await routes.request(
    "http://localhost/events?tenant=organization:org1&graphId=graph-1",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  // THEN
  expect(res.status).toBe(201);
  expect(await res.text()).toBe("");
  expect(ingestEventUseCase.executeCalls).toHaveLength(1);

  const call = ingestEventUseCase.executeCalls[0]!;
  expect(call.tenant.toString()).toBe("organization:org1");
  expect(call.payload).toEqual({
    external: { id: "", provider: "jira" },
    graphId: "graph-1",
    raw: body,
  });
});
