import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { MongoClient } from "mongodb";

const TEST_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
const testClient = new MongoClient(TEST_URI);
const testDb = testClient.db("recallos_test");
const testCollection = testDb.collection("index_state");

// We test the logic directly against MongoDB rather than importing index-state
// (which would pull in client.ts and all its side effects).
// The index-state module is a thin wrapper, so we validate the MongoDB operations here.

import { indexState } from "./index-state";

beforeEach(async () => {
  await testCollection.deleteMany({});
  // Also clear via the module's own collection (may use different db name)
  await indexState.deleteAll();
});

afterAll(async () => {
  await testDb.dropDatabase();
  await testClient.close();
});

describe("indexState", () => {
  test("insertPending creates a doc with status pending and empty chunkIds", async () => {
    await indexState.insertPending("src/foo.ts", "abc123");

    const docs = await indexState.getPending();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.filePath).toBe("src/foo.ts");
    expect(docs[0]!.contentHash).toBe("abc123");
    expect(docs[0]!.chunkIds).toEqual([]);
    expect(docs[0]!.status).toBe("pending");
  });

  test("markComplete updates status to complete with chunkIds and indexedAt", async () => {
    await indexState.insertPending("src/bar.ts", "def456");
    await indexState.markComplete("src/bar.ts", ["chunk1", "chunk2"]);

    const docs = await indexState.getAll();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.status).toBe("complete");
    expect(docs[0]!.chunkIds).toEqual(["chunk1", "chunk2"]);
    expect(docs[0]!.indexedAt).toBeInstanceOf(Date);
  });

  test("getAll returns only complete docs", async () => {
    await indexState.insertPending("src/a.ts", "h1");
    await indexState.insertPending("src/b.ts", "h2");
    await indexState.markComplete("src/b.ts", ["id1"]);

    const docs = await indexState.getAll();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.filePath).toBe("src/b.ts");
  });

  test("getPending returns only pending docs", async () => {
    await indexState.insertPending("src/a.ts", "h1");
    await indexState.insertPending("src/b.ts", "h2");
    await indexState.markComplete("src/a.ts", ["id1"]);

    const docs = await indexState.getPending();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.filePath).toBe("src/b.ts");
  });

  test("getPending returns empty array when none pending", async () => {
    const docs = await indexState.getPending();
    expect(docs).toEqual([]);
  });

  test("deleteMany removes docs by filePath", async () => {
    await indexState.insertPending("src/a.ts", "h1");
    await indexState.markComplete("src/a.ts", ["id1"]);
    await indexState.insertPending("src/b.ts", "h2");
    await indexState.markComplete("src/b.ts", ["id2"]);
    await indexState.insertPending("src/c.ts", "h3");
    await indexState.markComplete("src/c.ts", ["id3"]);

    await indexState.deleteMany(["src/a.ts", "src/c.ts"]);

    const docs = await indexState.getAll();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.filePath).toBe("src/b.ts");
  });

  test("deleteMany with empty array is a no-op", async () => {
    await indexState.insertPending("src/a.ts", "h1");
    await indexState.markComplete("src/a.ts", ["id1"]);

    await indexState.deleteMany([]);

    const docs = await indexState.getAll();
    expect(docs).toHaveLength(1);
  });

  test("deleteAll removes all docs", async () => {
    await indexState.insertPending("src/a.ts", "h1");
    await indexState.markComplete("src/a.ts", ["id1"]);
    await indexState.insertPending("src/b.ts", "h2");

    await indexState.deleteAll();

    const all = await indexState.getAll();
    const pending = await indexState.getPending();
    expect(all).toEqual([]);
    expect(pending).toEqual([]);
  });

  test("insertPending for existing path resets to pending", async () => {
    await indexState.insertPending("src/a.ts", "h1");
    await indexState.markComplete("src/a.ts", ["id1"]);

    await indexState.insertPending("src/a.ts", "h2");

    const pending = await indexState.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.contentHash).toBe("h2");
    expect(pending[0]!.chunkIds).toEqual([]);
  });
});
