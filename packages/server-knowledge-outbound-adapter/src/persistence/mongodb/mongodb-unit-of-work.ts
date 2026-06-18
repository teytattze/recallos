import type {
  UnitOfWorkPort,
  UnitOfWorkPortContext,
} from "@repo/server-knowledge-core";
import type { MongoClient } from "mongodb";

import { MongodbGraphNodeRepository } from "./mongodb-graph-node-repository.ts";
import { MongodbGraphRepository } from "./mongodb-graph-repository.ts";

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
      session.startTransaction();
      const result = await work({
        graphNodeRepository: new MongodbGraphNodeRepository(
          this.client,
          this.databaseName,
          session,
        ),
        graphRepository: new MongodbGraphRepository(
          this.client,
          this.databaseName,
          session,
        ),
      });
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}

export { MongodbUnitOfWork };
