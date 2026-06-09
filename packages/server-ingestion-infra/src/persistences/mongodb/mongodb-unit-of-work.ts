import type {
  UnitOfWorkPort,
  UnitOfWorkPortContext,
} from "@repo/server-ingestion";
import type { MongoClient } from "mongodb";

import { MongodbEventRepository } from "./mongodb-event-repository";

class MongodbUnitOfWork implements UnitOfWorkPort {
  constructor(
    private readonly client: MongoClient,
    private readonly databaseName: string,
  ) {}

  async transaction<T>(
    work: (ctx: UnitOfWorkPortContext) => Promise<T>,
  ): Promise<T> {
    const session = this.client.startSession();
    try {
      const ret = await work({
        eventRepository: new MongodbEventRepository(
          this.client,
          this.databaseName,
          session,
        ),
      });
      await session.commitTransaction();
      return ret;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}

export { MongodbUnitOfWork };
