import type { ProcessEventPort } from "@repo/server-knowledge-core";
import type { Collection, Document, MongoClient } from "mongodb";

import { handleIngestionInsert } from "./handlers/ingestion-handlers.ts";

const COLLECTION_NAME = "events" as const;
const INSERT_PIPELINE = [{ $match: { operationType: "insert" } }] as const;

class MongodbChangeStream {
  constructor(
    private readonly client: MongoClient,
    private readonly databaseName: string,
    private readonly processEvent: ProcessEventPort,
  ) {}

  async listen(): Promise<void> {
    const stream = this.collection.watch([...INSERT_PIPELINE]);

    try {
      for await (const change of stream) {
        if (change.operationType !== "insert") continue;

        await handleIngestionInsert({
          document: change.fullDocument,
          processEvent: this.processEvent,
        });
      }
    } finally {
      await stream.close();
    }
  }

  private get collection(): Collection<Document> {
    return this.client.db(this.databaseName).collection(COLLECTION_NAME);
  }
}

export { MongodbChangeStream };
