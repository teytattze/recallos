import type {
  GraphNodeRepositoryPort,
  GraphNodeRepositoryPortBulkInsertManyOutput,
  GraphNodeRepositoryPortInsertManyInput,
} from "@repo/server-knowledge-core";
import type { Collection, ClientSession, MongoClient } from "mongodb";

import { MongoBulkWriteError } from "mongodb";

import type { MongodbGraphNodeModel } from "./mongodb-model.ts";

const COLLECTION_NAME = "graph-nodes" as const;

class MongodbGraphNodeRepository implements GraphNodeRepositoryPort {
  constructor(
    private readonly client: MongoClient,
    private readonly databaseName: string,
    private readonly session?: ClientSession,
  ) {}

  async insertMany(
    input: GraphNodeRepositoryPortInsertManyInput,
  ): GraphNodeRepositoryPortBulkInsertManyOutput {
    if (input.data.length === 0) return [];

    const models = input.data.map(
      (node) =>
        ({
          _id: node.id.toString(),
          createdAt: node.metadata.createdAt,
          updatedAt: node.metadata.updatedAt,
          tenant: node.tenant.toString(),
          embedding: node.embedding,
          eventId: node.eventId.toString(),
          graphId: node.graphId.toString(),
          rawEvent: node.rawEvent,
        }) satisfies MongodbGraphNodeModel,
    );

    try {
      await this.collection.bulkWrite(
        models.map((document) => ({ insertOne: { document } })),
        { ordered: false, session: this.session },
      );
      return input.data.map((node) => ({ id: node.id, status: "success" }));
    } catch (error) {
      if (!(error instanceof MongoBulkWriteError)) throw error;

      const writeErrors = Array.isArray(error.writeErrors)
        ? error.writeErrors
        : [error.writeErrors];
      const failedIndexes = new Set(
        writeErrors.map((writeError) => writeError.index),
      );
      if (failedIndexes.size === 0) throw error;

      return input.data.map((node, index) => ({
        id: node.id,
        status: failedIndexes.has(index) ? "failed" : "success",
      }));
    }
  }

  private get collection(): Collection<MongodbGraphNodeModel> {
    return this.client
      .db(this.databaseName)
      .collection<MongodbGraphNodeModel>(COLLECTION_NAME);
  }
}

export { MongodbGraphNodeRepository };
