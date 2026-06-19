import { createMongodbClient } from "@repo/server-database";
import {
  getMongodbChangeStreamConfig,
  MongodbChangeStream,
} from "@repo/server-knowledge-inbound-adapter";

import { processEventUseCase } from "./knowledge.ts";

const mongodbChangeStreamConfig = getMongodbChangeStreamConfig();
const mongodbClient = createMongodbClient({
  url: mongodbChangeStreamConfig.INGESTION_MONGODB_URL,
});
const mongodbChangeStream = new MongodbChangeStream(
  mongodbClient,
  mongodbChangeStreamConfig.INGESTION_MONGODB_DATABASE_NAME,
  processEventUseCase,
);

export { mongodbChangeStream };
