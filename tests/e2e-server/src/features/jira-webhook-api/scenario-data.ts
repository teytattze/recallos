const DATABASE_NAME = "recallos-system-test";
const TENANT = "organization:jira-webhook-api-test";
const GRAPH_ID = "01952d3f-0000-7000-8000-000000000100";
const SUBSCRIPTION_ID = "01952d3f-0000-7000-8000-000000000101";
const WEBHOOK_SECRET = "jira-webhook-api-test-secret";
const NOW = new Date("2026-06-20T00:00:00.000Z");

const GRAPH = {
  _id: GRAPH_ID,
  createdAt: NOW,
  updatedAt: NOW,
  tenant: TENANT,
  embeddingMetadata: {
    dimension: "1024",
    model: "voyage-4-large",
  },
};

const WEBHOOK_SUBSCRIPTION = {
  _id: SUBSCRIPTION_ID,
  createdAt: NOW,
  updatedAt: NOW,
  tenant: TENANT,
  provider: "jira",
  context: {
    _id: "01952d3f-0000-7000-8000-000000000102",
    createdAt: NOW,
    updatedAt: NOW,
    graphId: GRAPH_ID,
  },
  secret: {
    _id: "01952d3f-0000-7000-8000-000000000103",
    createdAt: NOW,
    updatedAt: NOW,
    algorithm: "hmac_sha256",
    value: WEBHOOK_SECRET,
  },
};

const WEBHOOK_BODY = {
  issue: {
    id: "jira-issue-10001",
    key: "REC-123",
    fields: { summary: "Verify the complete ingestion pipeline" },
  },
};

export {
  DATABASE_NAME,
  GRAPH,
  GRAPH_ID,
  SUBSCRIPTION_ID,
  TENANT,
  WEBHOOK_BODY,
  WEBHOOK_SECRET,
  WEBHOOK_SUBSCRIPTION,
};
