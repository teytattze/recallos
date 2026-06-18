import type {
  GraphNodeRepositoryPort,
  GraphNodeRepositoryPortInsertInput,
  GraphNodeRepositoryPortInsertOutput,
} from "@repo/server-knowledge-core";
import type { Collection, ClientSession, MongoClient } from "mongodb";

import type { MongodbGraphNodeModel } from "./mongodb-model.ts";

const COLLECTION_NAME = "graph-nodes" as const;

class MongodbGraphNodeRepository implements GraphNodeRepositoryPort {
  constructor(
    private readonly client: MongoClient,
    private readonly databaseName: string,
    private readonly session?: ClientSession,
  ) {}

  async insert(
    input: GraphNodeRepositoryPortInsertInput,
  ): GraphNodeRepositoryPortInsertOutput {
    const node = input.data;
    const model = {
      _id: node.id.toString(),
      createdAt: node.metadata.createdAt,
      updatedAt: node.metadata.updatedAt,
      tenant: node.tenant.toString(),
      embedding: node.embedding,
      eventId: node.eventId.toString(),
      graphId: node.graphId.toString(),
      rawEvent: node.rawEvent,
    } satisfies MongodbGraphNodeModel;

    await this.collection.insertOne(model, { session: this.session });
  }

  private get collection(): Collection<MongodbGraphNodeModel> {
    return this.client
      .db(this.databaseName)
      .collection<MongodbGraphNodeModel>(COLLECTION_NAME);
  }
}

export { MongodbGraphNodeRepository };
