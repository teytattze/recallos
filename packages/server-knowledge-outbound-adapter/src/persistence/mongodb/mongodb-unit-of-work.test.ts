import type { MongoClient } from "mongodb";

import { expect, test } from "bun:test";

import { MongodbUnitOfWork } from "./mongodb-unit-of-work.ts";

class FakeClientSession {
  readonly calls: string[] = [];

  startTransaction(): void {
    this.calls.push("startTransaction");
  }

  commitTransaction(): Promise<void> {
    this.calls.push("commitTransaction");
    return Promise.resolve();
  }

  abortTransaction(): Promise<void> {
    this.calls.push("abortTransaction");
    return Promise.resolve();
  }

  endSession(): Promise<void> {
    this.calls.push("endSession");
    return Promise.resolve();
  }
}

class FakeMongoClient {
  readonly session = new FakeClientSession();
  startedSessions = 0;

  startSession(): FakeClientSession {
    this.startedSessions += 1;
    return this.session;
  }
}

test("MongodbUnitOfWork.transaction: given successful work, it should commit, return the result, and end the session", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const unitOfWork = new MongodbUnitOfWork(
    client as unknown as MongoClient,
    "recallos",
  );

  // WHEN
  const result = await unitOfWork.transaction(async (context) => {
    expect(context.graphRepository).toBeDefined();
    expect(context.graphNodeRepository).toBeDefined();
    return "ok";
  });

  // THEN
  expect(result).toBe("ok");
  expect(client.startedSessions).toBe(1);
  expect(client.session.calls).toEqual([
    "startTransaction",
    "commitTransaction",
    "endSession",
  ]);
});

test("MongodbUnitOfWork.transaction: given failing work, it should abort, end the session, and rethrow", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const unitOfWork = new MongodbUnitOfWork(
    client as unknown as MongoClient,
    "recallos",
  );
  const thrown = new Error("boom");

  // WHEN
  const error = await unitOfWork
    .transaction(() => Promise.reject(thrown))
    .catch((caught: unknown) => caught);

  // THEN
  expect(error).toBe(thrown);
  expect(client.session.calls).toEqual([
    "startTransaction",
    "abortTransaction",
    "endSession",
  ]);
});
