import { createMongodbClient } from "@repo/server-database";
import { IngestEventUseCase } from "@repo/server-ingestion-core";
import {
  createIngestionHttpApp,
  createJiraWebhookRoutes,
} from "@repo/server-ingestion-inbound-adapter";
import {
  getMongodbConfig,
  MongodbUnitOfWork,
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

// CORE
const ingestEventUseCase = new IngestEventUseCase(
  createDefaultClock(),
  unitOfWork,
);

// INBOUND
const jiraWebhookRoutes = createJiraWebhookRoutes({
  deps: { ingestEventUseCase },
});
const ingestionHttpApp = createIngestionHttpApp({
  deps: { jiraWebhookRoutes },
});

export { ingestionHttpApp };
