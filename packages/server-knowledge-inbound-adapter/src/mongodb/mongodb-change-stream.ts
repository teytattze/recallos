import type { ProcessEventPort } from "@repo/server-knowledge-core";
import type { Collection, Document, MongoClient } from "mongodb";

import { handleIngestionInsert } from "./handlers/ingestion-handlers.ts";

const COLLECTION_NAME = "events" as const;
const INSERT_PIPELINE = [{ $match: { operationType: "insert" } }] as const;

type MongodbChangeStreamListenInput = {
  onReady?: () => void;
};

class MongodbChangeStream {
  constructor(
    private readonly client: MongoClient,
    private readonly databaseName: string,
    private readonly processEvent: ProcessEventPort,
  ) {}

  async listen(input: MongodbChangeStreamListenInput = {}): Promise<void> {
    const stream = this.collection.watch([...INSERT_PIPELINE]);

    try {
      const initialChange = await stream.tryNext();
      input.onReady?.();

      if (initialChange !== null) {
        await this.handleChange(initialChange);
      }

      for await (const change of stream) {
        await this.handleChange(change);
      }
    } finally {
      await stream.close();
    }
  }

  private async handleChange(change: Document): Promise<void> {
    if (change.operationType !== "insert") return;

    await handleIngestionInsert({
      document: change.fullDocument,
      processEvent: this.processEvent,
    });
  }

  private get collection(): Collection<Document> {
    return this.client.db(this.databaseName).collection(COLLECTION_NAME);
  }
}

export { MongodbChangeStream };
export type { MongodbChangeStreamListenInput };
