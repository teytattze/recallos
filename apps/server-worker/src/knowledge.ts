import { createMongodbClient } from "@repo/server-database";
import { createDefaultClock } from "@repo/server-kernel";
import { ProcessEventUseCase } from "@repo/server-knowledge-core";
import {
  getMongodbConfig,
  getVoyageaiConfig,
  MongodbGraphNodeRepository,
  MongodbGraphRepository,
  VoyageaiEmbeddingGateway,
} from "@repo/server-knowledge-outbound-adapter";

const mongodbConfig = getMongodbConfig();
const voyageaiConfig = getVoyageaiConfig();

const mongodbClient = createMongodbClient({
  url: mongodbConfig.KNOWLEDGE_MONGODB_URL,
});
const graphRepository = new MongodbGraphRepository(
  mongodbClient,
  mongodbConfig.KNOWLEDGE_MONGODB_DATABASE_NAME,
);
const graphNodeRepository = new MongodbGraphNodeRepository(
  mongodbClient,
  mongodbConfig.KNOWLEDGE_MONGODB_DATABASE_NAME,
);
const embeddingGateway = new VoyageaiEmbeddingGateway(
  voyageaiConfig.KNOWLEDGE_VOYAGEAI_API_KEY,
);

const processEventUseCase = new ProcessEventUseCase(
  createDefaultClock(),
  embeddingGateway,
  graphRepository,
  graphNodeRepository,
);

export { processEventUseCase };
