import { createMongodbClient } from "@repo/server-database";
import {
  AuthenticateWebhookRequestUseCase,
  CreateWebhookSubscriptionUseCase,
  GetWebhookSubscriptionUseCase,
  IngestEventUseCase,
} from "@repo/server-ingestion-core";
import {
  createIngestionHttpApp,
  createJiraWebhookRoutes,
  createWebhookSubscriptionRoutes,
} from "@repo/server-ingestion-inbound-adapter";
import {
  MongodbUnitOfWork,
  NodeWebhookSecretGenerator,
  MongodbWebhookSubscriptionRepository,
  NodeWebhookSignatureGenerator,
} from "@repo/server-ingestion-outbound-adapter";
import { createDefaultClock } from "@repo/server-kernel";

import { config } from "./config.ts";
import { getIamTenant, requireIngestionWrite } from "./iam";

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
const webhookSecretGenerator = new NodeWebhookSecretGenerator();
const webhookSignatureGenerator = new NodeWebhookSignatureGenerator();

// CORE
const clock = createDefaultClock();
const authenticateWebhookRequestUseCase = new AuthenticateWebhookRequestUseCase(
  webhookSubscriptionRepository,
  webhookSignatureGenerator,
);
const createWebhookSubscriptionUseCase = new CreateWebhookSubscriptionUseCase(
  clock,
  unitOfWork,
  webhookSecretGenerator,
);
const ingestEventUseCase = new IngestEventUseCase(clock, unitOfWork);
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
const webhookSubscriptionRoutes = createWebhookSubscriptionRoutes({
  deps: { createWebhookSubscription: createWebhookSubscriptionUseCase },
  resolveTenant: getIamTenant,
});
const ingestionHttpApp = createIngestionHttpApp({
  deps: {
    jiraWebhookRoutes,
    webhookSubscriptionMiddlewares: [requireIngestionWrite],
    webhookSubscriptionRoutes,
  },
});

export { ingestionHttpApp };
