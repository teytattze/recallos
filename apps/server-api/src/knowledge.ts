import { createMongodbClient } from "@repo/server-database";
import {
  ListGraphNodesUseCase,
  SearchGraphUseCase,
} from "@repo/server-knowledge-core";
import {
  createGraphNodeRoutes,
  createKnowledgeHttpApp,
  createKnowledgeMcpRoutes,
} from "@repo/server-knowledge-inbound-adapter";
import {
  MongodbGraphNodeRepository,
  MongodbGraphRepository,
  VoyageaiEmbeddingGateway,
} from "@repo/server-knowledge-outbound-adapter";

import { config } from "./config.ts";
import { getTenant, requireKnowledgeRead } from "./iam";

// CONFIG
const mongodbConfig = config.knowledge.mongodb;
const voyageaiConfig = config.knowledge.voyageai;

// OUTBOUND
const mongodbClient = createMongodbClient({ url: mongodbConfig.url });
const graphNodeRepository = new MongodbGraphNodeRepository(
  mongodbClient,
  mongodbConfig.databaseName,
);
const graphRepository = new MongodbGraphRepository(
  mongodbClient,
  mongodbConfig.databaseName,
);
const embeddingGateway = new VoyageaiEmbeddingGateway(voyageaiConfig.apiKey);

// CORE
const listGraphNodesUseCase = new ListGraphNodesUseCase(graphNodeRepository);
const searchGraphUseCase = new SearchGraphUseCase(
  embeddingGateway,
  graphRepository,
  graphNodeRepository,
);

// INBOUND
const graphNodeRoutes = createGraphNodeRoutes({
  deps: {
    listGraphNodes: listGraphNodesUseCase,
    searchGraph: searchGraphUseCase,
  },
  resolveTenant: getTenant,
});
const mcpRoutes = createKnowledgeMcpRoutes({
  deps: { searchGraph: searchGraphUseCase },
  resolveTenant: getTenant,
});
const knowledgeHttpApp = createKnowledgeHttpApp({
  deps: {
    graphNodeMiddlewares: [requireKnowledgeRead],
    graphNodeRoutes,
    mcpMiddlewares: [requireKnowledgeRead],
    mcpRoutes,
  },
});

export { knowledgeHttpApp };
