import { createMongodbClient } from "@repo/server-database";
import { GetGraphNodeByEventIdUseCase } from "@repo/server-knowledge-core";
import {
  createGraphNodeRoutes,
  createKnowledgeHttpApp,
} from "@repo/server-knowledge-inbound-adapter";
import { MongodbGraphNodeRepository } from "@repo/server-knowledge-outbound-adapter";

import { config } from "./config.ts";

// CONFIG
const mongodbConfig = config.knowledge.mongodb;

// OUTBOUND
const mongodbClient = createMongodbClient({ url: mongodbConfig.url });
const graphNodeRepository = new MongodbGraphNodeRepository(
  mongodbClient,
  mongodbConfig.databaseName,
);

// CORE
const getGraphNodeByEventIdUseCase = new GetGraphNodeByEventIdUseCase(
  graphNodeRepository,
);

// INBOUND
const graphNodeRoutes = createGraphNodeRoutes({
  deps: { getGraphNodeByEventId: getGraphNodeByEventIdUseCase },
});
const knowledgeHttpApp = createKnowledgeHttpApp({
  deps: { graphNodeRoutes },
});

export { knowledgeHttpApp };
