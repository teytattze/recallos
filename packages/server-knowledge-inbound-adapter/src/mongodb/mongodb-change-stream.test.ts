import type {
  ProcessEventPort,
  ProcessEventPortInput,
  ProcessEventPortOutput,
} from "@repo/server-knowledge-core";
import type { Document, MongoClient } from "mongodb";

import { expect, test } from "bun:test";

import { MongodbChangeStream } from "./mongodb-change-stream.ts";

const tenant = "organization:org1";
const graphId = "01952d3f-0000-7000-8000-000000000100";

const insertChange = (id: string, raw: Document) => ({
  operationType: "insert" as const,
  fullDocument: {
    _id: id,
    createdAt: new Date("2026-06-18T12:00:00.000Z"),
    updatedAt: new Date("2026-06-18T12:00:00.000Z"),
    tenant,
    graphId,
    raw,
  },
});

class FakeProcessEvent implements ProcessEventPort {
  readonly executeCalls: ProcessEventPortInput[] = [];
  activeExecutions = 0;
  maxActiveExecutions = 0;

  async execute(input: ProcessEventPortInput): ProcessEventPortOutput {
    this.executeCalls.push(input);
    this.activeExecutions += 1;
    this.maxActiveExecutions = Math.max(
      this.maxActiveExecutions,
      this.activeExecutions,
    );
    await Bun.sleep(1);
    this.activeExecutions -= 1;
  }
}

class RejectingProcessEvent implements ProcessEventPort {
  executeCalls = 0;

  execute(): ProcessEventPortOutput {
    this.executeCalls += 1;
    return Promise.reject(new Error("processing failed"));
  }
}

class FakeChangeStream {
  closed = false;

  constructor(private readonly changes: Document[]) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<Document> {
    for (const change of this.changes) yield change;
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

const createFakeClient = (stream: FakeChangeStream) => {
  let watchedCollection: string | undefined;
  let pipeline: Document[] | undefined;

  const client = {
    db: () => ({
      collection: (name: string) => {
        watchedCollection = name;
        return {
          watch: (receivedPipeline: Document[]) => {
            pipeline = receivedPipeline;
            return stream;
          },
        };
      },
    }),
  } as unknown as MongoClient;

  return {
    client,
    get pipeline() {
      return pipeline;
    },
    get watchedCollection() {
      return watchedCollection;
    },
  };
};

const captureError = async (promise: Promise<void>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("Expected promise to reject");
};

test("MongodbChangeStream: maps an inserted event to ProcessEventPort", async () => {
  const processEvent = new FakeProcessEvent();
  const stream = new FakeChangeStream([
    insertChange("event-1", { issue: { key: "REC-1" } }),
  ]);
  const fake = createFakeClient(stream);

  await new MongodbChangeStream(fake.client, "recallos", processEvent).listen();

  expect(fake.watchedCollection).toBe("events");
  expect(processEvent.executeCalls).toEqual([
    {
      tenant,
      payload: {
        event: { id: "event-1", raw: { issue: { key: "REC-1" } } },
        graphId,
      },
    },
  ]);
  expect(stream.closed).toBe(true);
});

test("MongodbChangeStream: watches inserts and processes them sequentially", async () => {
  const processEvent = new FakeProcessEvent();
  const stream = new FakeChangeStream([
    { operationType: "update" },
    insertChange("event-1", { sequence: 1 }),
    insertChange("event-2", { sequence: 2 }),
  ]);
  const fake = createFakeClient(stream);

  await new MongodbChangeStream(fake.client, "recallos", processEvent).listen();

  expect(fake.pipeline).toEqual([{ $match: { operationType: "insert" } }]);
  expect(
    processEvent.executeCalls.map((call) => call.payload.event.id),
  ).toEqual(["event-1", "event-2"]);
  expect(processEvent.maxActiveExecutions).toBe(1);
});

test("MongodbChangeStream: rejects malformed inserted documents and closes the stream", async () => {
  const processEvent = new FakeProcessEvent();
  const stream = new FakeChangeStream([
    {
      operationType: "insert",
      fullDocument: { _id: "event-1", tenant, graphId, raw: [] },
    },
  ]);
  const fake = createFakeClient(stream);

  const result = new MongodbChangeStream(
    fake.client,
    "recallos",
    processEvent,
  ).listen();

  const error = await captureError(result);

  expect(error).toBeInstanceOf(Error);
  expect(processEvent.executeCalls).toEqual([]);
  expect(stream.closed).toBe(true);
});

test("MongodbChangeStream: propagates processing failures and closes the stream", async () => {
  const processEvent = new RejectingProcessEvent();
  const stream = new FakeChangeStream([
    insertChange("event-1", { issue: { key: "REC-1" } }),
  ]);
  const fake = createFakeClient(stream);

  const result = new MongodbChangeStream(
    fake.client,
    "recallos",
    processEvent,
  ).listen();

  const error = await captureError(result);

  expect(error).toEqual(new Error("processing failed"));
  expect(processEvent.executeCalls).toBe(1);
  expect(stream.closed).toBe(true);
});
