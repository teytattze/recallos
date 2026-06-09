import type { Event, EventRepositoryPort } from "@repo/server-ingestion";
import type { Collection, ClientSession, MongoClient } from "mongodb";

import type { MongodbEventModel } from "./mongodb-event-model";

const COLLECTION_NAME = "events" as const;

class MongodbEventRepository implements EventRepositoryPort {
  constructor(
    private readonly client: MongoClient,
    private readonly databaseName: string,
    private readonly session?: ClientSession,
  ) {}

  async insert(event: Event): Promise<void> {
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
