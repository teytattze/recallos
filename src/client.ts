import { CloudClient } from "chromadb";
import { MongoClient } from "mongodb";
import { VoyageAIClient } from "voyageai";
import { env } from "./env";

const chromadb = new CloudClient({
  apiKey: env.chromadbApiKey,
  tenant: "e75f7276-8bb0-4c8c-b6ff-4b23add738d3",
  database: "test",
});
const voyageai = new VoyageAIClient({
  apiKey: env.voyageaiApiKey,
});

const mongodb = new MongoClient(env.mongodbUri);

const client = {
  chromadb,
  mongodb,
  voyageai,
};

export { client };
