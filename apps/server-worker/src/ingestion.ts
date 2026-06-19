import { createMongodbClient } from "@repo/server-database";
import { MongodbChangeStream } from "@repo/server-knowledge-inbound-adapter";

import { processEventUseCase } from "./knowledge.ts";
import { config } from "./runtime-config.ts";

const mongodbConfig = config.ingestion.mongodb;
const mongodbClient = createMongodbClient({
  url: mongodbConfig.url,
});
const mongodbChangeStream = new MongodbChangeStream(
  mongodbClient,
  mongodbConfig.databaseName,
  processEventUseCase,
);

export { mongodbChangeStream };
