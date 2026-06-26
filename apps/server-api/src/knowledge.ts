import { createMongodbClient } from "@repo/server-database";
import { ListGraphNodesUseCase } from "@repo/server-knowledge-core";
import {
  createGraphNodeRoutes,
  createKnowledgeHttpApp,
} from "@repo/server-knowledge-inbound-adapter";
import { MongodbGraphNodeRepository } from "@repo/server-knowledge-outbound-adapter";

import { config } from "./config.ts";
import { getTenant, requireKnowledgeRead } from "./iam";

// CONFIG
const mongodbConfig = config.knowledge.mongodb;

// OUTBOUND
const mongodbClient = createMongodbClient({ url: mongodbConfig.url });
const graphNodeRepository = new MongodbGraphNodeRepository(
  mongodbClient,
  mongodbConfig.databaseName,
);

// CORE
const listGraphNodesUseCase = new ListGraphNodesUseCase(graphNodeRepository);

// INBOUND
const graphNodeRoutes = createGraphNodeRoutes({
  deps: { listGraphNodes: listGraphNodesUseCase },
  resolveTenant: getTenant,
});
const knowledgeHttpApp = createKnowledgeHttpApp({
  deps: {
    graphNodeMiddlewares: [requireKnowledgeRead],
    graphNodeRoutes,
  },
});

export { knowledgeHttpApp };
