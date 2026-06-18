import type { Collection, ClientSession, MongoClient } from "mongodb";

import {
  Graph,
  type GraphRepositoryPort,
  type GraphRepositoryPortCreateInput,
  type GraphRepositoryPortCreateOutput,
  type GraphRepositoryPortFindByIdInput,
  type GraphRepositoryPortFindByIdOutput,
} from "@repo/server-knowledge-core";

import type { MongodbGraphModel } from "./mongodb-model.ts";

const COLLECTION_NAME = "graphs" as const;

class MongodbGraphRepository implements GraphRepositoryPort {
  constructor(
    private readonly client: MongoClient,
    private readonly databaseName: string,
    private readonly session?: ClientSession,
  ) {}

  async findById(
    input: GraphRepositoryPortFindByIdInput,
  ): GraphRepositoryPortFindByIdOutput {
    const model = await this.collection.findOne(
      {
        _id: input.id.toString(),
        tenant: input.tenant.toString(),
      },
      { session: this.session },
    );

    return model === null
      ? null
      : Graph.restore({
          tenant: model.tenant,
          metadata: {
            createdAt: model.createdAt,
            updatedAt: model.updatedAt,
          },
          payload: {
            id: model._id,
            embeddingMetadata: {
              payload: model.embeddingMetadata,
            },
          },
        });
  }

  async create(
    input: GraphRepositoryPortCreateInput,
  ): GraphRepositoryPortCreateOutput {
    const graph = input.data;
    const model = {
      _id: graph.id.toString(),
      createdAt: graph.metadata.createdAt,
      updatedAt: graph.metadata.updatedAt,
      tenant: graph.tenant.toString(),
      embeddingMetadata: {
        dimension: graph.embeddingMetadata.dimension,
        model: graph.embeddingMetadata.model,
      },
    } as const satisfies MongodbGraphModel;

    await this.collection.insertOne(model, { session: this.session });
  }

  private get collection(): Collection<MongodbGraphModel> {
    return this.client
      .db(this.databaseName)
      .collection<MongodbGraphModel>(COLLECTION_NAME);
  }
}

export { MongodbGraphRepository };
