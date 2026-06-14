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
  getMongodbConfig,
  MongodbUnitOfWork,
  MongodbWebhookSubscriptionRepository,
  NodeWebhookSignatureGenerator,
} from "@repo/server-ingestion-outbound-adapter";
import { createDefaultClock } from "@repo/server-kernel";

// CONFIG
const mongodbConfig = getMongodbConfig();

// OUTBOUND
const mongodbClient = createMongodbClient({
  url: mongodbConfig.INGESTION_MONGODB_URL,
});
const unitOfWork = new MongodbUnitOfWork(
  mongodbClient,
  mongodbConfig.INGESTION_MONGODB_DATABAES_NAME,
);
const webhookSubscriptionRepository = new MongodbWebhookSubscriptionRepository(
  mongodbClient,
  mongodbConfig.INGESTION_MONGODB_DATABAES_NAME,
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
