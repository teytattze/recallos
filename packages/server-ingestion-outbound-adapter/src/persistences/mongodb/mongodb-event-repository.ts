import type {
  EventRepositoryPort,
  EventRepositoryPortInsertInput,
  EventRepositoryPortInsertOutput,
} from "@repo/server-ingestion-core";
import type { Collection, ClientSession, MongoClient } from "mongodb";

import type { MongodbEventModel } from "./mongodb-event-model";

const COLLECTION_NAME = "events" as const;

class MongodbEventRepository implements EventRepositoryPort {
  constructor(
    private readonly client: MongoClient,
    private readonly databaseName: string,
    private readonly session?: ClientSession,
  ) {}

  async insert(
    input: EventRepositoryPortInsertInput,
  ): EventRepositoryPortInsertOutput {
    const event = input.data;
    const model: MongodbEventModel = {
      _id: event.id.toString(),
      createdAt: event.metadata.createdAt,
      updatedAt: event.metadata.updatedAt,
      tenant: event.tenant.toString(),

      external: {
        id: event.external.id,
        provider: event.external.provider,
      },
      graphId: event.graphId.toString(),
      raw: event.raw,
    };
    await this.collection.insertOne(model, {
      session: this.session,
    });
  }

  private get collection(): Collection<MongodbEventModel> {
    return this.client
      .db(this.databaseName)
      .collection<MongodbEventModel>(COLLECTION_NAME);
  }
}

export { MongodbEventRepository };
