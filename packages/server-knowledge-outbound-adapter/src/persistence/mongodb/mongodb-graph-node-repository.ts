import type {
  GraphNodeRepositoryPort,
  GraphNodeRepositoryPortFindManyInput,
  GraphNodeRepositoryPortFindManyOutput,
  GraphNodeRepositoryPortInsertInput,
  GraphNodeRepositoryPortInsertOutput,
} from "@repo/server-knowledge-core";
import type { Collection, ClientSession, MongoClient } from "mongodb";

import { GraphNode } from "@repo/server-knowledge-core";

import type { MongodbGraphNodeModel } from "./mongodb-model.ts";

const COLLECTION_NAME = "graph-nodes" as const;

class MongodbGraphNodeRepository implements GraphNodeRepositoryPort {
  constructor(
    private readonly client: MongoClient,
    private readonly databaseName: string,
    private readonly session?: ClientSession,
  ) {}

  async findMany(
    input: GraphNodeRepositoryPortFindManyInput,
  ): GraphNodeRepositoryPortFindManyOutput {
    const models = await this.collection
      .find(
        {
          eventId: input.filters.eventId.toString(),
          graphId: input.filters.graphId.toString(),
          tenant: input.tenant.toString(),
        },
        { session: this.session },
      )
      .toArray();

    return models.map((model) =>
      GraphNode.restore({
        tenant: model.tenant,
        metadata: {
          createdAt: model.createdAt,
          updatedAt: model.updatedAt,
        },
        payload: {
          id: model._id,
          embedding: model.embedding,
          eventId: model.eventId,
          graphId: model.graphId,
          rawEvent: model.rawEvent,
        },
      }),
    );
  }

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
