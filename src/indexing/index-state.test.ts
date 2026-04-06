import type { IndexStateDoc } from "@/indexing/index-state";
import { describe, test, expect, mock, beforeEach } from "bun:test";

const mockUpdateOne = mock();
const mockFind = mock();
const mockDeleteMany = mock();
const mockCreateIndex = mock();

const mockCollection = {
  createIndex: mockCreateIndex,
  updateOne: mockUpdateOne,
  find: mockFind,
  deleteMany: mockDeleteMany,
};

const mockMongo = {
  db: () => ({ collection: () => mockCollection }),
  close: async () => {},
};

// oxlint-disable-next-line typescript/no-floating-promises
mock.module("../lib/client", () => ({
  client: { mongodb: mockMongo },
}));

const { indexState } = await import("./index-state");

const KIND = "codebase";

beforeEach(() => {
  mockUpdateOne.mockReset();
  mockFind.mockReset();
  mockDeleteMany.mockReset();
  mockCreateIndex.mockReset();

  mockUpdateOne.mockResolvedValue({ acknowledged: true });
  mockDeleteMany.mockResolvedValue({ acknowledged: true });
  mockCreateIndex.mockResolvedValue("ok");
  mockFind.mockReturnValue({ toArray: async () => [] });
});

describe("indexState", () => {
  test("insertPending calls updateOne with upsert and pending status", async () => {
    await indexState.insertPending(KIND, "src/foo.ts", "abc123");

    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { kind: KIND, filePath: "src/foo.ts" },
      {
        $set: {
          kind: KIND,
          filePath: "src/foo.ts",
          contentHash: "abc123",
          chunkIds: [],
          status: "pending",
          indexedAt: null,
        },
      },
      { upsert: true },
    );
  });

  test("markComplete calls updateOne with complete status, chunkIds, and indexedAt", async () => {
    await indexState.markComplete(KIND, "src/bar.ts", ["chunk1", "chunk2"]);

    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = mockUpdateOne.mock.calls[0]!;
    expect(filter).toEqual({ kind: KIND, filePath: "src/bar.ts" });
    expect(update.$set.chunkIds).toEqual(["chunk1", "chunk2"]);
    expect(update.$set.status).toBe("complete");
    expect(update.$set.indexedAt).toBeInstanceOf(Date);
  });

  test("getAll queries for complete docs", async () => {
    const fakeDocs = [
      {
        kind: KIND,
        filePath: "src/b.ts",
        status: "complete",
        chunkIds: ["id1"],
        contentHash: "",
        indexedAt: null,
      },
    ] satisfies IndexStateDoc[];
    mockFind.mockReturnValue({ toArray: async () => fakeDocs });

    const docs = await indexState.getAll(KIND);

    expect(mockFind).toHaveBeenCalledWith({ kind: KIND, status: "complete" });
    expect(docs).toEqual(fakeDocs);
  });

  test("getPending queries for pending docs", async () => {
    const fakeDocs = [
      {
        kind: KIND,
        filePath: "src/b.ts",
        status: "pending",
        chunkIds: [],
        contentHash: "",
        indexedAt: null,
      },
    ] satisfies IndexStateDoc[];
    mockFind.mockReturnValue({ toArray: async () => fakeDocs });

    const docs = await indexState.getPending(KIND);

    expect(mockFind).toHaveBeenCalledWith({ kind: KIND, status: "pending" });
    expect(docs).toEqual(fakeDocs);
  });

  test("getPending returns empty array when none pending", async () => {
    mockFind.mockReturnValue({ toArray: async () => [] });

    const docs = await indexState.getPending(KIND);

    expect(docs).toEqual([]);
  });

  test("deleteMany calls collection.deleteMany with $in filter", async () => {
    await indexState.deleteMany(KIND, ["src/a.ts", "src/c.ts"]);

    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      kind: KIND,
      filePath: { $in: ["src/a.ts", "src/c.ts"] },
    });
  });

  test("deleteMany with empty array is a no-op", async () => {
    await indexState.deleteMany(KIND, []);

    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  test("deleteAll calls collection.deleteMany with kind filter", async () => {
    await indexState.deleteAll(KIND);

    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockDeleteMany).toHaveBeenCalledWith({ kind: KIND });
  });

  test("ensureIndexes creates compound index on kind and filePath", async () => {
    await indexState.ensureIndexes();

    expect(mockCreateIndex).toHaveBeenCalledTimes(1);
    expect(mockCreateIndex).toHaveBeenCalledWith(
      { kind: 1, filePath: 1 },
      { unique: true },
    );
  });
});
