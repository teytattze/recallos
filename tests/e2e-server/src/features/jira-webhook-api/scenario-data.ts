import { ObjectId } from "mongodb";
import { createHash } from "node:crypto";

const DATABASE_NAME = "recallos-system-test";
const TENANT = "organization:jira-webhook-api-test";
const ORGANIZATION_ID = "jira-webhook-api-test";
const GRAPH_ID = "01952d3f-0000-7000-8000-000000000100";
const SUBSCRIPTION_ID = "01952d3f-0000-7000-8000-000000000101";
const WEBHOOK_SECRET = "jira-webhook-api-test-secret";
const IAM_API_KEY = "rcl_jira_webhook_api_test_key";
const NOW = new Date("2026-06-20T00:00:00.000Z");
const hashApiKey = (apiKey: string) =>
  createHash("sha256").update(apiKey).digest("base64url");

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

const IAM_API_KEY_RECORD = {
  _id: new ObjectId("01952d3f0000700080000104"),
  configId: "org-keys",
  name: "Jira webhook API test key",
  start: "rcl_",
  prefix: "rcl_",
  key: hashApiKey(IAM_API_KEY),
  referenceId: ORGANIZATION_ID,
  enabled: true,
  rateLimitEnabled: false,
  requestCount: 0,
  permissions: JSON.stringify({ knowledge: ["read"] }),
  createdAt: NOW,
  updatedAt: NOW,
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
  IAM_API_KEY,
  IAM_API_KEY_RECORD,
  SUBSCRIPTION_ID,
  TENANT,
  WEBHOOK_BODY,
  WEBHOOK_SECRET,
  WEBHOOK_SUBSCRIPTION,
};
