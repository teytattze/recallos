import { createMongodbClient } from "@repo/server-database";
import { createDefaultClock } from "@repo/server-kernel";
import { ProcessEventUseCase } from "@repo/server-knowledge-core";
import {
  MongodbGraphNodeRepository,
  MongodbGraphRepository,
  VoyageaiEmbeddingGateway,
} from "@repo/server-knowledge-outbound-adapter";

import { config } from "./runtime-config.ts";

const mongodbConfig = config.knowledge.mongodb;

const mongodbClient = createMongodbClient({
  url: mongodbConfig.url,
});
const graphRepository = new MongodbGraphRepository(
  mongodbClient,
  mongodbConfig.databaseName,
);
const graphNodeRepository = new MongodbGraphNodeRepository(
  mongodbClient,
  mongodbConfig.databaseName,
);
const embeddingGateway = new VoyageaiEmbeddingGateway(
  config.knowledge.voyageai.apiKey,
);

const processEventUseCase = new ProcessEventUseCase(
  createDefaultClock(),
  embeddingGateway,
  graphRepository,
  graphNodeRepository,
);

export { processEventUseCase };
