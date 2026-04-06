import { test, expect, mock, beforeEach } from "bun:test";
import { typescriptChunker } from "@/memory/chunker/typescript";

// Mock the client module to avoid hitting external services
const mockAdd = mock(() => Promise.resolve());
const mockDelete = mock(() => Promise.resolve());
const mockCollection = {
  add: mockAdd,
  delete: mockDelete,
};

// oxlint-disable-next-line typescript/no-floating-promises
mock.module("../lib/client", () => ({
  client: {
    chromadb: {
      getOrCreateCollection: mock(() => Promise.resolve(mockCollection)),
    },
    voyageai: {
      embed: mock(() =>
        Promise.resolve({
          data: [
            { embedding: [0.1, 0.2] },
            { embedding: [0.3, 0.4] },
            { embedding: [0.5, 0.6] },
            { embedding: [0.7, 0.8] },
            { embedding: [0.9, 1.0] },
          ],
        }),
      ),
    },
  },
}));

// Import after mocking
const { codebaseMemory } = await import("./codebase");

beforeEach(() => {
  mockAdd.mockClear();
  mockDelete.mockClear();
});

test("writeOne returns chunk IDs matching chunker output", async () => {
  const code = `
import { foo } from "bar";

function hello() {
  return "world";
}

const x = 42;
`;
  const chunks = await typescriptChunker.chunkCode(code, "test.ts");
  const ids = await codebaseMemory.writeOne({ code, filePath: "test.ts" });

  expect(ids).toBeArrayOfSize(chunks.length);
  const uuidV7Re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  for (const id of ids) {
    expect(id).toMatch(uuidV7Re);
  }
});

test("writeOne returns UUID v7 IDs", async () => {
  const code = `function greet() { return "hi"; }`;
  const ids = await codebaseMemory.writeOne({ code, filePath: "src/greet.ts" });

  const uuidV7Re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  expect(ids).toBeArrayOfSize(1);
  expect(ids[0]).toMatch(uuidV7Re);
});

test("deleteChunks with empty array is a no-op", async () => {
  await codebaseMemory.deleteChunks([]);
  expect(mockDelete).not.toHaveBeenCalled();
});

test("deleteChunks calls collection.delete with ids", async () => {
  await codebaseMemory.deleteChunks(["a#foo", "a#bar"]);
  expect(mockDelete).toHaveBeenCalledWith({ ids: ["a#foo", "a#bar"] });
});
