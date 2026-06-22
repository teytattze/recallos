import { invariant } from "es-toolkit";
import { MongoClient, type Document, type IndexDescription } from "mongodb";

import type { E2eResource } from "./e2e-resource";

const ERROR_MESSAGE_UNDEFINED_CLIENT =
  "The MongoDB client is undefined. Please ensure it is initialized properly";

type InitMongodbInput = {
  url: string;
  databaseDefs: {
    name: string;
    collectionDefs: {
      name: string;
      indexes: IndexDescription[];
    }[];
  }[];
};

type SeedMongodbInput = {
  databaseName: string;
  collectionName: string;
  docs: Document[];
};

type ResetMongodbInput = {
  databaseName: string;
  collectionName: string;
};

class MongoDatabase implements E2eResource<[InitMongodbInput]> {
  #client: MongoClient | undefined;

  async init(input: InitMongodbInput) {
    const { url, databaseDefs } = input;
    this.#client = new MongoClient(url);

    try {
      await this.#client.connect();
      for (const databaseDef of databaseDefs) {
        const database = this.#client.db(databaseDef.name);
        const existingCollectionNames = new Set(
          (
            await database.listCollections({}, { nameOnly: true }).toArray()
          ).map(({ name }) => name),
        );
        for (const collectionDef of databaseDef.collectionDefs) {
          if (!existingCollectionNames.has(collectionDef.name)) {
            await database.createCollection(collectionDef.name);
          }
          if (collectionDef.indexes.length > 0) {
            const collection = database.collection(collectionDef.name);
            await collection.createIndexes(collectionDef.indexes);
          }
        }
      }
    } catch (error) {
      try {
        await this.cleanUp();
      } catch (cleanUpError) {
        throw new AggregateError(
          [error, cleanUpError],
          "MongoDB initialization and clean-up failed",
        );
      }
      throw error;
    }
  }

  async seedCollection(input: SeedMongodbInput) {
    const { collectionName, databaseName, docs } = input;
    const collection = this.client.db(databaseName).collection(collectionName);
    await collection.insertMany(docs);
  }

  async resetCollection(input: ResetMongodbInput) {
    const { collectionName, databaseName } = input;
    const collection = this.client.db(databaseName).collection(collectionName);
    await collection.deleteMany({ _id: { $exists: true } });
  }

  async cleanUp() {
    await this.#client?.close();
    this.#client = undefined;
  }

  private get client() {
    invariant(this.#client !== undefined, ERROR_MESSAGE_UNDEFINED_CLIENT);
    return this.#client;
  }
}

export { MongoDatabase };
