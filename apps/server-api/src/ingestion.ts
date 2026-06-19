import { createMongodbClient } from "@repo/server-database";
import {
  AuthenticateWebhookRequestUseCase,
  GetWebhookSubscriptionUseCase,
  IngestEventUseCase,
} from "@repo/server-ingestion-core";
import {
  createIngestionHttpApp,
  createJiraWebhookRoutes,
} from "@repo/server-ingestion-inbound-adapter";
import {
  MongodbUnitOfWork,
  MongodbWebhookSubscriptionRepository,
  NodeWebhookSignatureGenerator,
} from "@repo/server-ingestion-outbound-adapter";
import { createDefaultClock } from "@repo/server-kernel";

import { config } from "./runtime-config.ts";

// CONFIG
const mongodbConfig = config.ingestion.mongodb;

// OUTBOUND
const mongodbClient = createMongodbClient({
  url: mongodbConfig.url,
});
const unitOfWork = new MongodbUnitOfWork(
  mongodbClient,
  mongodbConfig.databaseName,
);
const webhookSubscriptionRepository = new MongodbWebhookSubscriptionRepository(
  mongodbClient,
  mongodbConfig.databaseName,
);
const webhookSignatureGenerator = new NodeWebhookSignatureGenerator();

// CORE
const authenticateWebhookRequestUseCase = new AuthenticateWebhookRequestUseCase(
  webhookSubscriptionRepository,
  webhookSignatureGenerator,
);
const ingestEventUseCase = new IngestEventUseCase(
  createDefaultClock(),
  unitOfWork,
);
const getWebhookSubscriptionUseCase = new GetWebhookSubscriptionUseCase(
  webhookSubscriptionRepository,
);

// INBOUND
const jiraWebhookRoutes = createJiraWebhookRoutes({
  deps: {
    authenticateWebhookRequest: authenticateWebhookRequestUseCase,
    getWebhookSubscription: getWebhookSubscriptionUseCase,
    ingestEvent: ingestEventUseCase,
  },
});
const ingestionHttpApp = createIngestionHttpApp({
  deps: { jiraWebhookRoutes },
});

export { ingestionHttpApp };
