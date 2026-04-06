import { describe, test, expect, mock, beforeEach, afterAll } from "bun:test";
import { MongoClient } from "mongodb";

const TEST_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
const testClient = new MongoClient(TEST_URI);
const testDb = testClient.db("recallos_test");
const testCollection = testDb.collection("index_state");

// oxlint-disable-next-line typescript/no-floating-promises
mock.module("../lib/client", () => ({
  client: { mongodb: testClient },
}));

const { indexState } = await import("./index-state");

const KIND = "codebase";

beforeEach(async () => {
  await testCollection.deleteMany({});
  // Also clear via the module's own collection (may use different db name)
  await indexState.deleteAll(KIND);
});

afterAll(async () => {
  await testDb.dropDatabase();
  await testClient.close();
});

describe("indexState", () => {
  test("insertPending creates a doc with status pending and empty chunkIds", async () => {
    await indexState.insertPending(KIND, "src/foo.ts", "abc123");

    const docs = await indexState.getPending(KIND);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.kind).toBe(KIND);
    expect(docs[0]!.filePath).toBe("src/foo.ts");
    expect(docs[0]!.contentHash).toBe("abc123");
    expect(docs[0]!.chunkIds).toEqual([]);
    expect(docs[0]!.status).toBe("pending");
  });

  test("markComplete updates status to complete with chunkIds and indexedAt", async () => {
    await indexState.insertPending(KIND, "src/bar.ts", "def456");
    await indexState.markComplete(KIND, "src/bar.ts", ["chunk1", "chunk2"]);

    const docs = await indexState.getAll(KIND);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.status).toBe("complete");
    expect(docs[0]!.chunkIds).toEqual(["chunk1", "chunk2"]);
    expect(docs[0]!.indexedAt).toBeInstanceOf(Date);
  });

  test("getAll returns only complete docs", async () => {
    await indexState.insertPending(KIND, "src/a.ts", "h1");
    await indexState.insertPending(KIND, "src/b.ts", "h2");
    await indexState.markComplete(KIND, "src/b.ts", ["id1"]);

    const docs = await indexState.getAll(KIND);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.filePath).toBe("src/b.ts");
  });

  test("getPending returns only pending docs", async () => {
    await indexState.insertPending(KIND, "src/a.ts", "h1");
    await indexState.insertPending(KIND, "src/b.ts", "h2");
    await indexState.markComplete(KIND, "src/a.ts", ["id1"]);

    const docs = await indexState.getPending(KIND);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.filePath).toBe("src/b.ts");
  });

  test("getPending returns empty array when none pending", async () => {
    const docs = await indexState.getPending(KIND);
    expect(docs).toEqual([]);
  });

  test("deleteMany removes docs by filePath", async () => {
    await indexState.insertPending(KIND, "src/a.ts", "h1");
    await indexState.markComplete(KIND, "src/a.ts", ["id1"]);
    await indexState.insertPending(KIND, "src/b.ts", "h2");
    await indexState.markComplete(KIND, "src/b.ts", ["id2"]);
    await indexState.insertPending(KIND, "src/c.ts", "h3");
    await indexState.markComplete(KIND, "src/c.ts", ["id3"]);

    await indexState.deleteMany(KIND, ["src/a.ts", "src/c.ts"]);

    const docs = await indexState.getAll(KIND);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.filePath).toBe("src/b.ts");
  });

  test("deleteMany with empty array is a no-op", async () => {
    await indexState.insertPending(KIND, "src/a.ts", "h1");
    await indexState.markComplete(KIND, "src/a.ts", ["id1"]);

    await indexState.deleteMany(KIND, []);

    const docs = await indexState.getAll(KIND);
    expect(docs).toHaveLength(1);
  });

  test("deleteAll removes all docs for kind", async () => {
    await indexState.insertPending(KIND, "src/a.ts", "h1");
    await indexState.markComplete(KIND, "src/a.ts", ["id1"]);
    await indexState.insertPending(KIND, "src/b.ts", "h2");

    await indexState.deleteAll(KIND);

    const all = await indexState.getAll(KIND);
    const pending = await indexState.getPending(KIND);
    expect(all).toEqual([]);
    expect(pending).toEqual([]);
  });

  test("insertPending for existing path resets to pending", async () => {
    await indexState.insertPending(KIND, "src/a.ts", "h1");
    await indexState.markComplete(KIND, "src/a.ts", ["id1"]);

    await indexState.insertPending(KIND, "src/a.ts", "h2");

    const pending = await indexState.getPending(KIND);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.contentHash).toBe("h2");
    expect(pending[0]!.chunkIds).toEqual([]);
  });

  test("different kinds are isolated", async () => {
    await indexState.insertPending("codebase", "src/a.ts", "h1");
    await indexState.markComplete("codebase", "src/a.ts", ["id1"]);
    await indexState.insertPending("docs", "src/a.ts", "h2");
    await indexState.markComplete("docs", "src/a.ts", ["id2"]);

    const codeDocs = await indexState.getAll("codebase");
    const docsDocs = await indexState.getAll("docs");
    expect(codeDocs).toHaveLength(1);
    expect(codeDocs[0]!.contentHash).toBe("h1");
    expect(docsDocs).toHaveLength(1);
    expect(docsDocs[0]!.contentHash).toBe("h2");

    await indexState.deleteAll("codebase");
    const codeAfter = await indexState.getAll("codebase");
    const docsAfter = await indexState.getAll("docs");
    expect(codeAfter).toEqual([]);
    expect(docsAfter).toHaveLength(1);
  });
});
